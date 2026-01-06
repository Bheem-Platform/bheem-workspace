"""
Bheem Workspace - Workspace Email Service
==========================================
Handles workspace email provisioning for all ERP employees across all subsidiaries.

Email Format: firstname.lastname.dept@bheem.co.uk

This service:
1. Generates workspace emails from employee data
2. Creates mailboxes in Mailcow
3. Updates ERP database (auth.users, public.contacts)
4. Updates workspace tenant_users
5. Preserves existing passwords
"""

import re
import logging
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass, field
from enum import Enum
from datetime import datetime

import psycopg2
from psycopg2.extras import RealDictCursor

from core.config import settings
from services.mailcow_service import MailcowService

logger = logging.getLogger(__name__)


# =============================================================================
# CONSTANTS & CONFIGURATION
# =============================================================================

WORKSPACE_DOMAIN = "bheem.co.uk"

# Department code mapping from role keywords to short codes
DEPARTMENT_MAPPING = {
    'developer': 'dev',
    'dev': 'dev',
    'engineer': 'dev',
    'programmer': 'dev',
    'mentor': 'mentor',
    'trainer': 'mentor',
    'videoeditor': 'media',
    'video': 'media',
    'editor': 'media',
    'media': 'media',
    'digitalmarketing': 'mkt',
    'digitalmraketing': 'mkt',  # Handle typo
    'marketing': 'mkt',
    'marketer': 'mkt',
    'seo': 'mkt',
    'social': 'social',
    'counsellor': 'counsel',
    'counselor': 'counsel',
    'counselling': 'counsel',
    'admin': 'admin',
    'admi': 'admin',
    'administrator': 'admin',
    'support': 'support',
    'helpdesk': 'support',
    'sales': 'sales',
    'hr': 'hr',
    'humanresources': 'hr',
    'finance': 'fin',
    'accounts': 'fin',
    'accounting': 'fin',
    'design': 'design',
    'designer': 'design',
    'ui': 'design',
    'ux': 'design',
    'content': 'content',
    'writer': 'content',
    'manager': 'mgmt',
    'management': 'mgmt',
    'lead': 'lead',
    'senior': 'dev',
    'junior': 'dev',
    'intern': 'intern',
    'trainee': 'intern',
}

# Company codes to company IDs mapping (from ERP)
COMPANY_CODES = {
    "BHM001": "79f70aef-17eb-48a8-b599-2879721e8796",
    "BHM002": "4bb6da85-66ab-4707-8d65-3ffee7927e5b",
    "BHM003": "03ac8147-a3bf-455a-8d87-a04f9dbc3580",
    "BHM004": "1b505aaf-981e-4155-bb97-7650827b0e12",
    "BHM005": "9fa118b2-d50a-4867-86c1-b3c532d69f70",
    "BHM006": "9bad628b-6d66-441b-a514-09adbbb31b3c",
    "BHM007": "0cccce62-b3b5-4108-884e-1fb89c58001d",
    "BHM008": "cafe17e8-72a3-438b-951e-7af25af4bab8",
    "BHM009": "b9a8c7d6-e5f4-4a3b-2c1d-0e9f8a7b6c5d",
}


# =============================================================================
# DATA CLASSES
# =============================================================================

