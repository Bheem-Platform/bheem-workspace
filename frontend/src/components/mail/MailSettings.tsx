/**
 * Bheem Mail Settings Panel
 * Comprehensive settings for Labels, Filters, Signatures, Templates, and Vacation
 * Following Gmail/Zoho best practices
 */
import { useState, useEffect } from 'react';
import {
  X,
  Tag,
  Filter,
  Plane,
  FileSignature,
  FileText,
  Plus,
  Trash2,
  Edit2,
  Check,
  ChevronRight,
  Palette,
  ToggleLeft,
  ToggleRight,
  Calendar,
  Clock,
  AlertCircle,
  Copy,
  GripVertical,
  Bell,
  BellOff,
  Volume2,
  VolumeX,
} from 'lucide-react';
import * as mailApi from '@/lib/mailApi';
import { nudgeApi, NudgeSettings as NudgeSettingsType } from '@/lib/mailEnhancedApi';

interface MailSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'labels' | 'filters' | 'signatures' | 'templates' | 'vacation' | 'nudges';
}

type TabType = 'labels' | 'filters' | 'signatures' | 'templates' | 'vacation' | 'nudges';

// Color palette for labels
const LABEL_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
  '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9',
  '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
  '#ec4899', '#f43f5e', '#64748b', '#475569', '#1e293b',
];

