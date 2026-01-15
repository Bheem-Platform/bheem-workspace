/**
 * Bheem Forms - Form Editor
 * Google Forms-like form building experience
 */
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import {
  FileQuestion,
  Star,
  StarOff,
  Share2,
  Eye,
  Send,
  Plus,
  GripVertical,
  Trash2,
  Copy,
  Settings,
  Type,
  AlignLeft,
  List,
  CheckSquare,
  ChevronDown,
  Calendar,
  Clock,
  Upload,
  ToggleLeft,
  ArrowLeft,
  BarChart3,
  Palette,
  Image,
  MoreVertical,
} from 'lucide-react';
import { useRequireAuth } from '@/stores/authStore';
import { api } from '@/lib/api';

interface QuestionOption {
  id: string;
  text: string;
  is_other?: boolean;
}

interface Question {
  id: string;
  question_type: string;
  title: string;
  description?: string;
  is_required: boolean;
  options?: QuestionOption[];
  settings?: Record<string, any>;
}

interface FormData {
  id: string;
  title: string;
  description: string | null;
  status: 'draft' | 'published' | 'closed';
  is_starred: boolean;
  settings: {
    collect_email: boolean;
    limit_responses: boolean;
    response_limit: number | null;
    allow_edit_response: boolean;
    show_progress_bar: boolean;
    shuffle_questions: boolean;
    confirmation_message: string;
  };
  theme: {
    color_primary: string;
    color_background: string;
    font_family: string;
    header_image: string | null;
  };
  questions: Question[];
  response_count: number;
  created_at: string;
  updated_at: string;
}

const QUESTION_TYPES = [
  { id: 'short_text', name: 'Short answer', icon: Type },
  { id: 'long_text', name: 'Paragraph', icon: AlignLeft },
  { id: 'multiple_choice', name: 'Multiple choice', icon: List },
  { id: 'checkbox', name: 'Checkboxes', icon: CheckSquare },
  { id: 'dropdown', name: 'Dropdown', icon: ChevronDown },
  { id: 'date', name: 'Date', icon: Calendar },
  { id: 'time', name: 'Time', icon: Clock },
  { id: 'file', name: 'File upload', icon: Upload },
  { id: 'scale', name: 'Linear scale', icon: ToggleLeft },
];

