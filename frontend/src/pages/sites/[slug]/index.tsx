/**
 * Bheem Sites - Site Viewer Page
 *
 * Displays a site with navigation and page content.
 * Phase 5: Bheem Sites/Wiki
 */

import React from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  Menu,
  ChevronRight,
  ChevronDown,
  Edit,
  Plus,
  Settings,
  Eye,
  FileText,
  Home,
  Search,
  ArrowLeft,
} from 'lucide-react';
import WorkspaceLayout from '@/components/workspace/WorkspaceLayout';
import { useSitesStore } from '@/stores/sitesStore';
import type { PageTreeNode, SitePage } from '@/lib/sitesApi';

export default function SiteViewerPage() {
  const router = useRouter();
  const { slug, page: pagePath } = router.query;

  const {
    currentSite,
    pageTree,
    currentPage,
    loading,
    error,
    sidebarOpen,
    editMode,
    fetchSiteBySlug,
    fetchPageTree,
    fetchPage,
    fetchPageByPath,
    createPage,
    toggleSidebar,
    setEditMode,
    clearCurrentSite,
    clearError,
  } = useSitesStore();

  const [expandedNodes, setExpandedNodes] = React.useState<Set<string>>(new Set());
  const [showNewPageModal, setShowNewPageModal] = React.useState(false);
  const [newPageTitle, setNewPageTitle] = React.useState('');
  const [newPageParentId, setNewPageParentId] = React.useState<string | undefined>();

  // Fetch site on mount
  React.useEffect(() => {
    if (typeof slug === 'string') {
      fetchSiteBySlug(slug);
    }

    return () => {
      clearCurrentSite();
    };
  }, [slug]);

  // Fetch page tree when site loads
  React.useEffect(() => {
    if (currentSite) {
      fetchPageTree(currentSite.id);
    }
  }, [currentSite?.id]);

  // Fetch current page
  React.useEffect(() => {
    if (currentSite && pageTree.length > 0) {
      if (pagePath) {
        const path = Array.isArray(pagePath) ? `/${pagePath.join('/')}` : `/${pagePath}`;
        fetchPageByPath(currentSite.id, path);
      } else {
        // Find homepage
        const homepage = findHomepage(pageTree);
        if (homepage) {
          fetchPage(currentSite.id, homepage.id);
        }
      }
    }
  }, [currentSite?.id, pageTree, pagePath]);

  const findHomepage = (nodes: PageTreeNode[]): PageTreeNode | null => {
    for (const node of nodes) {
      if (node.is_homepage) return node;
      const found = findHomepage(node.children);
      if (found) return found;
    }
    return nodes[0] || null;
  };

  const toggleNode = (nodeId: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId);
    } else {
      newExpanded.add(nodeId);
    }
    setExpandedNodes(newExpanded);
  };

  const handleCreatePage = async () => {
    if (!currentSite || !newPageTitle.trim()) return;

    const page = await createPage(currentSite.id, {
      title: newPageTitle.trim(),
      parent_id: newPageParentId,
    });

    if (page) {
      setShowNewPageModal(false);
      setNewPageTitle('');
      setNewPageParentId(undefined);
      router.push(`/sites/${slug}/${page.slug}`);
    }
  };

  if (loading.sites || !currentSite) {
    return (
      <WorkspaceLayout title="Sites">
        <div className="flex items-center justify-center h-full">
          <div className="w-8 h-8 border-4 border-[#977DFF] border-t-[#0033FF] rounded-full animate-spin" />
        </div>
      </WorkspaceLayout>
    );
  }

  return (
    <WorkspaceLayout title="Sites">
      <Head>
        <title>{currentPage?.title || currentSite.name} - Bheem Sites</title>
      </Head>

      <div className="h-full flex flex-col">
        {/* Site Header */}
        <header
          className="flex items-center justify-between px-4 py-3 border-b bg-gradient-to-r from-[#FFCCF2]/20 via-[#977DFF]/10 to-[#0033FF]/10"
        >
          <div className="flex items-center gap-3">
            <Link
              href="/sites"
              className="p-2 rounded-lg hover:bg-white/50 text-gray-600 hover:text-gray-900"
              title="Back to Sites"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>

            <button
              onClick={toggleSidebar}
              className="p-2 rounded-lg hover:bg-white/50 lg:hidden"
            >
              <Menu className="w-5 h-5" />
            </button>

            <Link href={`/sites/${slug}`} className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded flex items-center justify-center text-white font-bold text-sm"
                style={{ backgroundColor: currentSite.theme_color || '#0033FF' }}
              >
                {currentSite.logo_url ? (
                  <img src={currentSite.logo_url} alt="" className="w-5 h-5" />
                ) : (
                  currentSite.name.charAt(0)
                )}
              </div>
              <span className="font-semibold text-gray-900">{currentSite.name}</span>
            </Link>
          </div>

          <div className="flex items-center gap-2">
            {currentSite.allow_search && (
              <button className="p-2 rounded-lg hover:bg-white/50">
                <Search className="w-5 h-5" />
              </button>
            )}

            <button
              onClick={() => setEditMode(!editMode)}
              className={`p-2 rounded-lg ${editMode ? 'bg-[#977DFF]/20 text-[#0033FF]' : 'hover:bg-white/50'}`}
            >
              <Edit className="w-5 h-5" />
            </button>

            <Link
              href={`/sites/${slug}/settings`}
              className="p-2 rounded-lg hover:bg-white/50"
            >
              <Settings className="w-5 h-5" />
            </Link>
          </div>
        </header>

        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar */}
          {currentSite.show_navigation && (
            <aside
              className={`
                w-64 bg-white border-r flex-shrink-0 overflow-y-auto
                ${sidebarOpen ? 'block' : 'hidden lg:block'}
              `}
            >
              <div className="p-4">
                {/* New page button */}
                {editMode && (
                  <button
                    onClick={() => setShowNewPageModal(true)}
                    className="w-full flex items-center gap-2 px-3 py-2 mb-4 text-sm text-[#0033FF] border border-[#977DFF]/30 rounded-lg hover:bg-[#FFCCF2]/20"
                  >
                    <Plus className="w-4 h-4" />
                    New Page
                  </button>
                )}

                {/* Page tree */}
                <nav className="space-y-1">
                  {pageTree.map((node) => (
                    <TreeNode
                      key={node.id}
                      node={node}
                      slug={slug as string}
                      currentPageId={currentPage?.id}
                      expanded={expandedNodes}
                      onToggle={toggleNode}
                      editMode={editMode}
                      onAddChild={(parentId) => {
                        setNewPageParentId(parentId);
                        setShowNewPageModal(true);
                      }}
                    />
                  ))}
                </nav>
              </div>
            </aside>
          )}

          {/* Main content */}
          <main className="flex-1 overflow-y-auto bg-gray-50">
            {error && (
              <div className="m-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
                <span className="text-red-700">{error}</span>
                <button onClick={clearError} className="text-red-500 hover:text-red-700">×</button>
              </div>
            )}

            {loading.page ? (
              <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-4 border-[#977DFF]/30 border-t-[#0033FF] rounded-full animate-spin" />
              </div>
            ) : currentPage ? (
              <article className="max-w-4xl mx-auto p-8">
                {/* Breadcrumbs */}
                {currentSite.show_breadcrumbs && currentPage.path !== '/home' && (
                  <nav className="flex items-center gap-2 text-sm text-gray-500 mb-4">
                    <Link href={`/sites/${slug}`} className="hover:text-gray-700">
                      <Home className="w-4 h-4" />
                    </Link>
                    {currentPage.path.split('/').filter(Boolean).map((segment, i, arr) => (
                      <React.Fragment key={i}>
                        <ChevronRight className="w-4 h-4" />
                        <span className={i === arr.length - 1 ? 'text-gray-900' : 'hover:text-gray-700'}>
                          {segment}
                        </span>
                      </React.Fragment>
                    ))}
                  </nav>
                )}

                {/* Page header */}
                {currentPage.cover_image_url && (
                  <div className="relative h-48 -mx-8 -mt-8 mb-6">
                    <img
                      src={currentPage.cover_image_url}
                      alt=""
                      className="w-full h-full object-cover"
                      style={{ objectPosition: currentPage.cover_position }}
                    />
                  </div>
                )}

                {currentPage.show_title && (
                  <h1 className="text-3xl font-bold text-gray-900 mb-6">
                    {currentPage.title}
                  </h1>
                )}

                {currentPage.is_draft && (
                  <div className="mb-4 px-3 py-2 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-700">
                    This page is a draft and not visible to others
                  </div>
                )}

                {/* Page content */}
                <div
                  className="prose prose-gray max-w-none"
                  dangerouslySetInnerHTML={{ __html: currentPage.content || '' }}
                />

                {/* Table of contents */}
                {currentPage.show_toc && (
                  <div className="fixed right-8 top-32 w-48 hidden xl:block">
                    <h4 className="text-sm font-medium text-gray-500 mb-2">On this page</h4>
                    {/* TOC would be generated from content headings */}
                  </div>
                )}
              </article>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                <FileText className="w-16 h-16 mb-4 text-gray-300" />
                <p>Select a page from the sidebar</p>
              </div>
            )}
          </main>
        </div>
      </div>

      {/* New Page Modal */}
      {showNewPageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="w-full max-w-md bg-white rounded-lg shadow-xl">
            <div className="p-6">
              <h2 className="text-xl font-semibold mb-4">Create New Page</h2>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Page Title *
                </label>
                <input
                  type="text"
                  value={newPageTitle}
                  onChange={(e) => setNewPageTitle(e.target.value)}
                  placeholder="Getting Started"
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#977DFF]"
                  autoFocus
                />
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowNewPageModal(false);
                    setNewPageTitle('');
                    setNewPageParentId(undefined);
                  }}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreatePage}
                  disabled={!newPageTitle.trim() || loading.saving}
                  className="px-4 py-2 bg-[#0033FF] text-white rounded-lg hover:bg-[#0033FF]/90 disabled:opacity-50"
                >
                  {loading.saving ? 'Creating...' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </WorkspaceLayout>
  );
}