export default function MailSettings({ isOpen, onClose, initialTab = 'labels' }: MailSettingsProps) {
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);

  if (!isOpen) return null;

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'labels', label: 'Labels', icon: <Tag size={18} /> },
    { id: 'filters', label: 'Filters', icon: <Filter size={18} /> },
    { id: 'signatures', label: 'Signatures', icon: <FileSignature size={18} /> },
    { id: 'templates', label: 'Templates', icon: <FileText size={18} /> },
    { id: 'vacation', label: 'Vacation Responder', icon: <Plane size={18} /> },
    { id: 'nudges', label: 'Nudges & Reminders', icon: <Bell size={18} /> },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-[900px] max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Mail Settings</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar Tabs */}
          <div className="w-48 border-r border-gray-200 bg-gray-50 p-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors
                  ${activeTab === tab.id
                    ? 'bg-orange-100 text-orange-700'
                    : 'text-gray-600 hover:bg-gray-100'
                  }
                `}
              >
                {tab.icon}
                <span className="text-sm font-medium">{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {activeTab === 'labels' && <LabelsSettings />}
            {activeTab === 'filters' && <FiltersSettings />}
            {activeTab === 'signatures' && <SignaturesSettings />}
            {activeTab === 'templates' && <TemplatesSettings />}
            {activeTab === 'vacation' && <VacationSettings />}
            {activeTab === 'nudges' && <NudgesSettings />}
          </div>
        </div>
      </div>
    </div>
  );
}

// ===========================================
// Labels Settings
// ===========================================
function LabelsSettings() {
  const [labels, setLabels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newLabel, setNewLabel] = useState({ name: '', color: '#3b82f6', description: '' });
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    fetchLabels();
  }, []);

  const fetchLabels = async () => {
    try {
      const data = await mailApi.listLabels();
      setLabels(data.labels || []);
    } catch (error) {
      console.error('Failed to fetch labels:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newLabel.name.trim()) return;
    try {
      await mailApi.createLabel(newLabel);
      setNewLabel({ name: '', color: '#3b82f6', description: '' });
      setShowCreate(false);
      fetchLabels();
    } catch (error) {
      console.error('Failed to create label:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this label?')) return;
    try {
      await mailApi.deleteLabel(id);
      fetchLabels();
    } catch (error) {
      console.error('Failed to delete label:', error);
    }
  };

  const handleUpdate = async (id: string, updates: any) => {
    try {
      await mailApi.updateLabel(id, updates);
      setEditingId(null);
      fetchLabels();
    } catch (error) {
      console.error('Failed to update label:', error);
    }
  };

  if (loading) {
    return <div className="text-center py-8 text-gray-500">Loading labels...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Labels</h3>
          <p className="text-sm text-gray-500">Organize your emails with custom labels</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
        >
          <Plus size={18} />
          <span>Create Label</span>
        </button>
      </div>

      {/* Create New Label Form */}
      {showCreate && (
        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
          <h4 className="font-medium text-gray-900 mb-4">New Label</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                type="text"
                value={newLabel.name}
                onChange={(e) => setNewLabel({ ...newLabel, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                placeholder="Label name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
              <div className="flex gap-1 flex-wrap">
                {LABEL_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setNewLabel({ ...newLabel, color })}
                    className={`w-6 h-6 rounded-full border-2 transition-transform ${
                      newLabel.color === color ? 'border-gray-800 scale-110' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
            <input
              type="text"
              value={newLabel.description}
              onChange={(e) => setNewLabel({ ...newLabel, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              placeholder="What is this label for?"
            />
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button
              onClick={() => setShowCreate(false)}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
            >
              Create Label
            </button>
          </div>
        </div>
      )}

      {/* Labels List */}
      <div className="space-y-2">
        {labels.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Tag size={48} className="mx-auto mb-2 text-gray-300" />
            <p>No labels yet. Create one to get started!</p>
          </div>
        ) : (
          labels.map((label) => (
            <div
              key={label.id}
              className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg hover:border-gray-300 group"
            >
              <div
                className="w-4 h-4 rounded-full flex-shrink-0"
                style={{ backgroundColor: label.color || '#3b82f6' }}
              />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900">{label.name}</p>
                {label.description && (
                  <p className="text-sm text-gray-500 truncate">{label.description}</p>
                )}
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => setEditingId(label.id)}
                  className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                >
                  <Edit2 size={16} />
                </button>
                <button
                  onClick={() => handleDelete(label.id)}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ===========================================
// Filters Settings
// ===========================================
// Type definitions for filters
type FilterField = 'from' | 'to' | 'cc' | 'subject' | 'body' | 'has_attachment';
type FilterOperator = 'contains' | 'not_contains' | 'equals' | 'not_equals' | 'starts_with' | 'ends_with' | 'matches_regex';
type FilterActionType = 'move_to' | 'mark_as_read' | 'mark_as_starred' | 'apply_label' | 'delete' | 'forward_to' | 'skip_inbox' | 'never_spam';

interface FilterCondition {
  field: FilterField;
  operator: FilterOperator;
  value: string;
}

interface FilterAction {
  action: FilterActionType;
  value: string;
}

interface NewFilter {
  name: string;
  conditions: FilterCondition[];
  actions: FilterAction[];
  is_enabled: boolean;
  stop_processing: boolean;
}

function FiltersSettings() {
  const [filters, setFilters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [options, setOptions] = useState<any>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newFilter, setNewFilter] = useState<NewFilter>({
    name: '',
    conditions: [{ field: 'from', operator: 'contains', value: '' }],
    actions: [{ action: 'apply_label', value: '' }],
    is_enabled: true,
    stop_processing: false,
  });

  useEffect(() => {
    fetchFilters();
    fetchOptions();
  }, []);

  const fetchFilters = async () => {
    try {
      const data = await mailApi.listFilters();
      setFilters(data.filters || []);
    } catch (error) {
      console.error('Failed to fetch filters:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchOptions = async () => {
    try {
      const data = await mailApi.getFilterOptions();
      setOptions(data);
    } catch (error) {
      console.error('Failed to fetch filter options:', error);
    }
  };

  const handleCreate = async () => {
    if (!newFilter.name.trim() || !newFilter.conditions[0].value) return;
    try {
      await mailApi.createFilter(newFilter);
      setNewFilter({
        name: '',
        conditions: [{ field: 'from', operator: 'contains', value: '' }],
        actions: [{ action: 'apply_label', value: '' }],
        is_enabled: true,
        stop_processing: false,
      });
      setShowCreate(false);
      fetchFilters();
    } catch (error) {
      console.error('Failed to create filter:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this filter?')) return;
    try {
      await mailApi.deleteFilter(id);
      fetchFilters();
    } catch (error) {
      console.error('Failed to delete filter:', error);
    }
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    try {
      await mailApi.toggleFilter(id, !enabled);
      fetchFilters();
    } catch (error) {
      console.error('Failed to toggle filter:', error);
    }
  };

  if (loading) {
    return <div className="text-center py-8 text-gray-500">Loading filters...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Email Filters</h3>
          <p className="text-sm text-gray-500">Automatically organize incoming emails</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
        >
          <Plus size={18} />
          <span>Create Filter</span>
        </button>
      </div>

      {/* Create New Filter Form */}
      {showCreate && options && (
        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
          <h4 className="font-medium text-gray-900 mb-4">New Filter</h4>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Filter Name</label>
              <input
                type="text"
                value={newFilter.name}
                onChange={(e) => setNewFilter({ ...newFilter, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                placeholder="e.g., Move newsletters to folder"
              />
            </div>

            {/* Conditions */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">When email matches:</label>
              {newFilter.conditions.map((condition, idx) => (
                <div key={idx} className="flex gap-2 mb-2">
                  <select
                    value={condition.field}
                    onChange={(e) => {
                      const updated = [...newFilter.conditions];
                      updated[idx].field = e.target.value as FilterField;
                      setNewFilter({ ...newFilter, conditions: updated });
                    }}
                    className="px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    {options.condition_fields?.map((f: string) => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                  <select
                    value={condition.operator}
                    onChange={(e) => {
                      const updated = [...newFilter.conditions];
                      updated[idx].operator = e.target.value as FilterOperator;
                      setNewFilter({ ...newFilter, conditions: updated });
                    }}
                    className="px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    {options.condition_operators?.map((o: string) => (
                      <option key={o} value={o}>{o.replace('_', ' ')}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={condition.value}
                    onChange={(e) => {
                      const updated = [...newFilter.conditions];
                      updated[idx].value = e.target.value;
                      setNewFilter({ ...newFilter, conditions: updated });
                    }}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="Value"
                  />
                </div>
              ))}
            </div>

            {/* Actions */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Do this:</label>
              {newFilter.actions.map((action, idx) => (
                <div key={idx} className="flex gap-2 mb-2">
                  <select
                    value={action.action}
                    onChange={(e) => {
                      const updated = [...newFilter.actions];
                      updated[idx].action = e.target.value as FilterActionType;
                      setNewFilter({ ...newFilter, actions: updated });
                    }}
                    className="px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    {options.action_types?.map((a: string) => (
                      <option key={a} value={a}>{a.replace('_', ' ')}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={action.value}
                    onChange={(e) => {
                      const updated = [...newFilter.actions];
                      updated[idx].value = e.target.value;
                      setNewFilter({ ...newFilter, actions: updated });
                    }}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="Value (folder name, label, email)"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <button
              onClick={() => setShowCreate(false)}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
            >
              Create Filter
            </button>
          </div>
        </div>
      )}

      {/* Filters List */}
      <div className="space-y-2">
        {filters.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Filter size={48} className="mx-auto mb-2 text-gray-300" />
            <p>No filters yet. Create one to automate your inbox!</p>
          </div>
        ) : (
          filters.map((filter) => (
            <div
              key={filter.id}
              className="flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-lg hover:border-gray-300"
            >
              <GripVertical size={16} className="text-gray-300" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-gray-900">{filter.name}</p>
                  {!filter.is_enabled && (
                    <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-500 rounded">Disabled</span>
                  )}
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  {filter.conditions?.map((c: any) => `${c.field} ${c.operator} "${c.value}"`).join(' AND ')}
                </p>
                <p className="text-sm text-orange-600 mt-1">
                  {filter.actions?.map((a: any) => `${a.action.replace('_', ' ')}${a.value ? `: ${a.value}` : ''}`).join(', ')}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleToggle(filter.id, filter.is_enabled)}
                  className={`p-1.5 rounded ${filter.is_enabled ? 'text-green-600' : 'text-gray-400'}`}
                >
                  {filter.is_enabled ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                </button>
                <button
                  onClick={() => handleDelete(filter.id)}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ===========================================
// Signatures Settings
// ===========================================
function SignaturesSettings() {
  const [signatures, setSignatures] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newSignature, setNewSignature] = useState({ name: '', content: '', is_default: false });

  useEffect(() => {
    fetchSignatures();
  }, []);

  const fetchSignatures = async () => {
    try {
      const data = await mailApi.listSignatures();
      setSignatures(data.signatures || []);
    } catch (error) {
      console.error('Failed to fetch signatures:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newSignature.name.trim() || !newSignature.content.trim()) return;
    try {
      await mailApi.createSignature(newSignature);
      setNewSignature({ name: '', content: '', is_default: false });
      setShowCreate(false);
      fetchSignatures();
    } catch (error) {
      console.error('Failed to create signature:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this signature?')) return;
    try {
      await mailApi.deleteSignature(id);
      fetchSignatures();
    } catch (error) {
      console.error('Failed to delete signature:', error);
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      await mailApi.setDefaultSignature(id);
      fetchSignatures();
    } catch (error) {
      console.error('Failed to set default signature:', error);
    }
  };

  if (loading) {
    return <div className="text-center py-8 text-gray-500">Loading signatures...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Email Signatures</h3>
          <p className="text-sm text-gray-500">Create signatures for your outgoing emails</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
        >
          <Plus size={18} />
          <span>Create Signature</span>
        </button>
      </div>

      {/* Create New Signature Form */}
      {showCreate && (
        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
          <h4 className="font-medium text-gray-900 mb-4">New Signature</h4>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Signature Name</label>
              <input
                type="text"
                value={newSignature.name}
                onChange={(e) => setNewSignature({ ...newSignature, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                placeholder="e.g., Work, Personal"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Signature Content</label>
              <textarea
                value={newSignature.content}
                onChange={(e) => setNewSignature({ ...newSignature, content: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 min-h-32"
                placeholder="Your signature content (HTML supported)"
              />
            </div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={newSignature.is_default}
                onChange={(e) => setNewSignature({ ...newSignature, is_default: e.target.checked })}
                className="rounded border-gray-300 text-orange-500 focus:ring-orange-500"
              />
              <span className="text-sm text-gray-700">Set as default signature</span>
            </label>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button
              onClick={() => setShowCreate(false)}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
            >
              Create Signature
            </button>
          </div>
        </div>
      )}

      {/* Signatures List */}
      <div className="space-y-2">
        {signatures.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <FileSignature size={48} className="mx-auto mb-2 text-gray-300" />
            <p>No signatures yet. Create one for your emails!</p>
          </div>
        ) : (
          signatures.map((sig) => (
            <div
              key={sig.id}
              className="p-4 bg-white border border-gray-200 rounded-lg hover:border-gray-300"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-gray-900">{sig.name}</p>
                  {sig.is_default && (
                    <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded">Default</span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {!sig.is_default && (
                    <button
                      onClick={() => handleSetDefault(sig.id)}
                      className="px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded"
                    >
                      Set as default
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(sig.id)}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              <div
                className="text-sm text-gray-600 bg-gray-50 p-3 rounded border border-gray-100"
                dangerouslySetInnerHTML={{ __html: sig.content || sig.content_html || '' }}
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ===========================================
// Templates Settings
// ===========================================
function TemplatesSettings() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    subject: '',
    body: '',
    category: 'general',
    description: '',
  });

  useEffect(() => {
    fetchTemplates();
    fetchCategories();
  }, []);

  const fetchTemplates = async () => {
    try {
      const data = await mailApi.listTemplates();
      setTemplates(data.templates || []);
    } catch (error) {
      console.error('Failed to fetch templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const data = await mailApi.getTemplateCategories();
      setCategories(data.categories || ['general']);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  };

  const handleCreate = async () => {
    if (!newTemplate.name.trim()) return;
    try {
      await mailApi.createTemplate(newTemplate);
      setNewTemplate({ name: '', subject: '', body: '', category: 'general', description: '' });
      setShowCreate(false);
      fetchTemplates();
    } catch (error) {
      console.error('Failed to create template:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this template?')) return;
    try {
      await mailApi.deleteTemplate(id);
      fetchTemplates();
    } catch (error) {
      console.error('Failed to delete template:', error);
    }
  };

  const handleDuplicate = async (id: string) => {
    try {
      await mailApi.duplicateTemplate(id);
      fetchTemplates();
    } catch (error) {
      console.error('Failed to duplicate template:', error);
    }
  };

  if (loading) {
    return <div className="text-center py-8 text-gray-500">Loading templates...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Email Templates</h3>
          <p className="text-sm text-gray-500">Save time with reusable email templates</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
        >
          <Plus size={18} />
          <span>Create Template</span>
        </button>
      </div>

      {/* Create New Template Form */}
      {showCreate && (
        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
          <h4 className="font-medium text-gray-900 mb-4">New Template</h4>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Template Name</label>
                <input
                  type="text"
                  value={newTemplate.name}
                  onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  placeholder="e.g., Meeting Request"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select
                  value={newTemplate.category}
                  onChange={(e) => setNewTemplate({ ...newTemplate, category: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                >
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                  <option value="new">+ New category</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
              <input
                type="text"
                value={newTemplate.subject}
                onChange={(e) => setNewTemplate({ ...newTemplate, subject: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                placeholder="Email subject (use {{variable}} for placeholders)"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Body</label>
              <textarea
                value={newTemplate.body}
                onChange={(e) => setNewTemplate({ ...newTemplate, body: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 min-h-32"
                placeholder="Email body (HTML supported, use {{variable}} for placeholders)"
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button
              onClick={() => setShowCreate(false)}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
            >
              Create Template
            </button>
          </div>
        </div>
      )}

      {/* Templates List */}
      <div className="space-y-2">
        {templates.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <FileText size={48} className="mx-auto mb-2 text-gray-300" />
            <p>No templates yet. Create one to save time!</p>
          </div>
        ) : (
          templates.map((template) => (
            <div
              key={template.id}
              className="p-4 bg-white border border-gray-200 rounded-lg hover:border-gray-300"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-gray-900">{template.name}</p>
                  <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
                    {template.category}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleDuplicate(template.id)}
                    className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                    title="Duplicate"
                  >
                    <Copy size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(template.id)}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              <p className="text-sm font-medium text-gray-700 mb-1">{template.subject}</p>
              <p className="text-sm text-gray-500 line-clamp-2">{template.body}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ===========================================
// Vacation Settings
// ===========================================
function VacationSettings() {
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const data = await mailApi.getVacationSettings();
      setSettings(data);
    } catch (error) {
      console.error('Failed to fetch vacation settings:', error);
      setSettings({
        is_enabled: false,
        subject: 'Out of Office',
        message: '',
        start_date: null,
        end_date: null,
        contacts_only: false,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await mailApi.updateVacationSettings(settings);
    } catch (error) {
      console.error('Failed to save vacation settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async () => {
    const newEnabled = !settings.is_enabled;
    setSettings({ ...settings, is_enabled: newEnabled });
    try {
      if (newEnabled) {
        await mailApi.enableVacation();
      } else {
        await mailApi.disableVacation();
      }
      fetchSettings();
    } catch (error) {
      console.error('Failed to toggle vacation:', error);
    }
  };

  if (loading) {
    return <div className="text-center py-8 text-gray-500">Loading settings...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Vacation Responder</h3>
          <p className="text-sm text-gray-500">Automatically reply when you're away</p>
        </div>
        <button
          onClick={handleToggle}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
            settings?.is_enabled
              ? 'bg-green-100 text-green-700 hover:bg-green-200'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          {settings?.is_enabled ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
          <span>{settings?.is_enabled ? 'Enabled' : 'Disabled'}</span>
        </button>
      </div>

      {/* Warning when enabled */}
      {settings?.is_enabled && (
        <div className="flex items-start gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
          <Check className="text-green-600 mt-0.5" size={20} />
          <div>
            <p className="font-medium text-green-800">Vacation responder is active</p>
            <p className="text-sm text-green-600">
              Automatic replies are being sent to incoming emails.
            </p>
          </div>
        </div>
      )}

      {/* Settings Form */}
      <div className="space-y-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Calendar size={14} className="inline mr-1" />
              Start Date (optional)
            </label>
            <input
              type="date"
              value={settings?.start_date?.split('T')[0] || ''}
              onChange={(e) => setSettings({ ...settings, start_date: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Calendar size={14} className="inline mr-1" />
              End Date (optional)
            </label>
            <input
              type="date"
              value={settings?.end_date?.split('T')[0] || ''}
              onChange={(e) => setSettings({ ...settings, end_date: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
          <input
            type="text"
            value={settings?.subject || ''}
            onChange={(e) => setSettings({ ...settings, subject: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
            placeholder="Out of Office"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
          <textarea
            value={settings?.message || ''}
            onChange={(e) => setSettings({ ...settings, message: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 min-h-32"
            placeholder="I'm currently out of the office and will respond to your email when I return."
          />
        </div>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={settings?.contacts_only || false}
            onChange={(e) => setSettings({ ...settings, contacts_only: e.target.checked })}
            className="rounded border-gray-300 text-orange-500 focus:ring-orange-500"
          />
          <span className="text-sm text-gray-700">Only send to people in my contacts</span>
        </label>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}

// ===========================================
// Nudges Settings
// ===========================================
function NudgesSettings() {
  const [settings, setSettings] = useState<NudgeSettingsType | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newExcludedEmail, setNewExcludedEmail] = useState('');
  const [newExcludedDomain, setNewExcludedDomain] = useState('');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const data = await nudgeApi.getSettings();
      setSettings(data);
    } catch (error) {
      console.error('Failed to fetch nudge settings:', error);
      // Set defaults
      setSettings({
        nudges_enabled: true,
        sent_no_reply_days: 3,
        received_no_reply_days: 3,
        nudge_sent_emails: true,
        nudge_received_emails: true,
        nudge_important_only: false,
        quiet_hours_start: undefined,
        quiet_hours_end: undefined,
        quiet_weekends: false,
        excluded_senders: [],
        excluded_domains: [],
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      await nudgeApi.updateSettings(settings);
    } catch (error) {
      console.error('Failed to save nudge settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const addExcludedSender = () => {
    if (!newExcludedEmail.trim() || !settings) return;
    setSettings({
      ...settings,
      excluded_senders: [...settings.excluded_senders, newExcludedEmail.trim()],
    });
    setNewExcludedEmail('');
  };

  const removeExcludedSender = (email: string) => {
    if (!settings) return;
    setSettings({
      ...settings,
      excluded_senders: settings.excluded_senders.filter((e) => e !== email),
    });
  };

  const addExcludedDomain = () => {
    if (!newExcludedDomain.trim() || !settings) return;
    setSettings({
      ...settings,
      excluded_domains: [...settings.excluded_domains, newExcludedDomain.trim()],
    });
    setNewExcludedDomain('');
  };

  const removeExcludedDomain = (domain: string) => {
    if (!settings) return;
    setSettings({
      ...settings,
      excluded_domains: settings.excluded_domains.filter((d) => d !== domain),
    });
  };

  if (loading) {
    return <div className="text-center py-8 text-gray-500">Loading settings...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Nudges & Reminders</h3>
          <p className="text-sm text-gray-500">Get reminded to follow up on emails</p>
        </div>
        <button
          onClick={() => setSettings(settings ? { ...settings, nudges_enabled: !settings.nudges_enabled } : null)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
            settings?.nudges_enabled
              ? 'bg-green-100 text-green-700 hover:bg-green-200'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          {settings?.nudges_enabled ? <Bell size={20} /> : <BellOff size={20} />}
          <span>{settings?.nudges_enabled ? 'Enabled' : 'Disabled'}</span>
        </button>
      </div>

      {/* Info Panel */}
      <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <Bell className="text-blue-600 mt-0.5" size={20} />
        <div>
          <p className="font-medium text-blue-800">How nudges work</p>
          <p className="text-sm text-blue-600">
            Bheem will remind you about emails that haven't received replies. You'll see nudge notifications
            at the top of your inbox based on your settings below.
          </p>
        </div>
      </div>

      {/* Settings Form */}
      {settings?.nudges_enabled && (
        <div className="space-y-6">
          {/* Timing Settings */}
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <h4 className="font-medium text-gray-900 mb-4">Nudge Timing</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Remind about sent emails after (days)
                </label>
                <select
                  value={settings.sent_no_reply_days}
                  onChange={(e) => setSettings({ ...settings, sent_no_reply_days: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                >
                  <option value={1}>1 day</option>
                  <option value={2}>2 days</option>
                  <option value={3}>3 days</option>
                  <option value={5}>5 days</option>
                  <option value={7}>1 week</option>
                  <option value={14}>2 weeks</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Remind about received emails after (days)
                </label>
                <select
                  value={settings.received_no_reply_days}
                  onChange={(e) => setSettings({ ...settings, received_no_reply_days: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                >
                  <option value={1}>1 day</option>
                  <option value={2}>2 days</option>
                  <option value={3}>3 days</option>
                  <option value={5}>5 days</option>
                  <option value={7}>1 week</option>
                  <option value={14}>2 weeks</option>
                </select>
              </div>
            </div>
          </div>

          {/* Email Types */}
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <h4 className="font-medium text-gray-900 mb-4">Email Types</h4>
            <div className="space-y-3">
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={settings.nudge_sent_emails}
                  onChange={(e) => setSettings({ ...settings, nudge_sent_emails: e.target.checked })}
                  className="rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                />
                <span className="text-sm text-gray-700">Nudge about sent emails that haven't received replies</span>
              </label>
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={settings.nudge_received_emails}
                  onChange={(e) => setSettings({ ...settings, nudge_received_emails: e.target.checked })}
                  className="rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                />
                <span className="text-sm text-gray-700">Nudge about received emails I haven't replied to</span>
              </label>
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={settings.nudge_important_only}
                  onChange={(e) => setSettings({ ...settings, nudge_important_only: e.target.checked })}
                  className="rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                />
                <span className="text-sm text-gray-700">Only nudge for important emails (starred/flagged)</span>
              </label>
            </div>
          </div>

          {/* Quiet Hours */}
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <h4 className="font-medium text-gray-900 mb-4">Quiet Hours</h4>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Clock size={14} className="inline mr-1" />
                    Quiet start time
                  </label>
                  <input
                    type="time"
                    value={settings.quiet_hours_start || ''}
                    onChange={(e) => setSettings({ ...settings, quiet_hours_start: e.target.value || undefined })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Clock size={14} className="inline mr-1" />
                    Quiet end time
                  </label>
                  <input
                    type="time"
                    value={settings.quiet_hours_end || ''}
                    onChange={(e) => setSettings({ ...settings, quiet_hours_end: e.target.value || undefined })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={settings.quiet_weekends}
                  onChange={(e) => setSettings({ ...settings, quiet_weekends: e.target.checked })}
                  className="rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                />
                <span className="text-sm text-gray-700">Don't show nudges on weekends</span>
              </label>
            </div>
          </div>

          {/* Exclusions */}
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <h4 className="font-medium text-gray-900 mb-4">Excluded Senders</h4>
            <p className="text-sm text-gray-500 mb-3">Don't nudge for emails from these addresses</p>
            <div className="flex gap-2 mb-3">
              <input
                type="email"
                value={newExcludedEmail}
                onChange={(e) => setNewExcludedEmail(e.target.value)}
                placeholder="email@example.com"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                onKeyDown={(e) => e.key === 'Enter' && addExcludedSender()}
              />
              <button
                onClick={addExcludedSender}
                className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
              >
                <Plus size={18} />
              </button>
            </div>
            {settings.excluded_senders.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {settings.excluded_senders.map((email) => (
                  <span
                    key={email}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-gray-200 rounded-full text-sm"
                  >
                    {email}
                    <button
                      onClick={() => removeExcludedSender(email)}
                      className="text-gray-400 hover:text-red-500"
                    >
                      <X size={14} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Excluded Domains */}
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <h4 className="font-medium text-gray-900 mb-4">Excluded Domains</h4>
            <p className="text-sm text-gray-500 mb-3">Don't nudge for emails from these domains</p>
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={newExcludedDomain}
                onChange={(e) => setNewExcludedDomain(e.target.value)}
                placeholder="example.com"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                onKeyDown={(e) => e.key === 'Enter' && addExcludedDomain()}
              />
              <button
                onClick={addExcludedDomain}
                className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
              >
                <Plus size={18} />
              </button>
            </div>
            {settings.excluded_domains.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {settings.excluded_domains.map((domain) => (
                  <span
                    key={domain}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-gray-200 rounded-full text-sm"
                  >
                    @{domain}
                    <button
                      onClick={() => removeExcludedDomain(domain)}
                      className="text-gray-400 hover:text-red-500"
                    >
                      <X size={14} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}