export default function FormEditor() {
  const router = useRouter();
  const { id } = router.query;
  const { isAuthenticated, isLoading: authLoading } = useRequireAuth();

  const [form, setForm] = useState<FormData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'questions' | 'responses' | 'settings'>('questions');
  const [selectedQuestion, setSelectedQuestion] = useState<string | null>(null);
  const [showQuestionMenu, setShowQuestionMenu] = useState(false);

  const fetchForm = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const response = await api.get(`/forms/${id}`, { params: { include_questions: true } });
      setForm(response.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load form');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (isAuthenticated && !authLoading && id) {
      fetchForm();
    }
  }, [isAuthenticated, authLoading, id, fetchForm]);

  const updateForm = async (updates: Partial<FormData>) => {
    if (!form) return;
    try {
      setIsSaving(true);
      await api.put(`/forms/${form.id}`, updates);
      setForm({ ...form, ...updates });
    } catch (err) {
      console.error('Failed to update form:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const toggleStar = async () => {
    if (!form) return;
    try {
      await api.post(`/forms/${form.id}/star`);
      setForm({ ...form, is_starred: !form.is_starred });
    } catch (err) {
      console.error('Failed to toggle star:', err);
    }
  };

  const addQuestion = async (type: string) => {
    if (!form) return;
    try {
      setIsSaving(true);
      const response = await api.post(`/forms/${form.id}/questions`, {
        question_type: type,
        title: 'Untitled Question',
        is_required: false,
        options: ['multiple_choice', 'checkbox', 'dropdown'].includes(type)
          ? [{ id: crypto.randomUUID(), text: 'Option 1' }]
          : undefined,
      });
      setForm({
        ...form,
        questions: [...(form.questions || []), response.data.question],
      });
      setSelectedQuestion(response.data.question.id);
      setShowQuestionMenu(false);
    } catch (err) {
      console.error('Failed to add question:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const updateQuestion = async (questionId: string, updates: Partial<Question>) => {
    if (!form) return;
    try {
      setIsSaving(true);
      await api.put(`/forms/${form.id}/questions/${questionId}`, updates);
      setForm({
        ...form,
        questions: form.questions.map((q) =>
          q.id === questionId ? { ...q, ...updates } : q
        ),
      });
    } catch (err) {
      console.error('Failed to update question:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const deleteQuestion = async (questionId: string) => {
    if (!form) return;
    try {
      setIsSaving(true);
      await api.delete(`/forms/${form.id}/questions/${questionId}`);
      setForm({
        ...form,
        questions: form.questions.filter((q) => q.id !== questionId),
      });
      if (selectedQuestion === questionId) {
        setSelectedQuestion(null);
      }
    } catch (err) {
      console.error('Failed to delete question:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const duplicateQuestion = async (questionId: string) => {
    if (!form) return;
    const question = form.questions.find((q) => q.id === questionId);
    if (!question) return;

    try {
      setIsSaving(true);
      const response = await api.post(`/forms/${form.id}/questions`, {
        question_type: question.question_type,
        title: `${question.title} (copy)`,
        description: question.description,
        is_required: question.is_required,
        options: question.options,
        settings: question.settings,
      });
      const index = form.questions.findIndex((q) => q.id === questionId);
      const newQuestions = [...form.questions];
      newQuestions.splice(index + 1, 0, response.data.question);
      setForm({ ...form, questions: newQuestions });
    } catch (err) {
      console.error('Failed to duplicate question:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const publishForm = async () => {
    if (!form) return;
    if (form.questions.length === 0) {
      setError('Form must have at least one question to publish');
      return;
    }
    try {
      setIsSaving(true);
      await api.post(`/forms/${form.id}/publish`);
      setForm({ ...form, status: 'published' });
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to publish form');
    } finally {
      setIsSaving(false);
    }
  };

  const closeForm = async () => {
    if (!form) return;
    try {
      setIsSaving(true);
      await api.post(`/forms/${form.id}/close`);
      setForm({ ...form, status: 'closed' });
    } catch (err) {
      console.error('Failed to close form:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const getQuestionTypeIcon = (type: string) => {
    const qType = QUESTION_TYPES.find((t) => t.id === type);
    return qType?.icon || Type;
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (error && !form) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <FileQuestion className="mx-auto h-16 w-16 text-gray-400" />
          <h2 className="mt-4 text-xl font-medium text-gray-900">{error}</h2>
          <Link href="/forms" className="mt-4 inline-flex items-center text-purple-600 hover:text-purple-700">
            <ArrowLeft size={20} className="mr-1" />
            Back to Forms
          </Link>
        </div>
      </div>
    );
  }

  if (!form) return null;

  return (
    <>
      <Head>
        <title>{form.title} - Bheem Forms Editor</title>
      </Head>

      <div className="min-h-screen bg-gray-100 flex flex-col">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 flex-shrink-0 sticky top-0 z-40">
          <div className="flex items-center px-4 py-2">
            <Link href="/forms" className="p-2 hover:bg-gray-100 rounded-full">
              <FileQuestion className="h-7 w-7 text-purple-600" />
            </Link>

            <div className="ml-2 flex-1">
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                onBlur={() => updateForm({ title: form.title })}
                className="text-lg font-medium text-gray-900 bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-purple-500 rounded px-2 py-1"
              />
              <div className="flex items-center space-x-2 text-xs text-gray-500 ml-2">
                <button
                  onClick={toggleStar}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  {form.is_starred ? (
                    <Star size={14} className="text-yellow-500 fill-yellow-500" />
                  ) : (
                    <StarOff size={14} />
                  )}
                </button>
                <span>{isSaving ? 'Saving...' : 'All changes saved'}</span>
                <span className={`px-2 py-0.5 rounded-full ${
                  form.status === 'published' ? 'bg-green-100 text-green-700' :
                  form.status === 'closed' ? 'bg-red-100 text-red-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {form.status === 'published' ? 'Live' : form.status === 'closed' ? 'Closed' : 'Draft'}
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button className="p-2 text-gray-500 hover:bg-gray-100 rounded-full">
                <Palette size={20} />
              </button>
              <Link
                href={`/forms/${form.id}`}
                className="p-2 text-gray-500 hover:bg-gray-100 rounded-full"
                title="Preview"
              >
                <Eye size={20} />
              </Link>
              {form.status === 'draft' ? (
                <button
                  onClick={publishForm}
                  className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  <Send size={18} className="mr-2" />
                  Publish
                </button>
              ) : form.status === 'published' ? (
                <button
                  onClick={closeForm}
                  className="flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                >
                  Close Form
                </button>
              ) : (
                <button
                  onClick={publishForm}
                  className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  Reopen
                </button>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center px-4 border-t border-gray-100">
            <button
              onClick={() => setActiveTab('questions')}
              className={`px-4 py-3 text-sm font-medium border-b-2 ${
                activeTab === 'questions'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Questions
            </button>
            <button
              onClick={() => setActiveTab('responses')}
              className={`px-4 py-3 text-sm font-medium border-b-2 flex items-center ${
                activeTab === 'responses'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Responses
              <span className="ml-2 px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
                {form.response_count}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`px-4 py-3 text-sm font-medium border-b-2 ${
                activeTab === 'settings'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Settings
            </button>
          </div>
        </header>

        {/* Error */}
        {error && (
          <div className="mx-4 mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
            <button onClick={() => setError(null)} className="ml-2 text-red-800 hover:text-red-900">
              Dismiss
            </button>
          </div>
        )}

        {/* Main Content */}
        <main className="flex-1 overflow-auto py-6">
          <div className="max-w-2xl mx-auto px-4">
            {activeTab === 'questions' && (
              <>
                {/* Form Header Card */}
                <div
                  className="bg-white rounded-lg shadow-sm border-t-4 mb-4 overflow-hidden"
                  style={{ borderTopColor: form.theme.color_primary }}
                >
                  <div className="p-6">
                    <input
                      type="text"
                      value={form.title}
                      onChange={(e) => setForm({ ...form, title: e.target.value })}
                      onBlur={() => updateForm({ title: form.title })}
                      className="text-2xl font-medium text-gray-900 w-full bg-transparent border-none focus:outline-none focus:ring-0 p-0 mb-2"
                      placeholder="Form title"
                    />
                    <textarea
                      value={form.description || ''}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      onBlur={() => updateForm({ description: form.description })}
                      className="text-gray-600 w-full bg-transparent border-none focus:outline-none focus:ring-0 p-0 resize-none"
                      placeholder="Form description"
                      rows={2}
                    />
                  </div>
                </div>

                {/* Questions */}
                {form.questions.map((question, index) => {
                  const QuestionIcon = getQuestionTypeIcon(question.question_type);
                  const isSelected = selectedQuestion === question.id;

                  return (
                    <div
                      key={question.id}
                      className={`bg-white rounded-lg shadow-sm mb-4 overflow-hidden border-l-4 ${
                        isSelected ? 'border-l-purple-600 ring-2 ring-purple-200' : 'border-l-transparent'
                      }`}
                      onClick={() => setSelectedQuestion(question.id)}
                    >
                      <div className="p-6">
                        <div className="flex items-start space-x-4">
                          <div className="flex-shrink-0 pt-1 cursor-grab">
                            <GripVertical size={20} className="text-gray-400" />
                          </div>

                          <div className="flex-1">
                            <div className="flex items-start justify-between">
                              <input
                                type="text"
                                value={question.title}
                                onChange={(e) => {
                                  setForm({
                                    ...form,
                                    questions: form.questions.map((q) =>
                                      q.id === question.id ? { ...q, title: e.target.value } : q
                                    ),
                                  });
                                }}
                                onBlur={() => updateQuestion(question.id, { title: question.title })}
                                className="text-lg text-gray-900 w-full bg-transparent border-none focus:outline-none focus:ring-0 p-0"
                                placeholder="Question"
                              />

                              {isSelected && (
                                <select
                                  value={question.question_type}
                                  onChange={(e) => updateQuestion(question.id, { question_type: e.target.value })}
                                  className="ml-4 text-sm border border-gray-300 rounded px-2 py-1"
                                >
                                  {QUESTION_TYPES.map((type) => (
                                    <option key={type.id} value={type.id}>
                                      {type.name}
                                    </option>
                                  ))}
                                </select>
                              )}
                            </div>

                            {/* Question Preview/Edit based on type */}
                            <div className="mt-4">
                              {question.question_type === 'short_text' && (
                                <input
                                  type="text"
                                  disabled
                                  placeholder="Short answer text"
                                  className="w-full border-b border-gray-300 py-2 text-gray-400 bg-transparent"
                                />
                              )}

                              {question.question_type === 'long_text' && (
                                <textarea
                                  disabled
                                  placeholder="Long answer text"
                                  className="w-full border-b border-gray-300 py-2 text-gray-400 bg-transparent resize-none"
                                  rows={3}
                                />
                              )}

                              {['multiple_choice', 'checkbox', 'dropdown'].includes(question.question_type) && (
                                <div className="space-y-2">
                                  {(question.options || []).map((option, optIndex) => (
                                    <div key={option.id} className="flex items-center space-x-3">
                                      {question.question_type === 'multiple_choice' && (
                                        <div className="w-4 h-4 rounded-full border-2 border-gray-400" />
                                      )}
                                      {question.question_type === 'checkbox' && (
                                        <div className="w-4 h-4 rounded border-2 border-gray-400" />
                                      )}
                                      {question.question_type === 'dropdown' && (
                                        <span className="text-gray-400">{optIndex + 1}.</span>
                                      )}
                                      <input
                                        type="text"
                                        value={option.text}
                                        onChange={(e) => {
                                          const newOptions = [...(question.options || [])];
                                          newOptions[optIndex] = { ...option, text: e.target.value };
                                          setForm({
                                            ...form,
                                            questions: form.questions.map((q) =>
                                              q.id === question.id ? { ...q, options: newOptions } : q
                                            ),
                                          });
                                        }}
                                        onBlur={() => updateQuestion(question.id, { options: question.options })}
                                        className="flex-1 border-b border-transparent hover:border-gray-300 focus:border-purple-500 py-1 focus:outline-none"
                                        placeholder={`Option ${optIndex + 1}`}
                                      />
                                      {isSelected && (question.options || []).length > 1 && (
                                        <button
                                          onClick={() => {
                                            const newOptions = (question.options || []).filter((_, i) => i !== optIndex);
                                            updateQuestion(question.id, { options: newOptions });
                                          }}
                                          className="p-1 text-gray-400 hover:text-red-500"
                                        >
                                          <Trash2 size={16} />
                                        </button>
                                      )}
                                    </div>
                                  ))}
                                  {isSelected && (
                                    <button
                                      onClick={() => {
                                        const newOptions = [
                                          ...(question.options || []),
                                          { id: crypto.randomUUID(), text: `Option ${(question.options?.length || 0) + 1}` },
                                        ];
                                        updateQuestion(question.id, { options: newOptions });
                                      }}
                                      className="flex items-center text-sm text-purple-600 hover:text-purple-700 mt-2"
                                    >
                                      <Plus size={16} className="mr-1" />
                                      Add option
                                    </button>
                                  )}
                                </div>
                              )}

                              {question.question_type === 'scale' && (
                                <div className="flex items-center justify-between py-4">
                                  <span className="text-sm text-gray-500">1</span>
                                  <div className="flex-1 mx-4 flex justify-between">
                                    {[1, 2, 3, 4, 5].map((n) => (
                                      <div
                                        key={n}
                                        className="w-8 h-8 rounded-full border-2 border-gray-300 flex items-center justify-center text-sm text-gray-500"
                                      >
                                        {n}
                                      </div>
                                    ))}
                                  </div>
                                  <span className="text-sm text-gray-500">5</span>
                                </div>
                              )}

                              {question.question_type === 'date' && (
                                <div className="flex items-center space-x-2 text-gray-400">
                                  <Calendar size={20} />
                                  <span>Month, day, year</span>
                                </div>
                              )}

                              {question.question_type === 'time' && (
                                <div className="flex items-center space-x-2 text-gray-400">
                                  <Clock size={20} />
                                  <span>Time</span>
                                </div>
                              )}

                              {question.question_type === 'file' && (
                                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center text-gray-400">
                                  <Upload size={24} className="mx-auto mb-2" />
                                  <span>Add file</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Question Footer */}
                        {isSelected && (
                          <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-end space-x-4">
                            <button
                              onClick={() => duplicateQuestion(question.id)}
                              className="p-2 text-gray-400 hover:text-gray-600"
                              title="Duplicate"
                            >
                              <Copy size={18} />
                            </button>
                            <button
                              onClick={() => deleteQuestion(question.id)}
                              className="p-2 text-gray-400 hover:text-red-500"
                              title="Delete"
                            >
                              <Trash2 size={18} />
                            </button>
                            <div className="w-px h-6 bg-gray-200" />
                            <label className="flex items-center space-x-2 cursor-pointer">
                              <span className="text-sm text-gray-600">Required</span>
                              <button
                                onClick={() => updateQuestion(question.id, { is_required: !question.is_required })}
                                className={`w-10 h-6 rounded-full transition-colors ${
                                  question.is_required ? 'bg-purple-600' : 'bg-gray-300'
                                }`}
                              >
                                <div
                                  className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${
                                    question.is_required ? 'translate-x-5' : 'translate-x-1'
                                  }`}
                                />
                              </button>
                            </label>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Add Question Button */}
                <div className="relative">
                  <button
                    onClick={() => setShowQuestionMenu(!showQuestionMenu)}
                    className="w-full py-4 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-purple-500 hover:text-purple-600 flex items-center justify-center"
                  >
                    <Plus size={20} className="mr-2" />
                    Add question
                  </button>

                  {showQuestionMenu && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowQuestionMenu(false)} />
                      <div className="absolute left-1/2 transform -translate-x-1/2 bottom-full mb-2 bg-white border border-gray-200 rounded-lg shadow-lg py-2 z-50 w-48">
                        {QUESTION_TYPES.map((type) => (
                          <button
                            key={type.id}
                            onClick={() => addQuestion(type.id)}
                            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                          >
                            <type.icon size={16} />
                            <span>{type.name}</span>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </>
            )}

            {activeTab === 'responses' && (
              <div className="bg-white rounded-lg shadow-sm p-6 text-center">
                <BarChart3 className="mx-auto h-16 w-16 text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {form.response_count} responses
                </h3>
                <p className="text-gray-500 mb-4">
                  {form.response_count === 0
                    ? 'No responses yet. Share your form to start collecting responses.'
                    : 'View and analyze your form responses.'}
                </p>
                {form.response_count > 0 && (
                  <Link
                    href={`/forms/${form.id}/responses`}
                    className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                  >
                    View Responses
                  </Link>
                )}
              </div>
            )}

            {activeTab === 'settings' && (
              <div className="bg-white rounded-lg shadow-sm p-6 space-y-6">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Response Settings</h3>
                  <div className="space-y-4">
                    <label className="flex items-center justify-between">
                      <span className="text-gray-700">Collect email addresses</span>
                      <button
                        onClick={() => updateForm({
                          settings: { ...form.settings, collect_email: !form.settings.collect_email }
                        })}
                        className={`w-10 h-6 rounded-full transition-colors ${
                          form.settings.collect_email ? 'bg-purple-600' : 'bg-gray-300'
                        }`}
                      >
                        <div
                          className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${
                            form.settings.collect_email ? 'translate-x-5' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </label>

                    <label className="flex items-center justify-between">
                      <span className="text-gray-700">Allow response editing</span>
                      <button
                        onClick={() => updateForm({
                          settings: { ...form.settings, allow_edit_response: !form.settings.allow_edit_response }
                        })}
                        className={`w-10 h-6 rounded-full transition-colors ${
                          form.settings.allow_edit_response ? 'bg-purple-600' : 'bg-gray-300'
                        }`}
                      >
                        <div
                          className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${
                            form.settings.allow_edit_response ? 'translate-x-5' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </label>

                    <label className="flex items-center justify-between">
                      <span className="text-gray-700">Show progress bar</span>
                      <button
                        onClick={() => updateForm({
                          settings: { ...form.settings, show_progress_bar: !form.settings.show_progress_bar }
                        })}
                        className={`w-10 h-6 rounded-full transition-colors ${
                          form.settings.show_progress_bar ? 'bg-purple-600' : 'bg-gray-300'
                        }`}
                      >
                        <div
                          className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${
                            form.settings.show_progress_bar ? 'translate-x-5' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </label>

                    <label className="flex items-center justify-between">
                      <span className="text-gray-700">Shuffle question order</span>
                      <button
                        onClick={() => updateForm({
                          settings: { ...form.settings, shuffle_questions: !form.settings.shuffle_questions }
                        })}
                        className={`w-10 h-6 rounded-full transition-colors ${
                          form.settings.shuffle_questions ? 'bg-purple-600' : 'bg-gray-300'
                        }`}
                      >
                        <div
                          className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${
                            form.settings.shuffle_questions ? 'translate-x-5' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </label>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Confirmation Message</h3>
                  <textarea
                    value={form.settings.confirmation_message}
                    onChange={(e) => setForm({
                      ...form,
                      settings: { ...form.settings, confirmation_message: e.target.value }
                    })}
                    onBlur={() => updateForm({ settings: form.settings })}
                    className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    rows={3}
                  />
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </>
  );
}
