"""
Bheem Docs - Electronic Signature Service
==========================================
Handles document electronic signatures with legally binding timestamps,
audit trails, and certificate-based verification.
"""

from typing import Optional, List, Dict, Any
from uuid import UUID, uuid4
from datetime import datetime, timedelta
from enum import Enum
import hashlib
import base64
import json
import secrets
import logging
import psycopg2
from psycopg2.extras import RealDictCursor

from core.config import settings

logger = logging.getLogger(__name__)


class SignatureStatus(str, Enum):
    """Signature request status"""
    PENDING = "PENDING"
    SIGNED = "SIGNED"
    DECLINED = "DECLINED"
    EXPIRED = "EXPIRED"
    CANCELLED = "CANCELLED"


class SignatureType(str, Enum):
    """Type of signature"""
    ELECTRONIC = "ELECTRONIC"  # Basic electronic signature
    ADVANCED = "ADVANCED"      # With identity verification
    QUALIFIED = "QUALIFIED"    # With certificate (QES)


class SignerRole(str, Enum):
    """Role of the signer"""
    SIGNER = "SIGNER"          # Primary signer
    APPROVER = "APPROVER"      # Approver
    WITNESS = "WITNESS"        # Witness
    CARBON_COPY = "CARBON_COPY"  # CC (receives copy, no signature needed)


