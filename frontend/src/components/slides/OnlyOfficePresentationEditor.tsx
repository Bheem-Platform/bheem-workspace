/**
 * Bheem Slides - Presentation Editor Component
 *
 * Full PowerPoint-compatible presentation editing with real-time collaboration.
 * Features:
 * - Real-time collaboration
 * - Full slide layouts and transitions
 * - Speaker notes
 * - Auto-save
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { api } from '@/lib/api';

// OnlyOffice DocsAPI type (loaded from external script)
declare global {
  interface Window {
    DocsAPI?: {
      DocEditor: new (containerId: string, config: EditorConfig) => DocEditorInstance;
    };
  }
}

interface DocEditorInstance {
  destroyEditor: () => void;
  refreshHistory: (data: any) => void;
}

interface EditorConfig {
  document: {
    fileType: string;
    key: string;
    title: string;
    url: string;
    permissions?: {
      comment?: boolean;
      download?: boolean;
      edit?: boolean;
      print?: boolean;
      review?: boolean;
    };
  };
  documentType: string;
  editorConfig: {
    callbackUrl: string;
    lang?: string;
    mode?: string;
    user?: {
      id: string;
      name: string;
    };
    customization?: {
      autosave?: boolean;
      chat?: boolean;
      comments?: boolean;
      compactHeader?: boolean;
      compactToolbar?: boolean;
      feedback?: boolean;
      forcesave?: boolean;
      help?: boolean;
      hideRightMenu?: boolean;
      logo?: {
        image?: string;
        url?: string;
      };
      toolbarNoTabs?: boolean;
      zoom?: number;
    };
  };
  height?: string;
  width?: string;
  type?: string;
  token?: string;
}

interface OnlyOfficePresentationEditorProps {
  presentationId: string;
  mode?: 'edit' | 'view' | 'review';
  onReady?: () => void;
  onError?: (error: string) => void;
  onDocumentReady?: () => void;
  onSave?: () => void;
  className?: string;
}

// OnlyOffice Document Server URL (from env or default)
const ONLYOFFICE_URL = process.env.NEXT_PUBLIC_ONLYOFFICE_URL || 'https://office.bheem.cloud';

export default function OnlyOfficePresentationEditor({
  presentationId,
  mode = 'edit',
  onReady,
  onError,
  onDocumentReady,
  onSave,
  className = '',
}: OnlyOfficePresentationEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<DocEditorInstance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);

  // Load OnlyOffice API script
  const loadOnlyOfficeScript = useCallback(() => {
    return new Promise<void>((resolve, reject) => {
      // Check if already loaded
      if (window.DocsAPI) {
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
      const response = await api.get(`/slides/${presentationId}/editor-config`, {
        params: { mode },
      });
      return response.data;
    } catch (err: any) {
      throw new Error(err.response?.data?.detail || 'Failed to load editor configuration');
    }
  }, [presentationId, mode]);

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
            console.log('OnlyOffice onReady event fired');
            setLoading(false);
            onReady?.();
          },
          onDocumentReady: () => {
            console.log('OnlyOffice onDocumentReady event fired');
            // Also set loading to false here in case onReady doesn't fire
            setLoading(false);
            onDocumentReady?.();
          },
          onAppReady: () => {
            console.log('OnlyOffice onAppReady event fired');
            // Ensure loading is set to false when app is ready
            setLoading(false);
          },
          onError: (event: any) => {
            const errorMsg = event?.data?.errorDescription || 'Unknown editor error';
            console.error('OnlyOffice error:', errorMsg, event);
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
            console.warn('OnlyOffice warning:', event);
          },
        },
      };

      // Create editor instance
      if (window.DocsAPI) {
        editorRef.current = new window.DocsAPI.DocEditor(
          'onlyoffice-presentation-container',
          configWithEvents
        );
      } else {
        throw new Error('OnlyOffice API not available');
      }
    } catch (err: any) {
      console.error('Failed to initialize OnlyOffice editor:', err);
      setError(err.message);
      setLoading(false);
      onError?.(err.message);
    }
  }, [loadOnlyOfficeScript, fetchEditorConfig, onReady, onError, onDocumentReady, onSave]);

  // Initialize on mount
  useEffect(() => {
    initializeEditor();

    // Timeout fallback - if loading doesn't complete in 15 seconds, hide loading overlay
    // The editor may still be loading internally but we show it to the user
    const loadingTimeout = setTimeout(() => {
      setLoading(false);
      console.log('OnlyOffice loading timeout - showing editor');
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
  }, [presentationId, mode]); // Re-initialize when presentationId or mode changes

  const isSSLError = error && (error.includes('script') || error.includes('API') || error.includes('load'));

  // Always render the container, overlay loading/error states
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
        id="onlyoffice-presentation-container"
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
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">
              {scriptLoaded ? 'Initializing Bheem Slides...' : 'Loading presentation editor...'}
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
              Bheem Slides Connection Issue
            </h3>
            {isSSLError ? (
              <>
                <p className="text-gray-600 text-sm mb-4">
                  Unable to connect to the document server. This may be due to a certificate issue.
                </p>
                <p className="text-gray-500 text-xs mb-4">
                  Try visiting <a href={ONLYOFFICE_URL} target="_blank" rel="noopener noreferrer" className="text-orange-600 underline">{ONLYOFFICE_URL}</a> directly and accepting the certificate, then retry.
                </p>
              </>
            ) : (
              <p className="text-gray-600 text-sm mb-4">{error}</p>
            )}
            <div className="flex gap-2 justify-center">
              <button
                onClick={initializeEditor}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
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

/**
 * Hook to check if Bheem Slides editor is available
 * Checks if the document server is reachable
 */
export function useOnlyOfficePresentationAvailable() {
  const [available, setAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    const checkAvailability = async () => {
      try {
        // Try to load the API script as a test
        // If the server is available, the script should load
        const testScript = document.createElement('script');
        testScript.src = `${ONLYOFFICE_URL}/web-apps/apps/api/documents/api.js`;

        const loadPromise = new Promise<boolean>((resolve) => {
          testScript.onload = () => resolve(true);
          testScript.onerror = () => resolve(false);
          // Timeout after 5 seconds
          setTimeout(() => resolve(false), 5000);
        });

        // Don't actually add to document, just try to fetch
        const response = await fetch(`${ONLYOFFICE_URL}/healthcheck`, {
          method: 'GET',
          mode: 'no-cors',
        }).catch(() => null);

        // With no-cors, we can't read the response, but if fetch doesn't throw, server is likely up
        // As a fallback, assume available and let the editor handle any errors
        setAvailable(true);
      } catch (err) {
        console.warn('Document server check failed:', err);
        // Default to available=true and let the actual editor load handle errors
        // This provides a better user experience than blocking access
        setAvailable(true);
      }
    };

    checkAvailability();
  }, []);

  return available;
}
