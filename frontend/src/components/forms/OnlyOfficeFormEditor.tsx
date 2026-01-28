/**
 * Bheem Forms - OnlyOffice Form Editor Component
 *
 * Full document forms editing with real-time collaboration.
 * Supports DOCXF (form templates) and OFORM (fillable forms).
 * Features:
 * - Form field creation and editing
 * - Real-time collaboration
 * - Form filling mode
 * - Auto-save
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { api } from '@/lib/api';

interface DocEditorInstance {
  destroyEditor: () => void;
  refreshHistory: (data: any) => void;
}

interface OnlyOfficeFormEditorProps {
  formId: string;
  mode?: 'edit' | 'view' | 'fill';
  onReady?: () => void;
  onError?: (error: string) => void;
  onDocumentReady?: () => void;
  onSave?: () => void;
  className?: string;
}

// OnlyOffice Document Server URL
const ONLYOFFICE_URL = process.env.NEXT_PUBLIC_ONLYOFFICE_URL || 'https://office.bheem.cloud';

export default function OnlyOfficeFormEditor({
  formId,
  mode = 'edit',
  onReady,
  onError,
  onDocumentReady,
  onSave,
  className = '',
}: OnlyOfficeFormEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<DocEditorInstance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);

  // Load OnlyOffice API script
  const loadOnlyOfficeScript = useCallback(() => {
    return new Promise<void>((resolve, reject) => {
      // Check if already loaded
      if ((window as any).DocsAPI) {
        resolve();
        return;
      }

      // Check if script is already in document
      const existingScript = document.querySelector(`script[src*="api.js"]`);
      if (existingScript) {
        existingScript.addEventListener('load', () => resolve());
        existingScript.addEventListener('error', () => reject(new Error('Failed to load OnlyOffice script')));
        return;
      }

      // Load script
      const script = document.createElement('script');
      script.src = `${ONLYOFFICE_URL}/web-apps/apps/api/documents/api.js`;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load OnlyOffice script'));
      document.head.appendChild(script);
    });
  }, []);

  // Fetch editor configuration from backend
  const fetchEditorConfig = useCallback(async () => {
    try {
      const response = await api.get(`/oforms/${formId}/editor-config`, {
        params: { mode },
      });
      return response.data;
    } catch (err: any) {
      throw new Error(err.response?.data?.detail || 'Failed to load editor configuration');
    }
  }, [formId, mode]);

  // Initialize editor
  const initializeEditor = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Load OnlyOffice script
      await loadOnlyOfficeScript();
      setScriptLoaded(true);

      // Fetch config from backend
      const { config, documentServerUrl } = await fetchEditorConfig();

      // Wait for container to be ready
      if (!containerRef.current) {
        throw new Error('Editor container not found');
      }

      // Destroy existing editor if any
      if (editorRef.current) {
        try {
          editorRef.current.destroyEditor();
        } catch (e) {
          console.warn('Error destroying existing editor:', e);
        }
        editorRef.current = null;
      }

      // Add event handlers to config
      const configWithEvents = {
        ...config,
        events: {
          onReady: () => {
            console.log('OnlyOffice Forms onReady event fired');
            setLoading(false);
            onReady?.();
          },
          onDocumentReady: () => {
            console.log('OnlyOffice Forms onDocumentReady event fired');
            setLoading(false);
            onDocumentReady?.();
          },
          onAppReady: () => {
            console.log('OnlyOffice Forms onAppReady event fired');
            setLoading(false);
          },
          onError: (event: any) => {
            const errorMsg = event?.data?.errorDescription || 'Unknown editor error';
            console.error('OnlyOffice Forms error:', errorMsg, event);
            setError(errorMsg);
            setLoading(false);
            onError?.(errorMsg);
          },
          onDocumentStateChange: (event: any) => {
            // Document has unsaved changes if event.data is true
            if (!event.data) {
              onSave?.();
            }
          },
          onWarning: (event: any) => {
            console.warn('OnlyOffice Forms warning:', event);
          },
          onRequestSubmit: (event: any) => {
            // Handle form submission (for OFORM fill mode)
            console.log('Form submit requested:', event);
          },
        },
      };

      // Create editor instance
      if ((window as any).DocsAPI) {
        editorRef.current = new (window as any).DocsAPI.DocEditor(
          'onlyoffice-form-editor-container',
          configWithEvents
        );
      } else {
        throw new Error('OnlyOffice API not available');
      }
    } catch (err: any) {
      console.error('Failed to initialize OnlyOffice Forms editor:', err);
      setError(err.message);
      setLoading(false);
      onError?.(err.message);
    }
  }, [loadOnlyOfficeScript, fetchEditorConfig, onReady, onError, onDocumentReady, onSave]);

  // Initialize on mount
  useEffect(() => {
    initializeEditor();

    // Timeout fallback - if loading doesn't complete in 15 seconds, show editor anyway
    const loadingTimeout = setTimeout(() => {
      setLoading(false);
      console.log('OnlyOffice Forms loading timeout - showing editor');
    }, 15000);

    // Cleanup on unmount
    return () => {
      clearTimeout(loadingTimeout);
      if (editorRef.current) {
        try {
          editorRef.current.destroyEditor();
        } catch (e) {
          console.warn('Error destroying editor:', e);
        }
        editorRef.current = null;
      }
    };
  }, [formId, mode]);

  const isSSLError = error && (error.includes('script') || error.includes('API') || error.includes('load'));

  return (
    <div
      className={`relative ${className}`}
      ref={containerRef}
      style={{
        height: 'calc(100vh - 64px)',
        minHeight: 'calc(100vh - 64px)',
        width: '100%',
        position: 'relative',
      }}
    >
      {/* Editor container - always present */}
      <div
        id="onlyoffice-form-editor-container"
        style={{
          width: '100%',
          height: 'calc(100vh - 64px)',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          visibility: loading || error ? 'hidden' : 'visible',
        }}
      />

      {/* Loading overlay */}
      {loading && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-white via-[#FFCCF2]/10 to-[#977DFF]/10">
          <div className="text-center">
            {/* Bheem Logo */}
            <div className="w-16 h-16 bg-gradient-to-br from-[#FFCCF2] via-[#977DFF] to-[#0033FF] rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg animate-pulse">
              <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            {/* Gradient spinner */}
            <div className="relative w-12 h-12 mx-auto mb-4">
              <div className="absolute inset-0 rounded-full border-4 border-[#FFCCF2]/30"></div>
              <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-[#977DFF] animate-spin"></div>
            </div>
            <h3 className="text-lg font-semibold bg-gradient-to-r from-[#977DFF] to-[#0033FF] bg-clip-text text-transparent">
              Bheem Forms
            </h3>
            <p className="mt-2 text-gray-500 text-sm">
              {scriptLoaded ? 'Initializing form editor...' : 'Loading form...'}
            </p>
          </div>
        </div>
      )}

      {/* Error overlay */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-white via-[#FFCCF2]/10 to-[#977DFF]/10">
          <div className="text-center max-w-md p-8 bg-white rounded-2xl shadow-xl border border-[#FFCCF2]/30">
            <div className="w-16 h-16 bg-gradient-to-br from-[#FFCCF2] via-[#977DFF] to-[#0033FF] rounded-2xl flex items-center justify-center mx-auto mb-4 opacity-60">
              <svg className="h-10 w-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold bg-gradient-to-r from-[#977DFF] to-[#0033FF] bg-clip-text text-transparent mb-2">
              Bheem Forms Connection Issue
            </h3>
            {isSSLError ? (
              <>
                <p className="text-gray-600 text-sm mb-4">
                  Unable to connect to the document server. This may be due to a certificate issue.
                </p>
                <p className="text-gray-500 text-xs mb-4">
                  Try visiting <a href={ONLYOFFICE_URL} target="_blank" rel="noopener noreferrer" className="text-[#977DFF] underline hover:text-[#0033FF]">{ONLYOFFICE_URL}</a> directly and accepting the certificate, then retry.
                </p>
              </>
            ) : (
              <p className="text-gray-600 text-sm mb-4">{error}</p>
            )}
            <div className="flex gap-3 justify-center">
              <button
                onClick={initializeEditor}
                className="px-5 py-2.5 bg-gradient-to-r from-[#977DFF] to-[#0033FF] text-white rounded-lg hover:opacity-90 transition-all font-medium shadow-md"
              >
                Retry
              </button>
              <a
                href={ONLYOFFICE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="px-5 py-2.5 bg-[#FFCCF2]/30 text-[#0033FF] rounded-lg hover:bg-[#FFCCF2]/50 transition-colors font-medium"
              >
                Open Server
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Hook to check if Bheem Forms editor is available
 */
export function useOnlyOfficeFormAvailable() {
  const [available, setAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    const checkAvailability = async () => {
      try {
        const response = await fetch(`${ONLYOFFICE_URL}/healthcheck`, {
          method: 'GET',
          mode: 'no-cors',
        }).catch(() => null);

        // With no-cors, we can't read the response, but if fetch doesn't throw, server is likely up
        setAvailable(true);
      } catch (err) {
        console.warn('Document server check failed:', err);
        setAvailable(true); // Default to true and let editor handle errors
      }
    };

    checkAvailability();
  }, []);

  return available;
}