class DocsSignatureService:
    """
    Electronic signature service for documents.

    Features:
    - Multi-signer support with signing order
    - Signature verification with document hash
    - Audit trail for legal compliance
    - Signature certificate generation
    - Decline and expiry handling
    """

    def __init__(self, db_connection=None):
        """Initialize signature service."""
        self.db_connection = db_connection
        self._conn = None

    def _get_connection(self):
        """Get database connection."""
        if self.db_connection:
            return self.db_connection

        if self._conn is None or self._conn.closed:
            self._conn = psycopg2.connect(
                host=settings.DATABASE_HOST,
                port=settings.DATABASE_PORT,
                database=settings.DATABASE_NAME,
                user=settings.DATABASE_USER,
                password=settings.DATABASE_PASSWORD
            )
        return self._conn

    def _compute_document_hash(self, content: bytes) -> str:
        """Compute SHA-256 hash of document content."""
        return hashlib.sha256(content).hexdigest()

    def _generate_signature_token(self) -> str:
        """Generate secure token for signature access."""
        return secrets.token_urlsafe(32)

    # =========================================================================
    # SIGNATURE REQUEST MANAGEMENT
    # =========================================================================

    async def create_signature_request(
        self,
        document_id: UUID,
        document_hash: str,
        requested_by: UUID,
        signers: List[Dict[str, Any]],
        subject: str,
        message: Optional[str] = None,
        expires_in_days: int = 30,
        signature_type: SignatureType = SignatureType.ELECTRONIC,
        require_signing_order: bool = False,
        tenant_id: Optional[UUID] = None
    ) -> Dict[str, Any]:
        """
        Create a signature request for a document.

        Args:
            document_id: Document UUID
            document_hash: Hash of document content at request time
            requested_by: User creating the request
            signers: List of signers with {email, name, role, order}
            subject: Email subject for signature request
            message: Custom message to signers
            expires_in_days: Days until request expires
            signature_type: Type of signature required
            require_signing_order: Enforce signing order
            tenant_id: Tenant UUID

        Returns:
            Created signature request
        """
        try:
            conn = self._get_connection()
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                request_id = uuid4()
                expires_at = datetime.now() + timedelta(days=expires_in_days)

                # Create signature request
                cur.execute("""
                    INSERT INTO workspace.signature_requests (
                        id, document_id, document_hash, requested_by,
                        subject, message, status, signature_type,
                        require_order, expires_at, tenant_id,
                        created_at, updated_at
                    ) VALUES (
                        %s, %s, %s, %s, %s, %s, 'PENDING', %s, %s, %s, %s,
                        NOW(), NOW()
                    )
                    RETURNING *
                """, (
                    str(request_id),
                    str(document_id),
                    document_hash,
                    str(requested_by),
                    subject,
                    message,
                    signature_type.value,
                    require_signing_order,
                    expires_at,
                    str(tenant_id) if tenant_id else None
                ))

                request = dict(cur.fetchone())

                # Add signers
                signer_records = []
                for idx, signer in enumerate(signers):
                    signer_id = uuid4()
                    access_token = self._generate_signature_token()
                    signing_order = signer.get('order', idx + 1)
                    role = signer.get('role', SignerRole.SIGNER.value)

                    cur.execute("""
                        INSERT INTO workspace.signature_signers (
                            id, request_id, email, name, role,
                            signing_order, status, access_token,
                            created_at, updated_at
                        ) VALUES (
                            %s, %s, %s, %s, %s, %s, 'PENDING', %s, NOW(), NOW()
                        )
                        RETURNING *
                    """, (
                        str(signer_id),
                        str(request_id),
                        signer['email'],
                        signer.get('name', signer['email']),
                        role,
                        signing_order,
                        access_token
                    ))

                    signer_record = dict(cur.fetchone())
                    # Don't expose access token in response
                    signer_record.pop('access_token', None)
                    signer_records.append(signer_record)

                conn.commit()

                request['signers'] = signer_records

                logger.info(
                    f"Created signature request {request_id} for document {document_id} "
                    f"with {len(signers)} signers"
                )

                return request

        except Exception as e:
            logger.error(f"Failed to create signature request: {e}")
            if self._conn:
                self._conn.rollback()
            raise

    async def get_signature_request(
        self,
        request_id: UUID
    ) -> Optional[Dict[str, Any]]:
        """Get signature request with all signers."""
        try:
            conn = self._get_connection()
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                # Get request
                cur.execute("""
                    SELECT sr.*, d.title as document_title
                    FROM workspace.signature_requests sr
                    LEFT JOIN workspace.documents d ON sr.document_id = CAST(d.id AS text)
                    WHERE sr.id = %s
                """, (str(request_id),))

                request = cur.fetchone()
                if not request:
                    return None

                # Get signers
                cur.execute("""
                    SELECT id, email, name, role, signing_order, status,
                           signed_at, declined_at, decline_reason,
                           ip_address, user_agent
                    FROM workspace.signature_signers
                    WHERE request_id = %s
                    ORDER BY signing_order
                """, (str(request_id),))

                request = dict(request)
                request['signers'] = [dict(s) for s in cur.fetchall()]

                return request

        except Exception as e:
            logger.error(f"Failed to get signature request: {e}")
            return None

    async def get_document_signature_requests(
        self,
        document_id: UUID,
        include_completed: bool = True
    ) -> List[Dict[str, Any]]:
        """Get all signature requests for a document."""
        try:
            conn = self._get_connection()
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                query = """
                    SELECT * FROM workspace.signature_requests
                    WHERE document_id = %s
                """
                params = [str(document_id)]

                if not include_completed:
                    query += " AND status = 'PENDING'"

                query += " ORDER BY created_at DESC"

                cur.execute(query, params)
                results = [dict(r) for r in cur.fetchall()]

                # Get signers for each request
                for req in results:
                    cur.execute("""
                        SELECT id, email, name, role, signing_order, status,
                               signed_at, declined_at
                        FROM workspace.signature_signers
                        WHERE request_id = %s
                        ORDER BY signing_order
                    """, (str(req['id']),))
                    req['signers'] = [dict(s) for s in cur.fetchall()]

                return results

        except Exception as e:
            logger.error(f"Failed to get document signature requests: {e}")
            return []

    async def get_pending_signatures(
        self,
        user_email: str,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        """Get documents pending user's signature."""
        try:
            conn = self._get_connection()
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("""
                    SELECT ss.*, sr.subject, sr.message, sr.document_id,
                           sr.expires_at, d.title as document_title
                    FROM workspace.signature_signers ss
                    JOIN workspace.signature_requests sr ON ss.request_id = sr.id
                    LEFT JOIN workspace.documents d ON sr.document_id = CAST(d.id AS text)
                    WHERE ss.email = %s
                    AND ss.status = 'PENDING'
                    AND sr.status = 'PENDING'
                    AND sr.expires_at > NOW()
                    ORDER BY sr.created_at DESC
                    LIMIT %s
                """, (user_email, limit))

                return [dict(r) for r in cur.fetchall()]

        except Exception as e:
            logger.error(f"Failed to get pending signatures: {e}")
            return []

    # =========================================================================
    # SIGNING OPERATIONS
    # =========================================================================

    async def sign_document(
        self,
        signer_id: UUID,
        access_token: str,
        signature_data: str,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Sign a document.

        Args:
            signer_id: Signer UUID
            access_token: Secure access token
            signature_data: Base64 encoded signature image or typed name
            ip_address: Signer's IP
            user_agent: Signer's browser

        Returns:
            Signature confirmation
        """
        try:
            conn = self._get_connection()
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                # Verify signer and token
                cur.execute("""
                    SELECT ss.*, sr.id as request_id, sr.status as request_status,
                           sr.document_id, sr.document_hash, sr.require_order,
                           sr.expires_at
                    FROM workspace.signature_signers ss
                    JOIN workspace.signature_requests sr ON ss.request_id = sr.id
                    WHERE ss.id = %s AND ss.access_token = %s
                    FOR UPDATE
                """, (str(signer_id), access_token))

                signer = cur.fetchone()
                if not signer:
                    return {"error": "Invalid signer or access token"}

                if signer['status'] != 'PENDING':
                    return {"error": f"Signer status is {signer['status']}, cannot sign"}

                if signer['request_status'] != 'PENDING':
                    return {"error": "Signature request is no longer pending"}

                if signer['expires_at'] and signer['expires_at'] < datetime.now():
                    return {"error": "Signature request has expired"}

                # Check signing order if required
                if signer['require_order']:
                    cur.execute("""
                        SELECT COUNT(*) as pending_before
                        FROM workspace.signature_signers
                        WHERE request_id = %s
                        AND signing_order < %s
                        AND status = 'PENDING'
                    """, (str(signer['request_id']), signer['signing_order']))

                    pending = cur.fetchone()['pending_before']
                    if pending > 0:
                        return {"error": "Previous signers have not yet signed"}

                # Generate signature certificate
                signature_id = uuid4()
                signed_at = datetime.now()

                certificate = {
                    "signature_id": str(signature_id),
                    "document_id": str(signer['document_id']),
                    "document_hash": signer['document_hash'],
                    "signer_email": signer['email'],
                    "signer_name": signer['name'],
                    "signed_at": signed_at.isoformat(),
                    "ip_address": ip_address,
                    "signature_type": "ELECTRONIC"
                }

                # Hash the certificate for integrity
                cert_hash = hashlib.sha256(
                    json.dumps(certificate, sort_keys=True).encode()
                ).hexdigest()

                # Update signer record
                cur.execute("""
                    UPDATE workspace.signature_signers
                    SET status = 'SIGNED',
                        signed_at = %s,
                        signature_data = %s,
                        signature_certificate = %s,
                        certificate_hash = %s,
                        ip_address = %s,
                        user_agent = %s,
                        updated_at = NOW()
                    WHERE id = %s
                """, (
                    signed_at,
                    signature_data,
                    json.dumps(certificate),
                    cert_hash,
                    ip_address,
                    user_agent,
                    str(signer_id)
                ))

                # Check if all signers have signed
                cur.execute("""
                    SELECT COUNT(*) as pending
                    FROM workspace.signature_signers
                    WHERE request_id = %s
                    AND status = 'PENDING'
                    AND role != 'CARBON_COPY'
                """, (str(signer['request_id']),))

                pending_signers = cur.fetchone()['pending']

                if pending_signers == 0:
                    # All signed - mark request as complete
                    cur.execute("""
                        UPDATE workspace.signature_requests
                        SET status = 'SIGNED',
                            completed_at = NOW(),
                            updated_at = NOW()
                        WHERE id = %s
                    """, (str(signer['request_id']),))

                conn.commit()

                logger.info(
                    f"Document signed by {signer['email']} for request {signer['request_id']}"
                )

                return {
                    "success": True,
                    "signature_id": str(signature_id),
                    "signed_at": signed_at.isoformat(),
                    "certificate_hash": cert_hash,
                    "all_signed": pending_signers == 0
                }

        except Exception as e:
            logger.error(f"Failed to sign document: {e}")
            if self._conn:
                self._conn.rollback()
            raise

    async def decline_signature(
        self,
        signer_id: UUID,
        access_token: str,
        reason: str,
        ip_address: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Decline to sign a document.

        Args:
            signer_id: Signer UUID
            access_token: Access token
            reason: Decline reason
            ip_address: Signer's IP

        Returns:
            Decline confirmation
        """
        try:
            conn = self._get_connection()
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                # Verify signer
                cur.execute("""
                    SELECT ss.*, sr.id as request_id
                    FROM workspace.signature_signers ss
                    JOIN workspace.signature_requests sr ON ss.request_id = sr.id
                    WHERE ss.id = %s AND ss.access_token = %s
                    AND ss.status = 'PENDING'
                    AND sr.status = 'PENDING'
                    FOR UPDATE
                """, (str(signer_id), access_token))

                signer = cur.fetchone()
                if not signer:
                    return {"error": "Invalid signer or already processed"}

                # Mark as declined
                cur.execute("""
                    UPDATE workspace.signature_signers
                    SET status = 'DECLINED',
                        declined_at = NOW(),
                        decline_reason = %s,
                        ip_address = %s,
                        updated_at = NOW()
                    WHERE id = %s
                """, (reason, ip_address, str(signer_id)))

                # Mark request as declined
                cur.execute("""
                    UPDATE workspace.signature_requests
                    SET status = 'DECLINED',
                        updated_at = NOW()
                    WHERE id = %s
                """, (str(signer['request_id']),))

                conn.commit()

                logger.info(
                    f"Signature declined by {signer['email']} for request {signer['request_id']}"
                )

                return {
                    "success": True,
                    "declined_at": datetime.now().isoformat(),
                    "reason": reason
                }

        except Exception as e:
            logger.error(f"Failed to decline signature: {e}")
            if self._conn:
                self._conn.rollback()
            raise

    async def cancel_signature_request(
        self,
        request_id: UUID,
        cancelled_by: UUID,
        reason: Optional[str] = None
    ) -> Dict[str, Any]:
        """Cancel a signature request."""
        try:
            conn = self._get_connection()
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("""
                    UPDATE workspace.signature_requests
                    SET status = 'CANCELLED',
                        cancelled_by = %s,
                        cancel_reason = %s,
                        updated_at = NOW()
                    WHERE id = %s AND status = 'PENDING'
                    RETURNING *
                """, (str(cancelled_by), reason, str(request_id)))

                result = cur.fetchone()
                if not result:
                    return {"error": "Request not found or already processed"}

                conn.commit()

                return {
                    "success": True,
                    "cancelled_at": datetime.now().isoformat()
                }

        except Exception as e:
            logger.error(f"Failed to cancel signature request: {e}")
            if self._conn:
                self._conn.rollback()
            raise

    # =========================================================================
    # VERIFICATION
    # =========================================================================

    async def verify_signature(
        self,
        document_id: UUID,
        document_hash: str
    ) -> Dict[str, Any]:
        """
        Verify signatures on a document.

        Args:
            document_id: Document UUID
            document_hash: Current document hash

        Returns:
            Verification result
        """
        try:
            conn = self._get_connection()
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                # Get completed signature requests
                cur.execute("""
                    SELECT * FROM workspace.signature_requests
                    WHERE document_id = %s AND status = 'SIGNED'
                    ORDER BY completed_at DESC
                """, (str(document_id),))

                requests = cur.fetchall()

                if not requests:
                    return {
                        "verified": False,
                        "reason": "No completed signatures found",
                        "signatures": []
                    }

                signatures = []
                document_modified = False

                for req in requests:
                    req_dict = dict(req)

                    # Check if document was modified after signing
                    if req_dict['document_hash'] != document_hash:
                        document_modified = True

                    # Get signers
                    cur.execute("""
                        SELECT email, name, role, signed_at,
                               signature_certificate, certificate_hash
                        FROM workspace.signature_signers
                        WHERE request_id = %s AND status = 'SIGNED'
                        ORDER BY signing_order
                    """, (str(req_dict['id']),))

                    signers = []
                    for signer in cur.fetchall():
                        signer_dict = dict(signer)

                        # Verify certificate integrity
                        if signer_dict['signature_certificate']:
                            cert = json.loads(signer_dict['signature_certificate'])
                            computed_hash = hashlib.sha256(
                                json.dumps(cert, sort_keys=True).encode()
                            ).hexdigest()

                            signer_dict['certificate_valid'] = (
                                computed_hash == signer_dict['certificate_hash']
                            )
                        else:
                            signer_dict['certificate_valid'] = False

                        signers.append(signer_dict)

                    signatures.append({
                        "request_id": str(req_dict['id']),
                        "signed_at": req_dict['completed_at'].isoformat() if req_dict['completed_at'] else None,
                        "document_hash_at_signing": req_dict['document_hash'],
                        "document_modified_since": document_modified,
                        "signers": signers
                    })

                return {
                    "verified": not document_modified,
                    "document_modified": document_modified,
                    "signatures": signatures,
                    "total_signatures": len(signatures)
                }

        except Exception as e:
            logger.error(f"Failed to verify signature: {e}")
            return {
                "verified": False,
                "error": str(e)
            }

    async def get_signature_certificate(
        self,
        request_id: UUID
    ) -> Optional[Dict[str, Any]]:
        """
        Get signature certificate for a completed request.

        Returns a certificate documenting all signatures.
        """
        try:
            conn = self._get_connection()
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                # Get request
                cur.execute("""
                    SELECT sr.*, d.title as document_title
                    FROM workspace.signature_requests sr
                    LEFT JOIN workspace.documents d ON sr.document_id = CAST(d.id AS text)
                    WHERE sr.id = %s AND sr.status = 'SIGNED'
                """, (str(request_id),))

                request = cur.fetchone()
                if not request:
                    return None

                # Get all signers
                cur.execute("""
                    SELECT email, name, role, signed_at,
                           signature_certificate, certificate_hash, ip_address
                    FROM workspace.signature_signers
                    WHERE request_id = %s AND status = 'SIGNED'
                    ORDER BY signing_order
                """, (str(request_id),))

                signers = [dict(s) for s in cur.fetchall()]

                # Generate combined certificate
                certificate = {
                    "certificate_id": str(uuid4()),
                    "request_id": str(request['id']),
                    "document_id": str(request['document_id']),
                    "document_title": request['document_title'],
                    "document_hash": request['document_hash'],
                    "signature_type": request['signature_type'],
                    "requested_by": str(request['requested_by']),
                    "requested_at": request['created_at'].isoformat(),
                    "completed_at": request['completed_at'].isoformat() if request['completed_at'] else None,
                    "signers": [
                        {
                            "name": s['name'],
                            "email": s['email'],
                            "role": s['role'],
                            "signed_at": s['signed_at'].isoformat() if s['signed_at'] else None,
                            "ip_address": s['ip_address'],
                            "certificate_hash": s['certificate_hash']
                        }
                        for s in signers
                    ],
                    "generated_at": datetime.now().isoformat()
                }

                # Hash the full certificate
                certificate['certificate_hash'] = hashlib.sha256(
                    json.dumps(certificate, sort_keys=True).encode()
                ).hexdigest()

                return certificate

        except Exception as e:
            logger.error(f"Failed to get signature certificate: {e}")
            return None


# Singleton instance
_signature_service: Optional[DocsSignatureService] = None


def get_docs_signature_service() -> DocsSignatureService:
    """Get or create signature service singleton."""
    global _signature_service
    if _signature_service is None:
        _signature_service = DocsSignatureService()
    return _signature_service
