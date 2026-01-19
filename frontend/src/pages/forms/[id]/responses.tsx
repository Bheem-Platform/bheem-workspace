/**
 * Bheem Forms - Form Responses
 * View and analyze form responses
 */
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import {
  FileQuestion,
  ArrowLeft,
  Download,
  Trash2,
  BarChart3,
  List,
  Users,
  Calendar,
  CheckCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useRequireAuth } from '@/stores/authStore';
import { api } from '@/lib/api';

interface Question {
  id: string;
  title: string;
  question_type: string;
}

interface FormResponse {
  id: string;
  answers: Record<string, any>;
  respondent_email?: string;
  submitted_at: string;
}

interface QuestionSummary {
  question_id: string;
  title: string;
  question_type: string;
  response_count: number;
  data: {
    counts?: Record<string, number>;
    average?: number;
    min?: number;
    max?: number;
    distribution?: Record<string, number>;
    recent_answers?: string[];
  };
}

interface FormWithResponses {
  id: string;
  title: string;
  response_count: number;
  questions: Question[];
  responses: FormResponse[];
}

interface Summary {
  form_id: string;
  total_responses: number;
  question_summaries: QuestionSummary[];
}

export default function FormResponses() {
  const router = useRouter();
  const { id } = router.query;
  const { isAuthenticated, isLoading: authLoading } = useRequireAuth();

  const [form, setForm] = useState<FormWithResponses | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'summary' | 'individual'>('summary');
  const [expandedResponses, setExpandedResponses] = useState<Set<string>>(new Set());

  const fetchResponses = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);

      // Fetch form with responses
      const formResponse = await api.get(`/forms/${id}/responses`);
      setForm({
        id: id as string,
        title: 'Form',
        response_count: formResponse.data.total,
        questions: formResponse.data.questions,
        responses: formResponse.data.responses,
      });

      // Fetch summary
      const summaryResponse = await api.get(`/forms/${id}/responses/summary`);
      setSummary(summaryResponse.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load responses');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (isAuthenticated && !authLoading && id) {
      fetchResponses();
    }
  }, [isAuthenticated, authLoading, id, fetchResponses]);

  const deleteResponse = async (responseId: string) => {
    if (!id || !confirm('Are you sure you want to delete this response?')) return;
    try {
      await api.delete(`/forms/${id}/responses/${responseId}`);
      setForm((prev) =>
        prev
          ? {
              ...prev,
              responses: prev.responses.filter((r) => r.id !== responseId),
              response_count: prev.response_count - 1,
            }
          : null
      );
    } catch (err) {
      console.error('Failed to delete response:', err);
    }
  };

  const exportResponses = async (format: 'csv' | 'json') => {
    if (!id) return;
    try {
      const response = await api.get(`/forms/${id}/responses/export`, {
        params: { format },
      });

      if (format === 'csv') {
        // Create CSV download
        const headers = response.data.headers.join(',');
        const rows = response.data.rows.map((row: string[]) =>
          row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')
        );
        const csv = [headers, ...rows].join('\n');

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `form-responses-${id}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        // JSON download
        const blob = new Blob([JSON.stringify(response.data, null, 2)], {
          type: 'application/json',
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `form-responses-${id}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error('Failed to export responses:', err);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const toggleResponseExpand = (responseId: string) => {
    setExpandedResponses((prev) => {
      const next = new Set(prev);
      if (next.has(responseId)) {
        next.delete(responseId);
      } else {
        next.add(responseId);
      }
      return next;
    });
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <FileQuestion className="mx-auto h-16 w-16 text-gray-400" />
          <h2 className="mt-4 text-xl font-medium text-gray-900">{error}</h2>
          <Link
            href="/forms"
            className="mt-4 inline-flex items-center text-purple-600 hover:text-purple-700"
          >
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
        <title>Responses - Bheem Forms</title>
      </Head>

      <div className="min-h-screen bg-gray-100">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
          <div className="max-w-6xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Link
                  href={`/forms/${id}/edit`}
                  className="p-2 hover:bg-gray-100 rounded-full"
                >
                  <ArrowLeft size={20} />
                </Link>
                <div>
                  <h1 className="text-lg font-medium text-gray-900">Responses</h1>
                  <p className="text-sm text-gray-500">
                    {form.response_count} {form.response_count === 1 ? 'response' : 'responses'}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden">
                  <button
                    onClick={() => setViewMode('summary')}
                    className={`px-4 py-2 text-sm flex items-center space-x-1 ${
                      viewMode === 'summary'
                        ? 'bg-purple-100 text-purple-700'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <BarChart3 size={16} />
                    <span>Summary</span>
                  </button>
                  <button
                    onClick={() => setViewMode('individual')}
                    className={`px-4 py-2 text-sm flex items-center space-x-1 ${
                      viewMode === 'individual'
                        ? 'bg-purple-100 text-purple-700'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <List size={16} />
                    <span>Individual</span>
                  </button>
                </div>

                <div className="relative group">
                  <button className="flex items-center px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
                    <Download size={16} className="mr-2" />
                    Export
                  </button>
                  <div className="absolute right-0 top-full mt-1 hidden group-hover:block bg-white border border-gray-200 rounded-lg shadow-lg py-1 w-32">
                    <button
                      onClick={() => exportResponses('csv')}
                      className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                    >
                      Export CSV
                    </button>
                    <button
                      onClick={() => exportResponses('json')}
                      className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                    >
                      Export JSON
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-4 py-8">
          {form.response_count === 0 ? (
            <div className="bg-white rounded-lg shadow-sm p-12 text-center">
              <Users className="mx-auto h-16 w-16 text-gray-300 mb-4" />
              <h2 className="text-xl font-medium text-gray-900 mb-2">No responses yet</h2>
              <p className="text-gray-500 mb-6">Share your form to start collecting responses.</p>
              <Link
                href={`/forms/${id}/edit`}
                className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                Back to Form
              </Link>
            </div>
          ) : viewMode === 'summary' ? (
            <div className="space-y-6">
              {/* Summary Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <div className="flex items-center space-x-3">
                    <div className="p-3 bg-purple-100 rounded-lg">
                      <CheckCircle size={24} className="text-purple-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-gray-900">{form.response_count}</p>
                      <p className="text-sm text-gray-500">Total Responses</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow-sm p-6">
                  <div className="flex items-center space-x-3">
                    <div className="p-3 bg-blue-100 rounded-lg">
                      <BarChart3 size={24} className="text-blue-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-gray-900">
                        {form.questions.length}
                      </p>
                      <p className="text-sm text-gray-500">Questions</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow-sm p-6">
                  <div className="flex items-center space-x-3">
                    <div className="p-3 bg-green-100 rounded-lg">
                      <Calendar size={24} className="text-green-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-gray-900">
                        {form.responses.length > 0
                          ? new Date(form.responses[0].submitted_at).toLocaleDateString()
                          : '-'}
                      </p>
                      <p className="text-sm text-gray-500">Last Response</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Question Summaries */}
              {summary?.question_summaries.map((qs, index) => (
                <div key={qs.question_id} className="bg-white rounded-lg shadow-sm p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-1">{qs.title}</h3>
                  <p className="text-sm text-gray-500 mb-4">
                    {qs.response_count} responses
                  </p>

                  {/* Multiple Choice / Checkbox / Dropdown Summary */}
                  {['multiple_choice', 'checkbox', 'dropdown'].includes(qs.question_type) &&
                    qs.data.counts && (
                      <div className="space-y-3">
                        {Object.entries(qs.data.counts).map(([option, count]) => {
                          const percentage =
                            qs.response_count > 0
                              ? Math.round((count / qs.response_count) * 100)
                              : 0;
                          return (
                            <div key={option}>
                              <div className="flex items-center justify-between text-sm mb-1">
                                <span className="text-gray-700">{option}</span>
                                <span className="text-gray-500">
                                  {count} ({percentage}%)
                                </span>
                              </div>
                              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-purple-600 rounded-full"
                                  style={{ width: `${percentage}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                  {/* Scale Summary */}
                  {qs.question_type === 'scale' && qs.data.average !== undefined && (
                    <div className="space-y-4">
                      <div className="flex items-center space-x-4">
                        <div className="text-center">
                          <p className="text-3xl font-bold text-purple-600">
                            {qs.data.average.toFixed(1)}
                          </p>
                          <p className="text-sm text-gray-500">Average</p>
                        </div>
                        <div className="flex-1 flex items-center space-x-2">
                          {qs.data.distribution &&
                            Object.entries(qs.data.distribution).map(([value, count]) => (
                              <div key={value} className="flex-1 text-center">
                                <div
                                  className="bg-purple-100 rounded mx-auto"
                                  style={{
                                    height: `${Math.max(
                                      20,
                                      (count / qs.response_count) * 100
                                    )}px`,
                                    width: '100%',
                                  }}
                                />
                                <p className="text-xs text-gray-500 mt-1">{value}</p>
                              </div>
                            ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Text Answers */}
                  {['short_text', 'long_text'].includes(qs.question_type) &&
                    qs.data.recent_answers && (
                      <div className="space-y-2">
                        {qs.data.recent_answers.slice(0, 5).map((answer, i) => (
                          <div
                            key={i}
                            className="p-3 bg-gray-50 rounded-lg text-sm text-gray-700"
                          >
                            {answer}
                          </div>
                        ))}
                        {qs.data.recent_answers.length > 5 && (
                          <p className="text-sm text-gray-500">
                            +{qs.data.recent_answers.length - 5} more responses
                          </p>
                        )}
                      </div>
                    )}
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {form.responses.map((response, index) => (
                <div
                  key={response.id}
                  className="bg-white rounded-lg shadow-sm overflow-hidden"
                >
                  <button
                    onClick={() => toggleResponseExpand(response.id)}
                    className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50"
                  >
                    <div className="flex items-center space-x-4">
                      <span className="text-sm font-medium text-gray-500">
                        #{index + 1}
                      </span>
                      {response.respondent_email && (
                        <span className="text-sm text-gray-700">
                          {response.respondent_email}
                        </span>
                      )}
                      <span className="text-sm text-gray-500">
                        {formatDate(response.submitted_at)}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteResponse(response.id);
                        }}
                        className="p-2 text-gray-400 hover:text-red-500"
                        title="Delete response"
                      >
                        <Trash2 size={16} />
                      </button>
                      {expandedResponses.has(response.id) ? (
                        <ChevronUp size={20} className="text-gray-400" />
                      ) : (
                        <ChevronDown size={20} className="text-gray-400" />
                      )}
                    </div>
                  </button>

                  {expandedResponses.has(response.id) && (
                    <div className="px-6 pb-6 border-t border-gray-100">
                      <div className="pt-4 space-y-4">
                        {form.questions.map((question) => {
                          const answer = response.answers[question.id];
                          const isFileAnswer = answer && typeof answer === 'object' && answer.file_name;
                          return (
                            <div key={question.id}>
                              <p className="text-sm font-medium text-gray-500 mb-1">
                                {question.title}
                              </p>
                              {isFileAnswer ? (
                                <div className="flex items-center space-x-2">
                                  <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                                  </svg>
                                  {answer.share_url ? (
                                    <a
                                      href={answer.share_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-purple-600 hover:text-purple-700 hover:underline font-medium"
                                    >
                                      {answer.file_name}
                                    </a>
                                  ) : (
                                    <span className="text-gray-900">{answer.file_name}</span>
                                  )}
                                  {answer.file_size && (
                                    <span className="text-xs text-gray-500">
                                      ({(answer.file_size / 1024 / 1024).toFixed(2)} MB)
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <p className="text-gray-900">
                                  {answer === undefined || answer === null || answer === ''
                                    ? '-'
                                    : Array.isArray(answer)
                                    ? answer.join(', ')
                                    : String(answer)}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </>
  );
}
