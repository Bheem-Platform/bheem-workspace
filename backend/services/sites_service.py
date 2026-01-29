"""
Bheem Sites - Service Layer

Business logic for sites/wiki functionality.
Phase 5: Bheem Sites/Wiki
"""

from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import datetime
import re
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, func, or_, and_
from sqlalchemy.orm import selectinload

from models.sites_models import (
    Site, SitePage, SitePageVersion, SiteCollaborator,
    SiteComment, SiteTemplate, SiteMedia,
    SiteVisibility, PageType
)


def slugify(text: str) -> str:
    """Convert text to URL-friendly slug"""
    text = text.lower().strip()
    text = re.sub(r'[^\w\s-]', '', text)
    text = re.sub(r'[-\s]+', '-', text)
    return text[:100]


class SitesService:
    """Service for managing Sites"""

    def __init__(self, db: AsyncSession):
        self.db = db

    # =========================================
    # Site CRUD
    # =========================================

    async def create_site(
        self,
        tenant_id: UUID,
        owner_id: UUID,
        name: str,
        description: Optional[str] = None,
        visibility: SiteVisibility = SiteVisibility.INTERNAL,
        template_id: Optional[UUID] = None
    ) -> Site:
        """Create a new site"""
        # Generate unique slug
        base_slug = slugify(name)
        slug = base_slug
        counter = 1

        while await self._slug_exists(tenant_id, slug):
            slug = f"{base_slug}-{counter}"
            counter += 1

        site = Site(
            tenant_id=tenant_id,
            owner_id=owner_id,
            name=name,
            slug=slug,
            description=description,
            visibility=visibility
        )

        self.db.add(site)
        await self.db.flush()

        # Add owner as collaborator
        collaborator = SiteCollaborator(
            site_id=site.id,
            user_id=owner_id,
            role="owner",
            can_publish=True,
            can_manage_collaborators=True,
            added_by=owner_id
        )
        self.db.add(collaborator)

        # Create homepage
        homepage = SitePage(
            site_id=site.id,
            tenant_id=tenant_id,
            title="Home",
            slug="home",
            page_type=PageType.STANDARD,
            content="<h1>Welcome to your new site</h1><p>Start editing to build your site.</p>",
            is_homepage=True,
            is_draft=False,
            path="/home",
            author_id=owner_id
        )
        self.db.add(homepage)

        # Apply template if provided
        if template_id:
            await self._apply_template(site, template_id, owner_id)

        await self.db.commit()
        await self.db.refresh(site)
        return site

    async def get_site(
        self,
        site_id: UUID,
        user_id: Optional[UUID] = None
    ) -> Optional[Site]:
        """Get a site by ID"""
        query = select(Site).where(Site.id == site_id, Site.is_archived == False)

        if user_id:
            # Check access
            query = query.options(selectinload(Site.collaborators))

        result = await self.db.execute(query)
        site = result.scalar_one_or_none()

        if site and user_id:
            if not await self._can_access_site(site, user_id):
                return None

        return site

    async def get_site_by_slug(
        self,
        tenant_id: UUID,
        slug: str,
        user_id: Optional[UUID] = None
    ) -> Optional[Site]:
        """Get a site by slug"""
        query = select(Site).where(
            Site.tenant_id == tenant_id,
            Site.slug == slug,
            Site.is_archived == False
        )

        result = await self.db.execute(query)
        site = result.scalar_one_or_none()

        if site and user_id:
            if not await self._can_access_site(site, user_id):
                return None

        return site

    async def list_sites(
        self,
        tenant_id: UUID,
        user_id: UUID,
        include_archived: bool = False,
        visibility: Optional[SiteVisibility] = None,
        skip: int = 0,
        limit: int = 50
    ) -> List[Site]:
        """List sites accessible to user"""
        # Sites user owns or collaborates on
        collab_query = select(SiteCollaborator.site_id).where(
            SiteCollaborator.user_id == user_id
        )

        query = select(Site).where(
            Site.tenant_id == tenant_id,
            or_(
                Site.owner_id == user_id,
                Site.id.in_(collab_query),
                Site.visibility == SiteVisibility.INTERNAL,
                Site.visibility == SiteVisibility.PUBLIC
            )
        )

        if not include_archived:
            query = query.where(Site.is_archived == False)

        if visibility:
            query = query.where(Site.visibility == visibility)

        query = query.order_by(Site.updated_at.desc())
        query = query.offset(skip).limit(limit)

        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def update_site(
        self,
        site_id: UUID,
        user_id: UUID,
        updates: Dict[str, Any]
    ) -> Optional[Site]:
        """Update a site"""
        site = await self.get_site(site_id, user_id)
        if not site:
            return None

        if not await self._can_edit_site(site, user_id):
            return None

        # Handle slug change
        if 'name' in updates and 'slug' not in updates:
            new_slug = slugify(updates['name'])
            if new_slug != site.slug:
                if not await self._slug_exists(site.tenant_id, new_slug, site_id):
                    updates['slug'] = new_slug

        allowed_fields = [
            'name', 'slug', 'description', 'logo_url', 'favicon_url',
            'theme_color', 'custom_css', 'visibility', 'allow_comments',
            'allow_search', 'show_navigation', 'show_breadcrumbs', 'navigation'
        ]

        for field in allowed_fields:
            if field in updates:
                setattr(site, field, updates[field])

        site.updated_at = datetime.utcnow()
        await self.db.commit()
        await self.db.refresh(site)
        return site

    async def publish_site(self, site_id: UUID, user_id: UUID) -> bool:
        """Publish a site"""
        site = await self.get_site(site_id, user_id)
        if not site or not await self._can_publish_site(site, user_id):
            return False

        site.is_published = True
        site.published_at = datetime.utcnow()
        await self.db.commit()
        return True

    async def archive_site(self, site_id: UUID, user_id: UUID) -> bool:
        """Archive a site"""
        site = await self.get_site(site_id, user_id)
        if not site or site.owner_id != user_id:
            return False

        site.is_archived = True
        await self.db.commit()
        return True

    async def delete_site(self, site_id: UUID, user_id: UUID) -> bool:
        """Delete a site permanently"""
        site = await self.get_site(site_id, user_id)
        if not site or site.owner_id != user_id:
            return False

        await self.db.delete(site)
        await self.db.commit()
        return True

    # =========================================
    # Page CRUD
    # =========================================

    async def create_page(
        self,
        site_id: UUID,
        user_id: UUID,
        title: str,
        content: Optional[str] = None,
        page_type: PageType = PageType.STANDARD,
        parent_id: Optional[UUID] = None,
        is_draft: bool = True
    ) -> Optional[SitePage]:
        """Create a new page"""
        site = await self.get_site(site_id, user_id)
        if not site or not await self._can_edit_site(site, user_id):
            return None

        # Generate slug
        base_slug = slugify(title)
        slug = base_slug
        counter = 1

        while await self._page_slug_exists(site_id, slug):
            slug = f"{base_slug}-{counter}"
            counter += 1

        # Calculate path and depth
        path = f"/{slug}"
        depth = 0

        if parent_id:
            parent = await self.get_page(parent_id, user_id)
            if parent and parent.site_id == site_id:
                path = f"{parent.path}/{slug}"
                depth = parent.depth + 1

        # Get max order for siblings
        order_query = select(func.max(SitePage.order)).where(
            SitePage.site_id == site_id,
            SitePage.parent_id == parent_id
        )
        result = await self.db.execute(order_query)
        max_order = result.scalar() or 0

        page = SitePage(
            site_id=site_id,
            tenant_id=site.tenant_id,
            title=title,
            slug=slug,
            page_type=page_type,
            content=content or "",
            parent_id=parent_id,
            path=path,
            depth=depth,
            order=max_order + 1,
            is_draft=is_draft,
            author_id=user_id
        )

        self.db.add(page)
        await self.db.commit()
        await self.db.refresh(page)
        return page

    async def get_page(
        self,
        page_id: UUID,
        user_id: Optional[UUID] = None
    ) -> Optional[SitePage]:
        """Get a page by ID"""
        query = select(SitePage).options(
            selectinload(SitePage.site)
        ).where(SitePage.id == page_id)

        result = await self.db.execute(query)
        page = result.scalar_one_or_none()

        if page and user_id:
            if not await self._can_access_site(page.site, user_id):
                return None

        return page

    async def get_page_by_path(
        self,
        site_id: UUID,
        path: str,
        user_id: Optional[UUID] = None
    ) -> Optional[SitePage]:
        """Get a page by path"""
        query = select(SitePage).options(
            selectinload(SitePage.site)
        ).where(
            SitePage.site_id == site_id,
            SitePage.path == path
        )

        result = await self.db.execute(query)
        page = result.scalar_one_or_none()

        if page and user_id:
            if not await self._can_access_site(page.site, user_id):
                return None

        return page

    async def list_pages(
        self,
        site_id: UUID,
        user_id: UUID,
        parent_id: Optional[UUID] = None,
        include_drafts: bool = True
    ) -> List[SitePage]:
        """List pages in a site"""
        site = await self.get_site(site_id, user_id)
        if not site:
            return []

        query = select(SitePage).where(SitePage.site_id == site_id)

        if parent_id is not None:
            query = query.where(SitePage.parent_id == parent_id)

        if not include_drafts:
            query = query.where(SitePage.is_draft == False)

        query = query.order_by(SitePage.order, SitePage.created_at)

        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_page_tree(
        self,
        site_id: UUID,
        user_id: UUID
    ) -> List[Dict]:
        """Get hierarchical page tree"""
        pages = await self.list_pages(site_id, user_id)

        # Build tree structure
        page_map = {page.id: {
            'id': str(page.id),
            'title': page.title,
            'slug': page.slug,
            'path': page.path,
            'is_draft': page.is_draft,
            'is_homepage': page.is_homepage,
            'children': []
        } for page in pages}

        tree = []
        for page in pages:
            node = page_map[page.id]
            if page.parent_id and page.parent_id in page_map:
                page_map[page.parent_id]['children'].append(node)
            else:
                tree.append(node)

        return tree

    async def update_page(
        self,
        page_id: UUID,
        user_id: UUID,
        updates: Dict[str, Any],
        create_version: bool = True
    ) -> Optional[SitePage]:
        """Update a page"""
        page = await self.get_page(page_id, user_id)
        if not page or not await self._can_edit_site(page.site, user_id):
            return None

        # Create version before update
        if create_version and 'content' in updates:
            await self._create_version(page, user_id)

        allowed_fields = [
            'title', 'content', 'content_format', 'excerpt',
            'cover_image_url', 'cover_position', 'page_type',
            'show_title', 'show_toc', 'allow_comments', 'is_draft',
            'meta_title', 'meta_description', 'meta_keywords'
        ]

        for field in allowed_fields:
            if field in updates:
                setattr(page, field, updates[field])

        # Handle slug change
        if 'title' in updates and 'slug' not in updates:
            new_slug = slugify(updates['title'])
            if new_slug != page.slug and not await self._page_slug_exists(page.site_id, new_slug, page_id):
                page.slug = new_slug
                # Update path
                if page.parent_id:
                    parent = await self.get_page(page.parent_id)
                    page.path = f"{parent.path}/{new_slug}" if parent else f"/{new_slug}"
                else:
                    page.path = f"/{new_slug}"

        page.updated_at = datetime.utcnow()
        await self.db.commit()
        await self.db.refresh(page)
        return page

    async def publish_page(self, page_id: UUID, user_id: UUID) -> bool:
        """Publish a page"""
        page = await self.get_page(page_id, user_id)
        if not page or not await self._can_publish_site(page.site, user_id):
            return False

        page.is_draft = False
        page.published_at = datetime.utcnow()
        await self.db.commit()
        return True

    async def delete_page(self, page_id: UUID, user_id: UUID) -> bool:
        """Delete a page"""
        page = await self.get_page(page_id, user_id)
        if not page or not await self._can_edit_site(page.site, user_id):
            return False

        if page.is_homepage:
            return False  # Cannot delete homepage

        await self.db.delete(page)
        await self.db.commit()
        return True

    async def move_page(
        self,
        page_id: UUID,
        user_id: UUID,
        new_parent_id: Optional[UUID],
        new_order: int
    ) -> bool:
        """Move a page in the hierarchy"""
        page = await self.get_page(page_id, user_id)
        if not page or not await self._can_edit_site(page.site, user_id):
            return False

        # Update parent and recalculate path
        page.parent_id = new_parent_id
        page.order = new_order

        if new_parent_id:
            parent = await self.get_page(new_parent_id)
            if parent:
                page.path = f"{parent.path}/{page.slug}"
                page.depth = parent.depth + 1
        else:
            page.path = f"/{page.slug}"
            page.depth = 0

        await self.db.commit()
        return True

    # =========================================
    # Versions
    # =========================================

    async def _create_version(self, page: SitePage, user_id: UUID):
        """Create a new version of a page"""
        # Get next version number
        query = select(func.max(SitePageVersion.version_number)).where(
            SitePageVersion.page_id == page.id
        )
        result = await self.db.execute(query)
        max_version = result.scalar() or 0

        version = SitePageVersion(
            page_id=page.id,
            version_number=max_version + 1,
            title=page.title,
            content=page.content,
            author_id=user_id
        )
        self.db.add(version)

    async def get_page_versions(
        self,
        page_id: UUID,
        user_id: UUID
    ) -> List[SitePageVersion]:
        """Get version history for a page"""
        page = await self.get_page(page_id, user_id)
        if not page:
            return []

        query = select(SitePageVersion).where(
            SitePageVersion.page_id == page_id
        ).order_by(SitePageVersion.version_number.desc())

        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def restore_version(
        self,
        page_id: UUID,
        version_id: UUID,
        user_id: UUID
    ) -> bool:
        """Restore a page to a previous version"""
        page = await self.get_page(page_id, user_id)
        if not page or not await self._can_edit_site(page.site, user_id):
            return False

        query = select(SitePageVersion).where(
            SitePageVersion.id == version_id,
            SitePageVersion.page_id == page_id
        )
        result = await self.db.execute(query)
        version = result.scalar_one_or_none()

        if not version:
            return False

        # Create version of current state
        await self._create_version(page, user_id)

        # Restore
        page.title = version.title
        page.content = version.content
        page.updated_at = datetime.utcnow()

        await self.db.commit()
        return True

    # =========================================
    # Collaborators
    # =========================================

    async def add_collaborator(
        self,
        site_id: UUID,
        user_id: UUID,
        collaborator_user_id: UUID,
        role: str = "editor",
        added_by: UUID = None
    ) -> Optional[SiteCollaborator]:
        """Add a collaborator to a site"""
        site = await self.get_site(site_id, user_id)
        if not site or not await self._can_manage_collaborators(site, user_id):
            return None

        # Check if already a collaborator
        existing = await self.db.execute(
            select(SiteCollaborator).where(
                SiteCollaborator.site_id == site_id,
                SiteCollaborator.user_id == collaborator_user_id
            )
        )
        if existing.scalar_one_or_none():
            return None

        collaborator = SiteCollaborator(
            site_id=site_id,
            user_id=collaborator_user_id,
            role=role,
            can_publish=role in ['owner', 'editor'],
            can_manage_collaborators=role == 'owner',
            added_by=added_by or user_id
        )

        self.db.add(collaborator)
        await self.db.commit()
        await self.db.refresh(collaborator)
        return collaborator

    async def remove_collaborator(
        self,
        site_id: UUID,
        user_id: UUID,
        collaborator_user_id: UUID
    ) -> bool:
        """Remove a collaborator from a site"""
        site = await self.get_site(site_id, user_id)
        if not site or not await self._can_manage_collaborators(site, user_id):
            return False

        # Cannot remove owner
        if collaborator_user_id == site.owner_id:
            return False

        result = await self.db.execute(
            delete(SiteCollaborator).where(
                SiteCollaborator.site_id == site_id,
                SiteCollaborator.user_id == collaborator_user_id
            )
        )
        await self.db.commit()
        return result.rowcount > 0

    async def list_collaborators(
        self,
        site_id: UUID,
        user_id: UUID
    ) -> List[SiteCollaborator]:
        """List collaborators on a site"""
        site = await self.get_site(site_id, user_id)
        if not site:
            return []

        query = select(SiteCollaborator).where(
            SiteCollaborator.site_id == site_id
        )
        result = await self.db.execute(query)
        return list(result.scalars().all())

    # =========================================
    # Comments
    # =========================================

    async def add_comment(
        self,
        page_id: UUID,
        user_id: UUID,
        content: str,
        author_name: str,
        parent_id: Optional[UUID] = None
    ) -> Optional[SiteComment]:
        """Add a comment to a page"""
        page = await self.get_page(page_id, user_id)
        if not page or not page.allow_comments:
            return None

        comment = SiteComment(
            page_id=page_id,
            tenant_id=page.tenant_id,
            content=content,
            author_id=user_id,
            author_name=author_name,
            parent_id=parent_id
        )

        self.db.add(comment)
        await self.db.commit()
        await self.db.refresh(comment)
        return comment

    async def list_comments(
        self,
        page_id: UUID,
        user_id: UUID
    ) -> List[SiteComment]:
        """List comments on a page"""
        page = await self.get_page(page_id, user_id)
        if not page:
            return []

        query = select(SiteComment).where(
            SiteComment.page_id == page_id,
            SiteComment.parent_id == None
        ).order_by(SiteComment.created_at)

        result = await self.db.execute(query)
        return list(result.scalars().all())

    # =========================================
    # Templates
    # =========================================

    async def list_templates(
        self,
        tenant_id: Optional[UUID] = None,
        category: Optional[str] = None
    ) -> List[SiteTemplate]:
        """List available templates"""
        query = select(SiteTemplate).where(
            or_(
                SiteTemplate.is_system == True,
                SiteTemplate.is_public == True,
                SiteTemplate.tenant_id == tenant_id
            )
        )

        if category:
            query = query.where(SiteTemplate.category == category)

        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def _apply_template(
        self,
        site: Site,
        template_id: UUID,
        user_id: UUID
    ):
        """Apply a template to a site"""
        query = select(SiteTemplate).where(SiteTemplate.id == template_id)
        result = await self.db.execute(query)
        template = result.scalar_one_or_none()

        if not template:
            return

        # Apply theme settings
        if template.theme_settings:
            site.theme_color = template.theme_settings.get('theme_color', site.theme_color)
            site.custom_css = template.theme_settings.get('custom_css', '')

        # Create pages from structure
        if template.structure:
            for page_def in template.structure:
                await self._create_page_from_template(
                    site, page_def, user_id, template.default_content
                )

    async def _create_page_from_template(
        self,
        site: Site,
        page_def: Dict,
        user_id: UUID,
        default_content: Optional[Dict],
        parent_id: Optional[UUID] = None
    ):
        """Create a page from template definition"""
        content = ""
        if default_content and page_def.get('content_key'):
            content = default_content.get(page_def['content_key'], "")

        page = SitePage(
            site_id=site.id,
            tenant_id=site.tenant_id,
            title=page_def.get('title', 'Untitled'),
            slug=slugify(page_def.get('title', 'untitled')),
            page_type=PageType(page_def.get('type', 'standard')),
            content=content,
            parent_id=parent_id,
            is_draft=False,
            author_id=user_id
        )
        self.db.add(page)
        await self.db.flush()

        # Create children
        for child in page_def.get('children', []):
            await self._create_page_from_template(
                site, child, user_id, default_content, page.id
            )

    # =========================================
    # Helper Methods
    # =========================================

    async def _slug_exists(
        self,
        tenant_id: UUID,
        slug: str,
        exclude_id: Optional[UUID] = None
    ) -> bool:
        """Check if a site slug exists"""
        query = select(Site.id).where(
            Site.tenant_id == tenant_id,
            Site.slug == slug
        )
        if exclude_id:
            query = query.where(Site.id != exclude_id)

        result = await self.db.execute(query)
        return result.scalar_one_or_none() is not None

    async def _page_slug_exists(
        self,
        site_id: UUID,
        slug: str,
        exclude_id: Optional[UUID] = None
    ) -> bool:
        """Check if a page slug exists in a site"""
        query = select(SitePage.id).where(
            SitePage.site_id == site_id,
            SitePage.slug == slug
        )
        if exclude_id:
            query = query.where(SitePage.id != exclude_id)

        result = await self.db.execute(query)
        return result.scalar_one_or_none() is not None

    async def _can_access_site(self, site: Site, user_id: UUID) -> bool:
        """Check if user can access a site"""
        if site.visibility == SiteVisibility.PUBLIC:
            return True
        if site.visibility == SiteVisibility.INTERNAL:
            return True  # Same tenant assumed
        if site.owner_id == user_id:
            return True

        # Check collaborator
        query = select(SiteCollaborator.id).where(
            SiteCollaborator.site_id == site.id,
            SiteCollaborator.user_id == user_id
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none() is not None

    async def _can_edit_site(self, site: Site, user_id: UUID) -> bool:
        """Check if user can edit a site"""
        if site.owner_id == user_id:
            return True

        query = select(SiteCollaborator).where(
            SiteCollaborator.site_id == site.id,
            SiteCollaborator.user_id == user_id,
            SiteCollaborator.role.in_(['owner', 'editor'])
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none() is not None

    async def _can_publish_site(self, site: Site, user_id: UUID) -> bool:
        """Check if user can publish a site"""
        if site.owner_id == user_id:
            return True

        query = select(SiteCollaborator).where(
            SiteCollaborator.site_id == site.id,
            SiteCollaborator.user_id == user_id,
            SiteCollaborator.can_publish == True
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none() is not None

    async def _can_manage_collaborators(self, site: Site, user_id: UUID) -> bool:
        """Check if user can manage collaborators"""
        if site.owner_id == user_id:
            return True

        query = select(SiteCollaborator).where(
            SiteCollaborator.site_id == site.id,
            SiteCollaborator.user_id == user_id,
            SiteCollaborator.can_manage_collaborators == True
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none() is not None

    async def increment_view_count(self, page_id: UUID):
        """Increment page view count"""
        await self.db.execute(
            update(SitePage)
            .where(SitePage.id == page_id)
            .values(view_count=SitePage.view_count + 1)
        )
        await self.db.commit()
