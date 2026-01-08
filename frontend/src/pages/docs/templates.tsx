/**
 * Bheem Docs - Template Gallery Page
 * Browse and create documents from templates
 */
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import {
  FileText,
  Search,
  Plus,
  Grid,
  List,
  Filter,
  Star,
  StarOff,
  Clock,
  User,
  ChevronRight,
  Sparkles,
  FileSpreadsheet,
  Presentation,
  BookOpen,
  Briefcase,
  GraduationCap,
  Heart,
  Calendar,
  CheckSquare,
  Mail,
  X,
} from 'lucide-react';
import * as docsEditorApi from '@/lib/docsEditorApi';

interface Template {
  id: string;
  name: string;
  description?: string;
  content: any;
  thumbnail_url?: string;
  category: string;
  is_public: boolean;
  is_favorite?: boolean;
  use_count?: number;
  created_at: string;
  updated_at: string;
}

const CATEGORIES = [
  { id: 'all', name: 'All Templates', icon: Grid },
  { id: 'blank', name: 'Blank', icon: FileText },
  { id: 'business', name: 'Business', icon: Briefcase },
  { id: 'education', name: 'Education', icon: GraduationCap },
  { id: 'personal', name: 'Personal', icon: Heart },
  { id: 'project', name: 'Project Management', icon: CheckSquare },
  { id: 'meeting', name: 'Meeting Notes', icon: Calendar },
  { id: 'report', name: 'Reports', icon: BookOpen },
  { id: 'letter', name: 'Letters', icon: Mail },
];

