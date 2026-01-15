"""
Bheem Sheets Service
====================
Business logic for spreadsheet operations.
Handles CRUD, worksheets, cell updates, sharing, and formula evaluation.
"""
from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import datetime
import logging
import re
import json

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, and_, or_, func
from sqlalchemy.orm import selectinload

from models.productivity_models import (
    Spreadsheet,
    Worksheet,
    SpreadsheetShare,
    ProductivityTemplate
)

logger = logging.getLogger(__name__)


class SheetsService:
    """Service class for Bheem Sheets operations"""

    # =============================================
    # Spreadsheet CRUD
    # =============================================

    async def create_spreadsheet(
        self,
        db: AsyncSession,
        tenant_id: UUID,
        user_id: UUID,
        title: str,
        description: Optional[str] = None,
        folder_id: Optional[UUID] = None,
        template_id: Optional[UUID] = None
    ) -> Spreadsheet:
        """Create a new spreadsheet with initial worksheet"""

        # Create spreadsheet
        spreadsheet = Spreadsheet(
            tenant_id=tenant_id,
            title=title,
            description=description,
            folder_id=folder_id,
            created_by=user_id
        )
        db.add(spreadsheet)
        await db.flush()  # Get the ID

        # Create initial worksheet
        initial_data = {}

        # If template provided, load template data
        if template_id:
            template = await self._get_template(db, template_id, 'spreadsheet')
            if template and template.content:
                worksheets_data = template.content.get('worksheets', [])
                if worksheets_data:
                    for idx, ws_data in enumerate(worksheets_data):
                        worksheet = Worksheet(
                            spreadsheet_id=spreadsheet.id,
                            name=ws_data.get('name', f'Sheet{idx + 1}'),
                            sheet_index=idx,
                            data=ws_data.get('cells', {})
                        )
                        db.add(worksheet)
                    # Increment template use count
                    template.use_count = (template.use_count or 0) + 1
        else:
            # Create default empty worksheet
            worksheet = Worksheet(
                spreadsheet_id=spreadsheet.id,
                name='Sheet1',
                sheet_index=0,
                data={}
            )
            db.add(worksheet)

        await db.commit()
        await db.refresh(spreadsheet)

        logger.info(f"Created spreadsheet {spreadsheet.id} for tenant {tenant_id}")
        return spreadsheet

    async def get_spreadsheet(
        self,
        db: AsyncSession,
        spreadsheet_id: UUID,
        user_id: UUID,
        include_worksheets: bool = True
    ) -> Optional[Spreadsheet]:
        """Get a spreadsheet by ID with access check"""

        query = select(Spreadsheet).where(
            and_(
                Spreadsheet.id == spreadsheet_id,
                Spreadsheet.is_deleted == False
            )
        )

        if include_worksheets:
            query = query.options(selectinload(Spreadsheet.worksheets))

        result = await db.execute(query)
        spreadsheet = result.scalar_one_or_none()

        if not spreadsheet:
            return None

        # Check access (owner or shared)
        if spreadsheet.created_by != user_id:
            has_access = await self._check_access(db, spreadsheet_id, user_id)
            if not has_access:
                return None

        return spreadsheet

    async def list_spreadsheets(
        self,
        db: AsyncSession,
        tenant_id: UUID,
        user_id: UUID,
        folder_id: Optional[UUID] = None,
        starred: Optional[bool] = None,
        search: Optional[str] = None,
        include_deleted: bool = False,
        skip: int = 0,
        limit: int = 50
    ) -> tuple[List[Spreadsheet], int]:
        """List spreadsheets for a user (owned + shared)"""

        # Base query for owned spreadsheets
        owned_query = select(Spreadsheet).where(
            and_(
                Spreadsheet.tenant_id == tenant_id,
                Spreadsheet.created_by == user_id
            )
        )

        # Get shared spreadsheet IDs
        shared_query = select(SpreadsheetShare.spreadsheet_id).where(
            SpreadsheetShare.user_id == user_id
        )
        shared_result = await db.execute(shared_query)
        shared_ids = [row[0] for row in shared_result.fetchall()]

        # Combine owned and shared
        if shared_ids:
            query = select(Spreadsheet).where(
                and_(
                    Spreadsheet.tenant_id == tenant_id,
                    or_(
                        Spreadsheet.created_by == user_id,
                        Spreadsheet.id.in_(shared_ids)
                    )
                )
            )
        else:
            query = owned_query

        # Apply filters
        if not include_deleted:
            query = query.where(Spreadsheet.is_deleted == False)

        if folder_id:
            query = query.where(Spreadsheet.folder_id == folder_id)

        if starred is not None:
            query = query.where(Spreadsheet.is_starred == starred)

        if search:
            query = query.where(Spreadsheet.title.ilike(f'%{search}%'))

        # Get total count
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await db.execute(count_query)
        total = total_result.scalar()

        # Apply pagination and sorting
        query = query.order_by(Spreadsheet.updated_at.desc())
        query = query.offset(skip).limit(limit)
        query = query.options(selectinload(Spreadsheet.worksheets))

        result = await db.execute(query)
        spreadsheets = result.scalars().all()

        return list(spreadsheets), total

    async def update_spreadsheet(
        self,
        db: AsyncSession,
        spreadsheet_id: UUID,
        user_id: UUID,
        title: Optional[str] = None,
        description: Optional[str] = None,
        folder_id: Optional[UUID] = None
    ) -> Optional[Spreadsheet]:
        """Update spreadsheet metadata"""

        spreadsheet = await self.get_spreadsheet(db, spreadsheet_id, user_id, include_worksheets=False)
        if not spreadsheet:
            return None

        # Check edit permission
        if spreadsheet.created_by != user_id:
            permission = await self._get_permission(db, spreadsheet_id, user_id)
            if permission != 'edit':
                return None

        if title is not None:
            spreadsheet.title = title
        if description is not None:
            spreadsheet.description = description
        if folder_id is not None:
            spreadsheet.folder_id = folder_id

        spreadsheet.updated_at = datetime.utcnow()
        await db.commit()
        await db.refresh(spreadsheet)

        return spreadsheet

    async def delete_spreadsheet(
        self,
        db: AsyncSession,
        spreadsheet_id: UUID,
        user_id: UUID,
        permanent: bool = False
    ) -> bool:
        """Delete a spreadsheet (soft or permanent)"""

        spreadsheet = await self.get_spreadsheet(db, spreadsheet_id, user_id, include_worksheets=False)
        if not spreadsheet or spreadsheet.created_by != user_id:
            return False

        if permanent:
            await db.delete(spreadsheet)
        else:
            spreadsheet.is_deleted = True
            spreadsheet.deleted_at = datetime.utcnow()

        await db.commit()
        logger.info(f"Deleted spreadsheet {spreadsheet_id} (permanent={permanent})")
        return True

    async def restore_spreadsheet(
        self,
        db: AsyncSession,
        spreadsheet_id: UUID,
        user_id: UUID
    ) -> Optional[Spreadsheet]:
        """Restore a soft-deleted spreadsheet"""

        query = select(Spreadsheet).where(
            and_(
                Spreadsheet.id == spreadsheet_id,
                Spreadsheet.created_by == user_id,
                Spreadsheet.is_deleted == True
            )
        )
        result = await db.execute(query)
        spreadsheet = result.scalar_one_or_none()

        if not spreadsheet:
            return None

        spreadsheet.is_deleted = False
        spreadsheet.deleted_at = None
        await db.commit()
        await db.refresh(spreadsheet)

        return spreadsheet

    async def toggle_star(
        self,
        db: AsyncSession,
        spreadsheet_id: UUID,
        user_id: UUID
    ) -> Optional[bool]:
        """Toggle starred status"""

        spreadsheet = await self.get_spreadsheet(db, spreadsheet_id, user_id, include_worksheets=False)
        if not spreadsheet:
            return None

        spreadsheet.is_starred = not spreadsheet.is_starred
        await db.commit()

        return spreadsheet.is_starred

    async def duplicate_spreadsheet(
        self,
        db: AsyncSession,
        spreadsheet_id: UUID,
        user_id: UUID,
        new_title: Optional[str] = None
    ) -> Optional[Spreadsheet]:
        """Duplicate a spreadsheet with all worksheets"""

        original = await self.get_spreadsheet(db, spreadsheet_id, user_id, include_worksheets=True)
        if not original:
            return None

        # Create copy
        new_spreadsheet = Spreadsheet(
            tenant_id=original.tenant_id,
            title=new_title or f"Copy of {original.title}",
            description=original.description,
            folder_id=original.folder_id,
            created_by=user_id
        )
        db.add(new_spreadsheet)
        await db.flush()

        # Copy worksheets
        for ws in original.worksheets:
            new_worksheet = Worksheet(
                spreadsheet_id=new_spreadsheet.id,
                name=ws.name,
                sheet_index=ws.sheet_index,
                data=ws.data.copy() if ws.data else {},
                row_count=ws.row_count,
                column_count=ws.column_count,
                color=ws.color,
                frozen_rows=ws.frozen_rows,
                frozen_columns=ws.frozen_columns
            )
            db.add(new_worksheet)

        await db.commit()
        await db.refresh(new_spreadsheet)

        logger.info(f"Duplicated spreadsheet {spreadsheet_id} to {new_spreadsheet.id}")
        return new_spreadsheet

    # =============================================
    # Worksheet Operations
    # =============================================

    async def add_worksheet(
        self,
        db: AsyncSession,
        spreadsheet_id: UUID,
        user_id: UUID,
        name: str,
        after_index: Optional[int] = None
    ) -> Optional[Worksheet]:
        """Add a new worksheet to a spreadsheet"""

        spreadsheet = await self.get_spreadsheet(db, spreadsheet_id, user_id, include_worksheets=True)
        if not spreadsheet:
            return None

        # Determine index
        max_index = max([ws.sheet_index for ws in spreadsheet.worksheets], default=-1)
        if after_index is not None and after_index < max_index:
            new_index = after_index + 1
            # Shift existing worksheets
            for ws in spreadsheet.worksheets:
                if ws.sheet_index >= new_index:
                    ws.sheet_index += 1
        else:
            new_index = max_index + 1

        worksheet = Worksheet(
            spreadsheet_id=spreadsheet_id,
            name=name,
            sheet_index=new_index,
            data={}
        )
        db.add(worksheet)

        spreadsheet.updated_at = datetime.utcnow()
        await db.commit()
        await db.refresh(worksheet)

        return worksheet

    async def update_worksheet(
        self,
        db: AsyncSession,
        spreadsheet_id: UUID,
        worksheet_id: UUID,
        user_id: UUID,
        name: Optional[str] = None,
        color: Optional[str] = None,
        is_hidden: Optional[bool] = None
    ) -> Optional[Worksheet]:
        """Update worksheet properties"""

        spreadsheet = await self.get_spreadsheet(db, spreadsheet_id, user_id, include_worksheets=False)
        if not spreadsheet:
            return None

        query = select(Worksheet).where(
            and_(
                Worksheet.id == worksheet_id,
                Worksheet.spreadsheet_id == spreadsheet_id
            )
        )
        result = await db.execute(query)
        worksheet = result.scalar_one_or_none()

        if not worksheet:
            return None

        if name is not None:
            worksheet.name = name
        if color is not None:
            worksheet.color = color
        if is_hidden is not None:
            worksheet.is_hidden = is_hidden

        worksheet.updated_at = datetime.utcnow()
        spreadsheet.updated_at = datetime.utcnow()
        await db.commit()
        await db.refresh(worksheet)

        return worksheet

    async def delete_worksheet(
        self,
        db: AsyncSession,
        spreadsheet_id: UUID,
        worksheet_id: UUID,
        user_id: UUID
    ) -> bool:
        """Delete a worksheet"""

        spreadsheet = await self.get_spreadsheet(db, spreadsheet_id, user_id, include_worksheets=True)
        if not spreadsheet:
            return False

        # Must have at least one worksheet
        if len(spreadsheet.worksheets) <= 1:
            return False

        worksheet = next((ws for ws in spreadsheet.worksheets if ws.id == worksheet_id), None)
        if not worksheet:
            return False

        deleted_index = worksheet.sheet_index
        await db.delete(worksheet)

        # Reindex remaining worksheets
        for ws in spreadsheet.worksheets:
            if ws.id != worksheet_id and ws.sheet_index > deleted_index:
                ws.sheet_index -= 1

        spreadsheet.updated_at = datetime.utcnow()
        await db.commit()

        return True

    # =============================================
    # Cell Operations
    # =============================================

    async def update_cells(
        self,
        db: AsyncSession,
        spreadsheet_id: UUID,
        worksheet_id: UUID,
        user_id: UUID,
        updates: List[Dict[str, Any]]
    ) -> Optional[Dict[str, Any]]:
        """
        Update multiple cells in a worksheet.

        updates format: [{"cell": "A1", "value": "Hello", "formula": "=SUM(B1:B10)"}, ...]
        """

        spreadsheet = await self.get_spreadsheet(db, spreadsheet_id, user_id, include_worksheets=False)
        if not spreadsheet:
            return None

        query = select(Worksheet).where(
            and_(
                Worksheet.id == worksheet_id,
                Worksheet.spreadsheet_id == spreadsheet_id
            )
        )
        result = await db.execute(query)
        worksheet = result.scalar_one_or_none()

        if not worksheet:
            return None

        # Get current data
        data = dict(worksheet.data) if worksheet.data else {}

        # Process updates
        results = {}
        for update in updates:
            cell_ref = update.get('cell', '').upper()
            if not self._is_valid_cell_ref(cell_ref):
                continue

            value = update.get('value')
            formula = update.get('formula')
            cell_format = update.get('format', {})

            # Calculate formula if provided
            calculated_value = value
            if formula and formula.startswith('='):
                calculated_value = self._evaluate_formula(formula, data)

            # Store cell data
            data[cell_ref] = {
                'value': calculated_value,
                'formula': formula,
                'format': cell_format
            }

            results[cell_ref] = {
                'value': calculated_value,
                'formula': formula
            }

        # Update worksheet
        worksheet.data = data
        worksheet.updated_at = datetime.utcnow()
        spreadsheet.updated_at = datetime.utcnow()

        await db.commit()

        return {
            'updated_cells': len(results),
            'cells': results
        }

    def _is_valid_cell_ref(self, cell_ref: str) -> bool:
        """Validate cell reference format (e.g., A1, BC123)"""
        pattern = r'^[A-Z]{1,3}[1-9][0-9]*$'
        return bool(re.match(pattern, cell_ref))

    def _evaluate_formula(self, formula: str, data: Dict[str, Any]) -> Any:
        """
        Basic formula evaluation.
        Supports: SUM, AVERAGE, COUNT, MIN, MAX, basic arithmetic
        """
        if not formula or not formula.startswith('='):
            return formula

        formula_body = formula[1:].strip().upper()

        try:
            # Handle SUM function
            sum_match = re.match(r'SUM\(([A-Z]+\d+):([A-Z]+\d+)\)', formula_body)
            if sum_match:
                values = self._get_range_values(sum_match.group(1), sum_match.group(2), data)
                return sum(v for v in values if isinstance(v, (int, float)))

            # Handle AVERAGE function
            avg_match = re.match(r'AVERAGE\(([A-Z]+\d+):([A-Z]+\d+)\)', formula_body)
            if avg_match:
                values = self._get_range_values(avg_match.group(1), avg_match.group(2), data)
                numeric = [v for v in values if isinstance(v, (int, float))]
                return sum(numeric) / len(numeric) if numeric else 0

            # Handle COUNT function
            count_match = re.match(r'COUNT\(([A-Z]+\d+):([A-Z]+\d+)\)', formula_body)
            if count_match:
                values = self._get_range_values(count_match.group(1), count_match.group(2), data)
                return len([v for v in values if v is not None and v != ''])

            # Handle MIN function
            min_match = re.match(r'MIN\(([A-Z]+\d+):([A-Z]+\d+)\)', formula_body)
            if min_match:
                values = self._get_range_values(min_match.group(1), min_match.group(2), data)
                numeric = [v for v in values if isinstance(v, (int, float))]
                return min(numeric) if numeric else 0

            # Handle MAX function
            max_match = re.match(r'MAX\(([A-Z]+\d+):([A-Z]+\d+)\)', formula_body)
            if max_match:
                values = self._get_range_values(max_match.group(1), max_match.group(2), data)
                numeric = [v for v in values if isinstance(v, (int, float))]
                return max(numeric) if numeric else 0

            # For simple cell references or arithmetic, return the formula as-is for now
            return formula

        except Exception as e:
            logger.warning(f"Formula evaluation error: {e}")
            return f"#ERROR: {str(e)}"

    def _get_range_values(self, start_ref: str, end_ref: str, data: Dict[str, Any]) -> List[Any]:
        """Get all values in a cell range"""
        values = []

        start_col = re.match(r'([A-Z]+)', start_ref).group(1)
        start_row = int(re.match(r'[A-Z]+(\d+)', start_ref).group(1))
        end_col = re.match(r'([A-Z]+)', end_ref).group(1)
        end_row = int(re.match(r'[A-Z]+(\d+)', end_ref).group(1))

        # Convert column letters to numbers
        def col_to_num(col: str) -> int:
            num = 0
            for c in col:
                num = num * 26 + (ord(c) - ord('A') + 1)
            return num

        def num_to_col(num: int) -> str:
            result = ''
            while num > 0:
                num -= 1
                result = chr(num % 26 + ord('A')) + result
                num //= 26
            return result

        start_col_num = col_to_num(start_col)
        end_col_num = col_to_num(end_col)

        for row in range(start_row, end_row + 1):
            for col_num in range(start_col_num, end_col_num + 1):
                col = num_to_col(col_num)
                cell_ref = f"{col}{row}"
                cell_data = data.get(cell_ref, {})
                value = cell_data.get('value') if isinstance(cell_data, dict) else cell_data
                if value is not None:
                    # Try to convert to number
                    try:
                        value = float(value) if '.' in str(value) else int(value)
                    except (ValueError, TypeError):
                        pass
                    values.append(value)

        return values

    # =============================================
    # Sharing
    # =============================================

    async def share_spreadsheet(
        self,
        db: AsyncSession,
        spreadsheet_id: UUID,
        owner_id: UUID,
        user_id: UUID,
        permission: str = 'view'
    ) -> Optional[SpreadsheetShare]:
        """Share a spreadsheet with a user"""

        spreadsheet = await self.get_spreadsheet(db, spreadsheet_id, owner_id, include_worksheets=False)
        if not spreadsheet or spreadsheet.created_by != owner_id:
            return None

        if permission not in ['view', 'comment', 'edit']:
            return None

        # Check if already shared
        query = select(SpreadsheetShare).where(
            and_(
                SpreadsheetShare.spreadsheet_id == spreadsheet_id,
                SpreadsheetShare.user_id == user_id
            )
        )
        result = await db.execute(query)
        existing = result.scalar_one_or_none()

        if existing:
            existing.permission = permission
            await db.commit()
            return existing

        share = SpreadsheetShare(
            spreadsheet_id=spreadsheet_id,
            user_id=user_id,
            permission=permission,
            created_by=owner_id
        )
        db.add(share)
        await db.commit()
        await db.refresh(share)

        logger.info(f"Shared spreadsheet {spreadsheet_id} with user {user_id}")
        return share

    async def remove_share(
        self,
        db: AsyncSession,
        spreadsheet_id: UUID,
        owner_id: UUID,
        user_id: UUID
    ) -> bool:
        """Remove sharing for a user"""

        spreadsheet = await self.get_spreadsheet(db, spreadsheet_id, owner_id, include_worksheets=False)
        if not spreadsheet or spreadsheet.created_by != owner_id:
            return False

        query = delete(SpreadsheetShare).where(
            and_(
                SpreadsheetShare.spreadsheet_id == spreadsheet_id,
                SpreadsheetShare.user_id == user_id
            )
        )
        await db.execute(query)
        await db.commit()

        return True

    async def get_shares(
        self,
        db: AsyncSession,
        spreadsheet_id: UUID,
        user_id: UUID
    ) -> List[SpreadsheetShare]:
        """Get all shares for a spreadsheet"""

        spreadsheet = await self.get_spreadsheet(db, spreadsheet_id, user_id, include_worksheets=False)
        if not spreadsheet:
            return []

        query = select(SpreadsheetShare).where(
            SpreadsheetShare.spreadsheet_id == spreadsheet_id
        )
        result = await db.execute(query)
        return list(result.scalars().all())

    # =============================================
    # Helper Methods
    # =============================================

    async def _check_access(
        self,
        db: AsyncSession,
        spreadsheet_id: UUID,
        user_id: UUID
    ) -> bool:
        """Check if user has any access to spreadsheet"""
        query = select(SpreadsheetShare).where(
            and_(
                SpreadsheetShare.spreadsheet_id == spreadsheet_id,
                SpreadsheetShare.user_id == user_id
            )
        )
        result = await db.execute(query)
        return result.scalar_one_or_none() is not None

    async def _get_permission(
        self,
        db: AsyncSession,
        spreadsheet_id: UUID,
        user_id: UUID
    ) -> Optional[str]:
        """Get user's permission level for a spreadsheet"""
        query = select(SpreadsheetShare.permission).where(
            and_(
                SpreadsheetShare.spreadsheet_id == spreadsheet_id,
                SpreadsheetShare.user_id == user_id
            )
        )
        result = await db.execute(query)
        row = result.first()
        return row[0] if row else None

    async def _get_template(
        self,
        db: AsyncSession,
        template_id: UUID,
        template_type: str
    ) -> Optional[ProductivityTemplate]:
        """Get a template by ID"""
        query = select(ProductivityTemplate).where(
            and_(
                ProductivityTemplate.id == template_id,
                ProductivityTemplate.template_type == template_type
            )
        )
        result = await db.execute(query)
        return result.scalar_one_or_none()


# Singleton instance
sheets_service = SheetsService()