// Tree Node Component
function TreeNode({
  node,
  slug,
  currentPageId,
  expanded,
  onToggle,
  editMode,
  onAddChild,
  depth = 0,
}: {
  node: PageTreeNode;
  slug: string;
  currentPageId?: string;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  editMode: boolean;
  onAddChild: (parentId: string) => void;
  depth?: number;
}) {
  const hasChildren = node.children.length > 0;
  const isExpanded = expanded.has(node.id);
  const isActive = currentPageId === node.id;

  const pageUrl = node.is_homepage
    ? `/sites/${slug}`
    : `/sites/${slug}${node.path}`;

  return (
    <div>
      <div
        className={`
          flex items-center gap-1 px-2 py-1.5 rounded group
          ${isActive ? 'bg-[#977DFF]/20 text-[#0033FF]' : 'hover:bg-gray-100'}
        `}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        {hasChildren ? (
          <button
            onClick={() => onToggle(node.id)}
            className="p-0.5 rounded hover:bg-gray-200"
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>
        ) : (
          <span className="w-5" />
        )}

        <Link href={pageUrl} className="flex-1 text-sm truncate">
          {node.title}
        </Link>

        {node.is_draft && (
          <span className="px-1.5 py-0.5 text-xs bg-yellow-100 text-yellow-600 rounded">
            Draft
          </span>
        )}

        {editMode && (
          <button
            onClick={() => onAddChild(node.id)}
            className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-gray-200"
            title="Add subpage"
          >
            <Plus className="w-3 h-3" />
          </button>
        )}
      </div>

      {hasChildren && isExpanded && (
        <div>
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              slug={slug}
              currentPageId={currentPageId}
              expanded={expanded}
              onToggle={onToggle}
              editMode={editMode}
              onAddChild={onAddChild}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