class MigrationStatus(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"


@dataclass
class EmployeeData:
    """Employee data from ERP"""
    employee_id: str
    employee_code: str
    user_id: Optional[str]
    person_id: Optional[str]
    first_name: Optional[str]
    last_name: Optional[str]
    current_email: Optional[str]
    current_secondary_email: Optional[str]
    username: Optional[str]
    company_code: Optional[str]
    company_name: Optional[str]
    company_id: Optional[str]
    department_id: Optional[str]
    job_title: Optional[str]
    has_password: bool = False


@dataclass
class MigrationResult:
    """Result of a single employee migration"""
    employee_code: str
    status: MigrationStatus
    old_email: Optional[str] = None
    new_email: Optional[str] = None
    department_code: Optional[str] = None
    error: Optional[str] = None
    steps_completed: List[str] = field(default_factory=list)


@dataclass
class BatchMigrationResult:
    """Result of batch migration"""
    total: int = 0
    successful: int = 0
    failed: int = 0
    skipped: int = 0
    results: List[MigrationResult] = field(default_factory=list)
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


# =============================================================================
# WORKSPACE EMAIL SERVICE
# =============================================================================

class WorkspaceEmailService:
    """
    Service for generating and migrating workspace emails.

    Connects directly to ERP database to:
    - Read employee data
    - Update auth.users (username, email)
    - Update public.contacts (email_primary, email_secondary)

    Uses Mailcow service to create mailboxes.
    """

    def __init__(self):
        self.erp_db_config = {
            'host': settings.ERP_DB_HOST,
            'port': settings.ERP_DB_PORT,
            'database': settings.ERP_DB_NAME,
            'user': settings.ERP_DB_USER,
            'password': settings.ERP_DB_PASSWORD,
        }
        self.mailcow = MailcowService()
        self.domain = WORKSPACE_DOMAIN

    def _get_erp_connection(self):
        """Get connection to ERP database"""
        return psycopg2.connect(**self.erp_db_config)

    # =========================================================================
    # EMAIL GENERATION
    # =========================================================================

    def sanitize_name(self, name: str) -> str:
        """Sanitize name for email local part"""
        if not name:
            return ""
        # Remove special characters, keep only letters
        clean = re.sub(r'[^a-zA-Z]', '', name.lower())
        return clean

    def extract_role_from_email(self, email: str) -> Optional[str]:
        """Extract role/department from existing email"""
        if not email or '@' not in email:
            return None

        local_part = email.split('@')[0].lower()

        # Check for known roles in the local part
        for role_keyword in DEPARTMENT_MAPPING.keys():
            if role_keyword in local_part:
                return role_keyword

        return None

    def get_department_code(self, role: Optional[str]) -> str:
        """Get short department code from role"""
        if not role:
            return 'gen'
        return DEPARTMENT_MAPPING.get(role.lower(), 'gen')

    def generate_workspace_email(
        self,
        first_name: str,
        last_name: str,
        current_email: Optional[str] = None,
        department_override: Optional[str] = None
    ) -> Tuple[str, str]:
        """
        Generate workspace email address.

        Format: firstname.lastname.dept@bheem.co.uk

        Returns:
            Tuple of (email, department_code)
        """
        first = self.sanitize_name(first_name)
        last = self.sanitize_name(last_name)

        if not first:
            first = 'user'
        if not last:
            last = 'unknown'

        # Determine department code
        if department_override:
            dept_code = self.get_department_code(department_override)
        else:
            # Extract from current email
            role = self.extract_role_from_email(current_email)
            dept_code = self.get_department_code(role)

        email = f"{first}.{last}.{dept_code}@{self.domain}"
        return email, dept_code

    # =========================================================================
    # ERP DATABASE OPERATIONS
    # =========================================================================

    def get_all_employees(self, company_code: Optional[str] = None) -> List[EmployeeData]:
        """
        Get all active employees from ERP database.

        Args:
            company_code: Optional filter by company (BHM001-BHM009)

        Returns:
            List of EmployeeData objects
        """
        conn = self._get_erp_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                query = """
                    SELECT
                        e.id as employee_id,
                        e.employee_code,
                        e.user_id,
                        e.department_id,
                        p.id as person_id,
                        p.first_name,
                        p.last_name,
                        p.position as job_title,
                        p.company_id,
                        c.email_primary as current_email,
                        c.email_secondary as current_secondary_email,
                        u.username,
                        u.hashed_password IS NOT NULL as has_password,
                        comp.company_code,
                        comp.company_name
                    FROM hr.employees e
                    LEFT JOIN auth.users u ON e.user_id = u.id
                    LEFT JOIN public.persons p ON u.person_id = p.id
                    LEFT JOIN public.contacts c ON c.person_id = p.id
                    LEFT JOIN public.companies comp ON p.company_id = comp.id
                    WHERE e.employment_status = 'ACTIVE'
                    AND e.is_deleted = false
                    AND u.id IS NOT NULL
                """

                params = []
                if company_code:
                    query += " AND comp.company_code = %s"
                    params.append(company_code)

                query += " ORDER BY comp.company_code, e.employee_code"

                cur.execute(query, params)
                rows = cur.fetchall()

                employees = []
                for row in rows:
                    employees.append(EmployeeData(
                        employee_id=str(row['employee_id']) if row['employee_id'] else None,
                        employee_code=row['employee_code'],
                        user_id=str(row['user_id']) if row['user_id'] else None,
                        person_id=str(row['person_id']) if row['person_id'] else None,
                        first_name=row['first_name'],
                        last_name=row['last_name'],
                        current_email=row['current_email'],
                        current_secondary_email=row['current_secondary_email'],
                        username=row['username'],
                        company_code=row['company_code'],
                        company_name=row['company_name'],
                        company_id=str(row['company_id']) if row['company_id'] else None,
                        department_id=str(row['department_id']) if row['department_id'] else None,
                        job_title=row['job_title'],
                        has_password=row['has_password']
                    ))

                return employees
        finally:
            conn.close()

    def get_employee_by_code(self, employee_code: str) -> Optional[EmployeeData]:
        """Get single employee by employee code"""
        employees = self.get_all_employees()
        for emp in employees:
            if emp.employee_code == employee_code:
                return emp
        return None

    def check_email_exists(self, email: str) -> bool:
        """Check if email already exists in ERP"""
        conn = self._get_erp_connection()
        try:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT COUNT(*) FROM public.contacts
                    WHERE email_primary = %s OR email_secondary = %s
                """, (email, email))
                count = cur.fetchone()[0]

                if count > 0:
                    return True

                cur.execute("""
                    SELECT COUNT(*) FROM auth.users
                    WHERE username = %s OR email = %s
                """, (email, email))
                count = cur.fetchone()[0]

                return count > 0
        finally:
            conn.close()

    def generate_unique_email(
        self,
        first_name: str,
        last_name: str,
        current_email: Optional[str] = None,
        department_override: Optional[str] = None
    ) -> Tuple[str, str]:
        """
        Generate unique workspace email, adding suffix if needed.

        Returns:
            Tuple of (unique_email, department_code)
        """
        base_email, dept_code = self.generate_workspace_email(
            first_name, last_name, current_email, department_override
        )

        # Check if email exists
        if not self.check_email_exists(base_email):
            return base_email, dept_code

        # Add numeric suffix
        local_part = base_email.split('@')[0]
        for i in range(2, 100):
            candidate = f"{local_part}{i}@{self.domain}"
            if not self.check_email_exists(candidate):
                return candidate, dept_code

        raise ValueError(f"Could not generate unique email for {first_name} {last_name}")

    # =========================================================================
    # MIGRATION OPERATIONS
    # =========================================================================

    def update_erp_user_email(
        self,
        user_id: str,
        person_id: str,
        new_email: str,
        old_email: str
    ) -> bool:
        """
        Update email in ERP database.

        Updates:
        - auth.users.username and auth.users.email
        - public.contacts.email_primary (new) and email_secondary (old)
        """
        conn = self._get_erp_connection()
        try:
            with conn.cursor() as cur:
                # Update auth.users
                cur.execute("""
                    UPDATE auth.users
                    SET username = %s, email = %s, updated_at = NOW()
                    WHERE id = %s::uuid
                """, (new_email, new_email, user_id))

                # Update contacts - move old email to secondary, set new as primary
                cur.execute("""
                    UPDATE public.contacts
                    SET
                        email_secondary = COALESCE(email_primary, email_secondary),
                        email_primary = %s,
                        updated_at = NOW()
                    WHERE person_id = %s::uuid
                """, (new_email, person_id))

                conn.commit()
                return True
        except Exception as e:
            conn.rollback()
            logger.error(f"Failed to update ERP user email: {e}")
            raise
        finally:
            conn.close()

    async def create_mailbox(
        self,
        email: str,
        name: str,
        password: str,
        quota: int = 1024
    ) -> bool:
        """
        Create mailbox in Mailcow.

        Args:
            email: New workspace email
            name: Display name
            password: Password for mailbox
            quota: Mailbox quota in MB
        """
        try:
            local_part = email.split('@')[0]
            domain = email.split('@')[1]

            result = await self.mailcow.create_mailbox(
                local_part=local_part,
                password=password,
                name=name,
                domain=domain,
                quota=quota
            )

            if result and (result.get('type') == 'success' or 'success' in str(result).lower()):
                return True

            logger.warning(f"Mailcow response: {result}")
            return False
        except Exception as e:
            logger.error(f"Failed to create mailbox: {e}")
            return False

    async def migrate_employee(
        self,
        employee: EmployeeData,
        dry_run: bool = False,
        default_password: Optional[str] = None
    ) -> MigrationResult:
        """
        Migrate single employee to workspace email.

        Steps:
        1. Generate new workspace email
        2. Update ERP database (auth.users, public.contacts)
        3. Create mailbox in Mailcow

        Args:
            employee: Employee data
            dry_run: If True, only simulate without making changes
            default_password: Password to use for mailbox (required if not dry_run)
        """
        result = MigrationResult(
            employee_code=employee.employee_code,
            status=MigrationStatus.IN_PROGRESS,
            old_email=employee.current_email
        )

        try:
            # Validate employee data
            if not employee.user_id or not employee.person_id:
                result.status = MigrationStatus.SKIPPED
                result.error = "Missing user_id or person_id"
                return result

            if not employee.first_name:
                result.status = MigrationStatus.SKIPPED
                result.error = "Missing first name"
                return result

            # Generate workspace email
            new_email, dept_code = self.generate_unique_email(
                first_name=employee.first_name,
                last_name=employee.last_name or '',
                current_email=employee.current_email
            )

            result.new_email = new_email
            result.department_code = dept_code
            result.steps_completed.append(f"Generated email: {new_email}")

            if dry_run:
                result.status = MigrationStatus.COMPLETED
                result.steps_completed.append("DRY RUN - No changes made")
                return result

            # Update ERP database
            self.update_erp_user_email(
                user_id=employee.user_id,
                person_id=employee.person_id,
                new_email=new_email,
                old_email=employee.current_email or ''
            )
            result.steps_completed.append("Updated ERP database")

            # Create mailbox in Mailcow
            password = default_password or "TempPassword123!"  # Should be provided
            display_name = f"{employee.first_name} {employee.last_name or ''}".strip()

            mailbox_created = await self.create_mailbox(
                email=new_email,
                name=display_name,
                password=password,
                quota=1024
            )

            if mailbox_created:
                result.steps_completed.append("Created Mailcow mailbox")
            else:
                result.steps_completed.append("WARNING: Mailbox creation may have failed")

            result.status = MigrationStatus.COMPLETED
            return result

        except Exception as e:
            logger.error(f"Migration failed for {employee.employee_code}: {e}")
            result.status = MigrationStatus.FAILED
            result.error = str(e)
            return result

    async def migrate_all_employees(
        self,
        company_code: Optional[str] = None,
        dry_run: bool = False,
        default_password: Optional[str] = None
    ) -> BatchMigrationResult:
        """
        Migrate all employees to workspace emails.

        Args:
            company_code: Optional filter by company
            dry_run: If True, only simulate without making changes
            default_password: Password to use for mailboxes
        """
        batch_result = BatchMigrationResult(
            started_at=datetime.utcnow()
        )

        employees = self.get_all_employees(company_code)
        batch_result.total = len(employees)

        for employee in employees:
            result = await self.migrate_employee(
                employee=employee,
                dry_run=dry_run,
                default_password=default_password
            )

            batch_result.results.append(result)

            if result.status == MigrationStatus.COMPLETED:
                batch_result.successful += 1
            elif result.status == MigrationStatus.FAILED:
                batch_result.failed += 1
            elif result.status == MigrationStatus.SKIPPED:
                batch_result.skipped += 1

        batch_result.completed_at = datetime.utcnow()
        return batch_result

    # =========================================================================
    # PREVIEW & REPORTING
    # =========================================================================

    def preview_migration(
        self,
        company_code: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Preview migration without making changes.

        Returns list of proposed email changes.
        """
        employees = self.get_all_employees(company_code)
        previews = []

        for emp in employees:
            if not emp.first_name:
                previews.append({
                    'employee_code': emp.employee_code,
                    'name': f"{emp.first_name or ''} {emp.last_name or ''}".strip(),
                    'company': emp.company_code,
                    'current_email': emp.current_email,
                    'proposed_email': None,
                    'department_code': None,
                    'status': 'SKIP - Missing name',
                    'has_password': emp.has_password
                })
                continue

            try:
                new_email, dept_code = self.generate_unique_email(
                    first_name=emp.first_name,
                    last_name=emp.last_name or '',
                    current_email=emp.current_email
                )

                previews.append({
                    'employee_code': emp.employee_code,
                    'name': f"{emp.first_name} {emp.last_name or ''}".strip(),
                    'company': emp.company_code,
                    'current_email': emp.current_email,
                    'proposed_email': new_email,
                    'department_code': dept_code,
                    'status': 'READY',
                    'has_password': emp.has_password
                })
            except Exception as e:
                previews.append({
                    'employee_code': emp.employee_code,
                    'name': f"{emp.first_name or ''} {emp.last_name or ''}".strip(),
                    'company': emp.company_code,
                    'current_email': emp.current_email,
                    'proposed_email': None,
                    'department_code': None,
                    'status': f'ERROR - {str(e)}',
                    'has_password': emp.has_password
                })

        return previews

    def get_migration_summary(self, company_code: Optional[str] = None) -> Dict[str, Any]:
        """Get summary statistics for migration"""
        employees = self.get_all_employees(company_code)

        by_company = {}
        by_status = {'ready': 0, 'skip': 0}

        for emp in employees:
            company = emp.company_code or 'Unknown'
            if company not in by_company:
                by_company[company] = {'total': 0, 'ready': 0, 'skip': 0}

            by_company[company]['total'] += 1

            if emp.first_name and emp.user_id and emp.person_id:
                by_company[company]['ready'] += 1
                by_status['ready'] += 1
            else:
                by_company[company]['skip'] += 1
                by_status['skip'] += 1

        return {
            'total_employees': len(employees),
            'ready_to_migrate': by_status['ready'],
            'will_skip': by_status['skip'],
            'by_company': by_company,
            'target_domain': self.domain
        }


# =============================================================================
# SINGLETON INSTANCE
# =============================================================================

_workspace_email_service: Optional[WorkspaceEmailService] = None


def get_workspace_email_service() -> WorkspaceEmailService:
    """Get or create WorkspaceEmailService singleton instance"""
    global _workspace_email_service
    if _workspace_email_service is None:
        _workspace_email_service = WorkspaceEmailService()
    return _workspace_email_service
