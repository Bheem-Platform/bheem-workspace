/**
 * Bheem Docs - OnlyOffice Document Editor Component
 *
 * Full Word-compatible document editing with real-time collaboration.
 * Features:
 * - Real-time collaboration
 * - Full formatting support
 * - Track changes and comments
 * - Auto-save
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { api } from '@/lib/api';

interface DocEditorInstance {
  destroyEditor: () => void;
  refreshHistory: (data: any) => void;
}

interface OnlyOfficeDocEditorProps {
  documentId: string;
  mode?: 'edit' | 'view' | 'review';
  onReady?: () => void;
  onError?: (error: string) => void;
  onDocumentReady?: () => void;
  onSave?: () => void;
  className?: string;
}

// OnlyOffice Document Server URL
const ONLYOFFICE_URL = process.env.NEXT_PUBLIC_ONLYOFFICE_URL || 'https://office.bheem.cloud';

export default function OnlyOfficeDocEditor({
  documentId,
  mode = 'edit',
  onReady,
  onError,
  onDocumentReady,
  onSave,
  className = '',
}: OnlyOfficeDocEditorProps) {
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
      const response = await api.get(`/docs/v2/documents/${documentId}/editor-config`, {
        params: { mode },
      });
      return response.data;
    } catch (err: any) {
      throw new Error(err.response?.data?.detail || 'Failed to load editor configuration');
    }
  }, [documentId, mode]);

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
        editorRef.current.destroyEditor();
        editorRef.current = null;
      }

      // Add event handlers to config
      const configWithEvents = {
        ...config,
        events: {
          onReady: () => {
            console.log('OnlyOffice Docs onReady event fired');
            setLoading(false);
            onReady?.();
          },
          onDocumentReady: () => {
            console.log('OnlyOffice Docs onDocumentReady event fired');
            setLoading(false);
            onDocumentReady?.();
          },
          onAppReady: () => {
            console.log('OnlyOffice Docs onAppReady event fired');
            setLoading(false);
          },
          onError: (event: any) => {
            const errorMsg = event?.data?.errorDescription || 'Unknown editor error';
            console.error('OnlyOffice Docs error:', errorMsg, event);
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
            console.warn('OnlyOffice Docs warning:', event);
          },
        },
      };

      // Create editor instance
      if ((window as any).DocsAPI) {
        editorRef.current = new (window as any).DocsAPI.DocEditor(
          'onlyoffice-doc-editor-container',
          configWithEvents
        );
      } else {
        throw new Error('OnlyOffice API not available');
      }
    } catch (err: any) {
      console.error('Failed to initialize OnlyOffice Docs editor:', err);
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
      console.log('OnlyOffice Docs loading timeout - showing editor');
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
  }, [documentId, mode]);

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
        id="onlyoffice-doc-editor-container"
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
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">
              {scriptLoaded ? 'Initializing Bheem Docs...' : 'Loading document editor...'}
            </p>
          </div>
        </div>
      )}

      {/* Error overlay */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
          <div className="text-center max-w-md p-6">
            <div className="text-yellow-500 mb-4">
              <svg className="h-16 w-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Bheem Docs Connection Issue
            </h3>
            {isSSLError ? (
              <>
                <p className="text-gray-600 text-sm mb-4">
                  Unable to connect to the document server. This may be due to a certificate issue.
                </p>
                <p className="text-gray-500 text-xs mb-4">
                  Try visiting <a href={ONLYOFFICE_URL} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">{ONLYOFFICE_URL}</a> directly and accepting the certificate, then retry.
                </p>
              </>
            ) : (
              <p className="text-gray-600 text-sm mb-4">{error}</p>
            )}
            <div className="flex gap-2 justify-center">
              <button
                onClick={initializeEditor}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Retry
              </button>
              <a
                href={ONLYOFFICE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
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
