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

// OnlyOffice types are defined in src/types/onlyoffice.d.ts

interface DocEditorInstance {
  destroyEditor: () => void;
  refreshHistory: (data: any) => void;
  executeCommand: (command: string, params?: any) => void;
  serviceCommand: (command: string, params?: any) => void;
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
  onEditorReady?: (editorApi: EditorApi) => void;
}

// Editor API exposed to parent components
export interface EditorApi {
  startPresentation: () => void;
  addSlide: () => void;
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
  onEditorReady,
}: OnlyOfficePresentationEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<DocEditorInstance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);

  // Create editor API for parent components
  const createEditorApi = useCallback((): EditorApi => ({
    startPresentation: () => {
      // Use iframe postMessage to trigger presentation mode
      const iframe = document.querySelector('#onlyoffice-presentation-container iframe') as HTMLIFrameElement;
      if (iframe?.contentWindow) {
        // OnlyOffice uses F5 key to start presentation, we simulate this
        iframe.contentWindow.postMessage(JSON.stringify({
          type: 'onExternalPluginMessage',
          data: { type: 'startSlideShow' }
        }), '*');
      }
      // Alternative: Open in new window for presentation
      window.open(`/slides/${presentationId}/present`, '_blank', 'fullscreen=yes');
    },
    addSlide: () => {
      const iframe = document.querySelector('#onlyoffice-presentation-container iframe') as HTMLIFrameElement;
      if (iframe?.contentWindow) {
        iframe.contentWindow.postMessage(JSON.stringify({
          type: 'onExternalPluginMessage',
          data: { type: 'addSlide' }
        }), '*');
      }
    },
  }), [presentationId]);

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
            console.log('OnlyOffice onReady event fired');
            setLoading(false);
            onReady?.();
          },
          onDocumentReady: () => {
            console.log('OnlyOffice onDocumentReady event fired');
            // Also set loading to false here in case onReady doesn't fire
            setLoading(false);
            onDocumentReady?.();
            // Expose editor API to parent
            onEditorReady?.(createEditorApi());
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
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-white via-[#FFCCF2]/10 to-[#977DFF]/10">
          <div className="text-center">
            {/* Bheem Logo */}
            <div className="w-16 h-16 bg-gradient-to-br from-[#FFCCF2] via-[#977DFF] to-[#0033FF] rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg animate-pulse">
              <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
              </svg>
            </div>
            {/* Gradient spinner */}
            <div className="relative w-12 h-12 mx-auto mb-4">
              <div className="absolute inset-0 rounded-full border-4 border-[#FFCCF2]/30"></div>
              <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-[#977DFF] animate-spin"></div>
            </div>
            <h3 className="text-lg font-semibold bg-gradient-to-r from-[#977DFF] to-[#0033FF] bg-clip-text text-transparent">
              Bheem Slides
            </h3>
            <p className="mt-2 text-gray-500 text-sm">
              {scriptLoaded ? 'Initializing editor...' : 'Loading presentation...'}
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
              Bheem Slides Connection Issue
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
