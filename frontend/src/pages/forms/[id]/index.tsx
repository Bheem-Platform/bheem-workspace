/**
 * Bheem Forms - Public Form View
 * Form submission page for respondents
 */
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import {
  FileQuestion,
  CheckCircle,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Loader2,
} from 'lucide-react';
import { api } from '@/lib/api';

interface QuestionOption {
  id: string;
  text: string;
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

interface PublicForm {
  id: string;
  title: string;
  description: string | null;
  theme: {
    color_primary: string;
    color_background: string;
    font_family: string;
    header_image: string | null;
  };
  settings: {
    show_progress_bar: boolean;
    shuffle_questions: boolean;
    collect_email: boolean;
  };
  questions: Question[];
}

export default function PublicFormView() {
  const router = useRouter();
  const { id } = router.query;

  const [form, setForm] = useState<PublicForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [fileUploads, setFileUploads] = useState<Record<string, File>>({});
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [respondentEmail, setRespondentEmail] = useState('');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [confirmationMessage, setConfirmationMessage] = useState('');

  const fetchForm = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const response = await api.get(`/forms/${id}/public`);
      setForm(response.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Form not available');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      fetchForm();
    }
  }, [id, fetchForm]);

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (form?.settings.collect_email && !respondentEmail) {
      errors.email = 'Email is required';
    } else if (respondentEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(respondentEmail)) {
      errors.email = 'Please enter a valid email address';
    }

    form?.questions.forEach((question) => {
      if (question.is_required) {
        const answer = answers[question.id];
        if (!answer || (Array.isArray(answer) && answer.length === 0)) {
          errors[question.id] = 'This question is required';
        }
      }
    });

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (!form || !validateForm()) return;

    try {
      setIsSubmitting(true);

      // First create the response
      const response = await api.post(`/forms/${form.id}/responses`, {
        answers: Object.entries(answers).map(([question_id, value]) => ({
          question_id,
          value: fileUploads[question_id] ? value : value, // Keep filename for files
        })),
        respondent_email: respondentEmail || undefined,
      });

      const responseId = response.data.response_id;

      // Upload any files to Nextcloud
      const fileQuestionIds = Object.keys(fileUploads);
      for (const questionId of fileQuestionIds) {
        const file = fileUploads[questionId];
        if (file) {
          try {
            setUploadProgress((prev) => ({ ...prev, [questionId]: 0 }));

            const formData = new FormData();
            formData.append('file', file);
            formData.append('question_id', questionId);

            await api.post(
              `/forms/${form.id}/responses/${responseId}/upload-public`,
              formData,
              {
                headers: { 'Content-Type': 'multipart/form-data' },
                onUploadProgress: (progressEvent) => {
                  const percentCompleted = Math.round(
                    (progressEvent.loaded * 100) / (progressEvent.total || 1)
                  );
                  setUploadProgress((prev) => ({ ...prev, [questionId]: percentCompleted }));
                },
              }
            );

            setUploadProgress((prev) => ({ ...prev, [questionId]: 100 }));
          } catch (uploadErr) {
            console.error(`Failed to upload file for question ${questionId}:`, uploadErr);
            // Continue with other files even if one fails
          }
        }
      }

      setConfirmationMessage(response.data.message);
      setIsSubmitted(true);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to submit response');
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateAnswer = (questionId: string, value: any) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
    if (validationErrors[questionId]) {
      setValidationErrors((prev) => {
        const next = { ...prev };
        delete next[questionId];
        return next;
      });
    }
  };

  if (loading) {
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
          <AlertCircle className="mx-auto h-16 w-16 text-red-400 mb-4" />
          <h2 className="text-xl font-medium text-gray-900 mb-2">Form Not Available</h2>
          <p className="text-gray-500">{error}</p>
          <Link href="/" className="mt-4 inline-flex items-center text-purple-600 hover:text-purple-700">
            <ArrowLeft size={20} className="mr-1" />
            Go Home
          </Link>
        </div>
      </div>
    );
  }

  if (!form) return null;

  // Submitted State
  if (isSubmitted) {
    return (
      <>
        <Head>
          <title>Response Submitted - {form.title}</title>
        </Head>
        <div
          className="min-h-screen flex items-center justify-center p-4"
          style={{ backgroundColor: form.theme.color_background }}
        >
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
            <CheckCircle className="mx-auto h-16 w-16 text-green-500 mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Thank You!</h2>
            <p className="text-gray-600 mb-6">{confirmationMessage}</p>
            <button
              onClick={() => {
                setIsSubmitted(false);
                setAnswers({});
                setFileUploads({});
                setUploadProgress({});
                setRespondentEmail('');
              }}
              className="text-purple-600 hover:text-purple-700"
            >
              Submit another response
            </button>
          </div>
        </div>
      </>
    );
  }

  const progress = form.questions.length > 0
    ? (Object.keys(answers).filter(k => answers[k]).length / form.questions.length) * 100
    : 0;

  return (
    <>
      <Head>
        <title>{form.title}</title>
      </Head>

      <div
        className="min-h-screen py-8 px-4"
        style={{ backgroundColor: form.theme.color_background }}
      >
        {/* Progress Bar */}
        {form.settings.show_progress_bar && form.questions.length > 0 && (
          <div className="max-w-2xl mx-auto mb-4">
            <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full transition-all duration-300"
                style={{
                  width: `${progress}%`,
                  backgroundColor: form.theme.color_primary,
                }}
              />
            </div>
          </div>
        )}

        <div className="max-w-2xl mx-auto">
          {/* Form Header */}
          <div
            className="bg-white rounded-lg shadow-sm border-t-4 mb-4 overflow-hidden"
            style={{ borderTopColor: form.theme.color_primary }}
          >
            {form.theme.header_image && (
              <img
                src={form.theme.header_image}
                alt=""
                className="w-full h-48 object-cover"
              />
            )}
            <div className="p-6">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">{form.title}</h1>
              {form.description && (
                <p className="text-gray-600">{form.description}</p>
              )}
              {form.settings.collect_email && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-sm text-red-600 mb-2">* Required</p>
                </div>
              )}
            </div>
          </div>

          {/* Email Collection */}
          {form.settings.collect_email && (
            <div className="bg-white rounded-lg shadow-sm mb-4 p-6">
              <label className="block">
                <span className="text-gray-900">
                  Email <span className="text-red-600">*</span>
                </span>
                <input
                  type="email"
                  value={respondentEmail}
                  onChange={(e) => {
                    setRespondentEmail(e.target.value);
                    if (validationErrors.email) {
                      setValidationErrors((prev) => {
                        const next = { ...prev };
                        delete next.email;
                        return next;
                      });
                    }
                  }}
                  className={`mt-2 w-full border-b-2 ${
                    validationErrors.email ? 'border-red-500' : 'border-gray-300'
                  } py-2 focus:border-purple-500 focus:outline-none`}
                  placeholder="Your email"
                />
                {validationErrors.email && (
                  <p className="mt-1 text-sm text-red-600">{validationErrors.email}</p>
                )}
              </label>
            </div>
          )}

          {/* Questions */}
          {form.questions.map((question, index) => (
            <div key={question.id} className="bg-white rounded-lg shadow-sm mb-4 p-6">
              <div className="mb-4">
                <h3 className="text-gray-900">
                  {question.title}
                  {question.is_required && <span className="text-red-600 ml-1">*</span>}
                </h3>
                {question.description && (
                  <p className="text-sm text-gray-500 mt-1">{question.description}</p>
                )}
              </div>

              {/* Short Text */}
              {question.question_type === 'short_text' && (
                <input
                  type="text"
                  value={answers[question.id] || ''}
                  onChange={(e) => updateAnswer(question.id, e.target.value)}
                  className={`w-full border-b-2 ${
                    validationErrors[question.id] ? 'border-red-500' : 'border-gray-300'
                  } py-2 focus:border-purple-500 focus:outline-none`}
                  placeholder="Your answer"
                />
              )}

              {/* Long Text */}
              {question.question_type === 'long_text' && (
                <textarea
                  value={answers[question.id] || ''}
                  onChange={(e) => updateAnswer(question.id, e.target.value)}
                  className={`w-full border-2 ${
                    validationErrors[question.id] ? 'border-red-500' : 'border-gray-300'
                  } rounded-lg p-3 focus:border-purple-500 focus:outline-none resize-none`}
                  rows={4}
                  placeholder="Your answer"
                />
              )}

              {/* Multiple Choice */}
              {question.question_type === 'multiple_choice' && (
                <div className="space-y-2">
                  {(question.options || []).map((option) => (
                    <label
                      key={option.id}
                      className="flex items-center space-x-3 cursor-pointer group"
                    >
                      <input
                        type="radio"
                        name={question.id}
                        checked={answers[question.id] === option.text}
                        onChange={() => updateAnswer(question.id, option.text)}
                        className="w-4 h-4 text-purple-600 focus:ring-purple-500"
                      />
                      <span className="text-gray-700 group-hover:text-gray-900">
                        {option.text}
                      </span>
                    </label>
                  ))}
                </div>
              )}

              {/* Checkbox */}
              {question.question_type === 'checkbox' && (
                <div className="space-y-2">
                  {(question.options || []).map((option) => (
                    <label
                      key={option.id}
                      className="flex items-center space-x-3 cursor-pointer group"
                    >
                      <input
                        type="checkbox"
                        checked={(answers[question.id] || []).includes(option.text)}
                        onChange={(e) => {
                          const current = answers[question.id] || [];
                          if (e.target.checked) {
                            updateAnswer(question.id, [...current, option.text]);
                          } else {
                            updateAnswer(question.id, current.filter((v: string) => v !== option.text));
                          }
                        }}
                        className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                      />
                      <span className="text-gray-700 group-hover:text-gray-900">
                        {option.text}
                      </span>
                    </label>
                  ))}
                </div>
              )}

              {/* Dropdown */}
              {question.question_type === 'dropdown' && (
                <select
                  value={answers[question.id] || ''}
                  onChange={(e) => updateAnswer(question.id, e.target.value)}
                  className={`w-full border-2 ${
                    validationErrors[question.id] ? 'border-red-500' : 'border-gray-300'
                  } rounded-lg p-3 focus:border-purple-500 focus:outline-none`}
                >
                  <option value="">Choose</option>
                  {(question.options || []).map((option) => (
                    <option key={option.id} value={option.text}>
                      {option.text}
                    </option>
                  ))}
                </select>
              )}

              {/* Date */}
              {question.question_type === 'date' && (
                <input
                  type="date"
                  value={answers[question.id] || ''}
                  onChange={(e) => updateAnswer(question.id, e.target.value)}
                  className={`w-full border-2 ${
                    validationErrors[question.id] ? 'border-red-500' : 'border-gray-300'
                  } rounded-lg p-3 focus:border-purple-500 focus:outline-none`}
                />
              )}

              {/* Time */}
              {question.question_type === 'time' && (
                <input
                  type="time"
                  value={answers[question.id] || ''}
                  onChange={(e) => updateAnswer(question.id, e.target.value)}
                  className={`w-full border-2 ${
                    validationErrors[question.id] ? 'border-red-500' : 'border-gray-300'
                  } rounded-lg p-3 focus:border-purple-500 focus:outline-none`}
                />
              )}

              {/* Linear Scale */}
              {question.question_type === 'scale' && (
                <div className="flex items-center justify-between py-4">
                  <span className="text-sm text-gray-500">1</span>
                  <div className="flex-1 mx-4 flex justify-between">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => updateAnswer(question.id, n)}
                        className={`w-10 h-10 rounded-full border-2 flex items-center justify-center text-sm transition-colors ${
                          answers[question.id] === n
                            ? 'border-purple-600 bg-purple-600 text-white'
                            : 'border-gray-300 text-gray-600 hover:border-purple-400'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                  <span className="text-sm text-gray-500">5</span>
                </div>
              )}

              {/* File Upload */}
              {question.question_type === 'file' && (
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <input
                    type="file"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        // Validate file size (max 50MB)
                        if (file.size > 50 * 1024 * 1024) {
                          setValidationErrors((prev) => ({
                            ...prev,
                            [question.id]: 'File too large. Maximum size is 50MB',
                          }));
                          return;
                        }
                        // Store the file object for upload
                        setFileUploads((prev) => ({ ...prev, [question.id]: file }));
                        updateAnswer(question.id, file.name);
                      }
                    }}
                    className="hidden"
                    id={`file-${question.id}`}
                  />
                  {fileUploads[question.id] ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-center space-x-2">
                        <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-gray-700 font-medium">{fileUploads[question.id].name}</span>
                      </div>
                      <p className="text-sm text-gray-500">
                        {(fileUploads[question.id].size / 1024 / 1024).toFixed(2)} MB
                      </p>
                      {uploadProgress[question.id] !== undefined && uploadProgress[question.id] < 100 && (
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${uploadProgress[question.id]}%` }}
                          />
                        </div>
                      )}
                      <label
                        htmlFor={`file-${question.id}`}
                        className="cursor-pointer text-sm text-purple-600 hover:text-purple-700"
                      >
                        Change file
                      </label>
                    </div>
                  ) : (
                    <label
                      htmlFor={`file-${question.id}`}
                      className="cursor-pointer"
                    >
                      <svg className="mx-auto w-12 h-12 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      <span className="text-purple-600 hover:text-purple-700">Click to upload file</span>
                      <p className="text-xs text-gray-500 mt-1">Max 50MB</p>
                    </label>
                  )}
                </div>
              )}

              {validationErrors[question.id] && (
                <p className="mt-2 text-sm text-red-600">{validationErrors[question.id]}</p>
              )}
            </div>
          ))}

          {/* Submit Button */}
          <div className="flex justify-between items-center">
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-6 py-3 text-white rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center"
              style={{ backgroundColor: form.theme.color_primary }}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={20} className="mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                'Submit'
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setAnswers({});
                setFileUploads({});
                setUploadProgress({});
                setRespondentEmail('');
                setValidationErrors({});
              }}
              className="text-gray-500 hover:text-gray-700"
            >
              Clear form
            </button>
          </div>

          {/* Footer */}
          <div className="mt-8 text-center text-sm text-gray-500">
            <p>Never submit passwords through Bheem Forms.</p>
            <p className="mt-1">
              Powered by{' '}
              <Link href="/" className="text-purple-600 hover:text-purple-700">
                Bheem Workspace
              </Link>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