// Built-in templates for demo
const BUILT_IN_TEMPLATES: Template[] = [
  {
    id: 'blank',
    name: 'Blank Document',
    description: 'Start with a clean slate',
    category: 'blank',
    content: { type: 'doc', content: [{ type: 'paragraph' }] },
    is_public: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'meeting-notes',
    name: 'Meeting Notes',
    description: 'Capture meeting discussions and action items',
    category: 'meeting',
    content: {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Meeting Notes' }] },
        { type: 'paragraph', content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Date: ' }, { type: 'text', text: '[Insert Date]' }] },
        { type: 'paragraph', content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Attendees: ' }, { type: 'text', text: '[List attendees]' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Agenda' }] },
        { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Item 1' }] }] }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Discussion Points' }] },
        { type: 'paragraph', content: [{ type: 'text', text: '[Add discussion notes here]' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Action Items' }] },
        { type: 'taskList', content: [{ type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Action item 1 - @assignee' }] }] }] },
      ],
    },
    is_public: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'project-proposal',
    name: 'Project Proposal',
    description: 'Professional project proposal template',
    category: 'business',
    content: {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Project Proposal' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Executive Summary' }] },
        { type: 'paragraph', content: [{ type: 'text', text: '[Provide a brief overview of the project]' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Problem Statement' }] },
        { type: 'paragraph', content: [{ type: 'text', text: '[Describe the problem this project aims to solve]' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Proposed Solution' }] },
        { type: 'paragraph', content: [{ type: 'text', text: '[Outline your proposed solution]' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Timeline' }] },
        { type: 'paragraph', content: [{ type: 'text', text: '[Add project timeline]' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Budget' }] },
        { type: 'paragraph', content: [{ type: 'text', text: '[Provide budget breakdown]' }] },
      ],
    },
    is_public: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'weekly-report',
    name: 'Weekly Status Report',
    description: 'Track weekly progress and updates',
    category: 'report',
    content: {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Weekly Status Report' }] },
        { type: 'paragraph', content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Week of: ' }, { type: 'text', text: '[Date Range]' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Accomplishments' }] },
        { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Completed task 1' }] }] }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'In Progress' }] },
        { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Working on task 2' }] }] }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Blockers' }] },
        { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'None currently' }] }] }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Next Week Goals' }] },
        { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Goal 1' }] }] }] },
      ],
    },
    is_public: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'business-letter',
    name: 'Business Letter',
    description: 'Formal business correspondence template',
    category: 'letter',
    content: {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: '[Your Name]' }] },
        { type: 'paragraph', content: [{ type: 'text', text: '[Your Address]' }] },
        { type: 'paragraph', content: [{ type: 'text', text: '[City, State ZIP]' }] },
        { type: 'paragraph', content: [{ type: 'text', text: '[Date]' }] },
        { type: 'paragraph' },
        { type: 'paragraph', content: [{ type: 'text', text: '[Recipient Name]' }] },
        { type: 'paragraph', content: [{ type: 'text', text: '[Company Name]' }] },
        { type: 'paragraph', content: [{ type: 'text', text: '[Address]' }] },
        { type: 'paragraph' },
        { type: 'paragraph', content: [{ type: 'text', text: 'Dear [Recipient Name],' }] },
        { type: 'paragraph' },
        { type: 'paragraph', content: [{ type: 'text', text: '[Body of the letter]' }] },
        { type: 'paragraph' },
        { type: 'paragraph', content: [{ type: 'text', text: 'Sincerely,' }] },
        { type: 'paragraph' },
        { type: 'paragraph', content: [{ type: 'text', text: '[Your Name]' }] },
      ],
    },
    is_public: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'study-notes',
    name: 'Study Notes',
    description: 'Organize your study materials',
    category: 'education',
    content: {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Study Notes: [Subject]' }] },
        { type: 'paragraph', content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Chapter/Topic: ' }, { type: 'text', text: '[Topic Name]' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Key Concepts' }] },
        { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Concept 1' }] }] }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Important Terms' }] },
        { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Term: ' }, { type: 'text', text: 'Definition' }] }] }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Summary' }] },
        { type: 'paragraph', content: [{ type: 'text', text: '[Write your summary here]' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Questions to Review' }] },
        { type: 'orderedList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Question 1?' }] }] }] },
      ],
    },
    is_public: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export default function TemplateGalleryPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>(BUILT_IN_TEMPLATES);
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [newDocTitle, setNewDocTitle] = useState('');
  const [creating, setCreating] = useState(false);

  // Fetch templates from API
  useEffect(() => {
    const fetchTemplates = async () => {
      setLoading(true);
      try {
        const apiTemplates = await docsEditorApi.getTemplates();
        setTemplates([...BUILT_IN_TEMPLATES, ...apiTemplates]);
      } catch (err) {
        console.error('Failed to fetch templates:', err);
        // Keep built-in templates on error
      } finally {
        setLoading(false);
      }
    };

    fetchTemplates();
  }, []);

  // Filter templates
  const filteredTemplates = templates.filter((template) => {
    const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory;
    const matchesSearch = !searchQuery ||
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Handle template selection
  const handleSelectTemplate = (template: Template) => {
    setSelectedTemplate(template);
    setNewDocTitle(`${template.name} - ${new Date().toLocaleDateString()}`);
    setShowCreateModal(true);
  };

  // Create document from template
  const handleCreateDocument = async () => {
    if (!selectedTemplate) return;

    setCreating(true);
    try {
      if (selectedTemplate.id === 'blank') {
        // Create blank document
        const doc = await docsEditorApi.createDocument({
          title: newDocTitle || 'Untitled Document',
        });
        router.push(`/docs/editor/${doc.id}`);
      } else {
        // Create from template
        const doc = await docsEditorApi.createFromTemplate(
          selectedTemplate.id,
          newDocTitle || selectedTemplate.name
        );
        router.push(`/docs/editor/${doc.id}`);
      }
    } catch (err) {
      console.error('Failed to create document:', err);
      // For demo, navigate to a new editor anyway
      router.push('/docs/editor/new');
    } finally {
      setCreating(false);
      setShowCreateModal(false);
    }
  };

  const getCategoryIcon = (category: string) => {
    const cat = CATEGORIES.find((c) => c.id === category);
    return cat?.icon || FileText;
  };

  return (
    <>
      <Head>
        <title>Template Gallery - Bheem Docs</title>
      </Head>

      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => router.push('/docs')}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <ChevronRight size={20} className="rotate-180" />
                </button>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Template Gallery</h1>
                  <p className="text-sm text-gray-500">Choose a template to get started</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {/* Search */}
                <div className="relative">
                  <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search templates..."
                    className="pl-10 pr-4 py-2 border rounded-lg w-64 focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* View toggle */}
                <div className="flex items-center border rounded-lg">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-2 ${viewMode === 'grid' ? 'bg-gray-100' : ''}`}
                  >
                    <Grid size={18} />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-2 ${viewMode === 'list' ? 'bg-gray-100' : ''}`}
                  >
                    <List size={18} />
                  </button>
                </div>

                {/* New blank document */}
                <button
                  onClick={() => handleSelectTemplate(BUILT_IN_TEMPLATES[0])}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Plus size={18} />
                  New Document
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 py-6 flex gap-6">
          {/* Sidebar - Categories */}
          <div className="w-56 flex-shrink-0">
            <nav className="space-y-1">
              {CATEGORIES.map((category) => {
                const Icon = category.icon;
                const count = category.id === 'all'
                  ? templates.length
                  : templates.filter((t) => t.category === category.id).length;

                return (
                  <button
                    key={category.id}
                    onClick={() => setSelectedCategory(category.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm ${
                      selectedCategory === category.id
                        ? 'bg-blue-50 text-blue-600'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon size={18} />
                      <span>{category.name}</span>
                    </div>
                    <span className="text-xs text-gray-400">{count}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Main content - Templates */}
          <div className="flex-1">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
              </div>
            ) : filteredTemplates.length === 0 ? (
              <div className="text-center py-12">
                <FileText size={48} className="mx-auto text-gray-300" />
                <p className="mt-4 text-gray-500">No templates found</p>
              </div>
            ) : viewMode === 'grid' ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {filteredTemplates.map((template) => {
                  const CategoryIcon = getCategoryIcon(template.category);
                  return (
                    <button
                      key={template.id}
                      onClick={() => handleSelectTemplate(template)}
                      className="bg-white border rounded-xl p-4 hover:shadow-lg hover:border-blue-500 transition-all text-left group"
                    >
                      {/* Thumbnail */}
                      <div className="aspect-[4/3] bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg mb-3 flex items-center justify-center relative overflow-hidden">
                        {template.thumbnail_url ? (
                          <img
                            src={template.thumbnail_url}
                            alt={template.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <CategoryIcon size={32} className="text-gray-300" />
                        )}
                        <div className="absolute inset-0 bg-blue-600/0 group-hover:bg-blue-600/10 transition-colors" />
                      </div>

                      {/* Info */}
                      <h3 className="font-medium text-gray-900 truncate">{template.name}</h3>
                      {template.description && (
                        <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                          {template.description}
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="bg-white rounded-xl border divide-y">
                {filteredTemplates.map((template) => {
                  const CategoryIcon = getCategoryIcon(template.category);
                  return (
                    <button
                      key={template.id}
                      onClick={() => handleSelectTemplate(template)}
                      className="w-full flex items-center gap-4 px-4 py-3 hover:bg-gray-50 text-left"
                    >
                      <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <CategoryIcon size={24} className="text-gray-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-gray-900">{template.name}</h3>
                        {template.description && (
                          <p className="text-sm text-gray-500 truncate">{template.description}</p>
                        )}
                      </div>
                      <span className="text-xs text-gray-400 capitalize">{template.category}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Create Document Modal */}
        {showCreateModal && selectedTemplate && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
              <div className="flex items-center justify-between px-6 py-4 border-b">
                <h2 className="text-lg font-semibold">Create Document</h2>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <p className="text-sm text-gray-500 mb-2">Template</p>
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <FileText size={20} className="text-blue-600" />
                    <span className="font-medium">{selectedTemplate.name}</span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Document Title
                  </label>
                  <input
                    type="text"
                    value={newDocTitle}
                    onChange={(e) => setNewDocTitle(e.target.value)}
                    placeholder="Enter document title"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    autoFocus
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-xl">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateDocument}
                  disabled={creating}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {creating ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus size={18} />
                      Create
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
