/**
 * Bheem OForms - Form Fill Page
 * Allows users to fill out published document forms
 */
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { FileText, ArrowLeft, AlertCircle, CheckCircle } from 'lucide-react';
import { api } from '@/lib/api';
import OnlyOfficeFormEditor from '@/components/forms/OnlyOfficeFormEditor';

interface OForm {
  id: string;
  title: string;
  description: string | null;
  form_type: 'docxf' | 'oform';
  status: 'draft' | 'published' | 'closed';
}

export default function FillOForm() {
  const router = useRouter();
  const { id } = router.query;

  const [form, setForm] = useState<OForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  // Fetch form metadata
  const fetchForm = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const response = await api.get(`/oforms/${id}/public`);
      setForm(response.data);

      // Check if form is fillable
      if (response.data.status !== 'published') {
        setError('This form is not accepting responses');
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load form');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      fetchForm();
    }
  }, [id, fetchForm]);

  const handleEditorReady = () => {
    console.log('Form editor ready for filling');
  };

  const handleEditorError = (error: string) => {
    console.error('Form editor error:', error);
    setError(error);
  };

  const handleSave = () => {
    // Form submission handled by OnlyOffice
    setSubmitted(true);
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-white via-[#FFCCF2]/10 to-[#977DFF]/10">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-[#FFCCF2] via-[#977DFF] to-[#0033FF] rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg animate-pulse">
            <FileText className="w-10 h-10 text-white" />
          </div>
          <div className="relative w-12 h-12 mx-auto mb-4">
            <div className="absolute inset-0 rounded-full border-4 border-[#FFCCF2]/30"></div>
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-[#977DFF] animate-spin"></div>
          </div>
          <h3 className="text-lg font-semibold bg-gradient-to-r from-[#977DFF] to-[#0033FF] bg-clip-text text-transparent">
            Bheem Forms
          </h3>
          <p className="mt-2 text-gray-500 text-sm">Loading form...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !form) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-white via-[#FFCCF2]/10 to-[#977DFF]/10">
        <div className="text-center max-w-md p-8 bg-white rounded-2xl shadow-xl border border-[#FFCCF2]/30">
          <div className="w-16 h-16 bg-gradient-to-br from-[#FFCCF2] via-[#977DFF] to-[#0033FF] rounded-2xl flex items-center justify-center mx-auto mb-4 opacity-60">
            <AlertCircle className="h-10 w-10 text-white" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            {error || 'Form not found'}
          </h2>
          <p className="text-gray-600 mb-4">
            This form may have been removed or is not available.
          </p>
          <Link
            href="/"
            className="inline-flex items-center px-5 py-2.5 bg-gradient-to-r from-[#977DFF] to-[#0033FF] text-white rounded-lg hover:opacity-90 transition-all font-medium shadow-md"
          >
            <ArrowLeft size={18} className="mr-2" />
            Go Home
          </Link>
        </div>
      </div>
    );
  }

  // Submitted state
  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-white via-[#FFCCF2]/10 to-[#977DFF]/10">
        <div className="text-center max-w-md p-8 bg-white rounded-2xl shadow-xl border border-[#FFCCF2]/30">
          <div className="w-16 h-16 bg-gradient-to-br from-green-400 to-green-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="h-10 w-10 text-white" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Thank you!
          </h2>
          <p className="text-gray-600 mb-4">
            Your response has been submitted successfully.
          </p>
          <button
            onClick={() => {
              setSubmitted(false);
              window.location.reload();
            }}
            className="inline-flex items-center px-5 py-2.5 bg-gradient-to-r from-[#977DFF] to-[#0033FF] text-white rounded-lg hover:opacity-90 transition-all font-medium shadow-md"
          >
            Submit another response
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>{form.title} - Bheem Forms</title>
      </Head>

      <div className="min-h-screen bg-white flex flex-col">
        {/* Simple Header for Fill Mode */}
        <header className="bg-white border-b border-gray-200 flex-shrink-0 z-20">
          <div className="flex items-center px-4 py-3 gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-[#FFCCF2] via-[#977DFF] to-[#0033FF] rounded-lg flex items-center justify-center shadow-sm">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h1 className="font-medium text-gray-900">{form.title}</h1>
              {form.description && (
                <p className="text-sm text-gray-500">{form.description}</p>
              )}
            </div>
            <span className="px-3 py-1 bg-purple-100 text-purple-700 text-sm font-medium rounded-full">
              Fill Mode
            </span>
          </div>
        </header>

        {/* Form Editor in Fill Mode */}
        <div className="flex-1">
          <OnlyOfficeFormEditor
            formId={form.id}
            mode="fill"
            onReady={handleEditorReady}
            onError={handleEditorError}
            onSave={handleSave}
            className="h-full"
          />
        </div>
      </div>
    </>
  );
}
