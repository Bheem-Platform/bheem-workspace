/**
 * Bheem Slides - Presentation Mode
 * Full-screen presentation view
 */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { api } from '@/lib/api';
import { useRequireAuth } from '@/stores/authStore';

const ONLYOFFICE_URL = process.env.NEXT_PUBLIC_ONLYOFFICE_URL || 'https://office.bheem.cloud';

export default function PresentationMode() {
  const router = useRouter();
  const { id } = router.query;
  const { isAuthenticated, isLoading: authLoading } = useRequireAuth();
  const [config, setConfig] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated || authLoading || !id) return;

    const loadConfig = async () => {
      try {
        const response = await api.get(`/slides/${id}/editor-config`, {
          params: { mode: 'view' },
        });
        setConfig(response.data.config);
      } catch (err: any) {
        setError(err.response?.data?.detail || 'Failed to load presentation');
      }
    };

    loadConfig();
  }, [id, isAuthenticated, authLoading]);

  useEffect(() => {
    if (!config) return;

    // Load OnlyOffice script
    const loadScript = () => {
      return new Promise<void>((resolve, reject) => {
        if ((window as any).DocsAPI) {
          resolve();
          return;
        }

        const script = document.createElement('script');
        script.src = `${ONLYOFFICE_URL}/web-apps/apps/api/documents/api.js`;
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Failed to load OnlyOffice'));
        document.head.appendChild(script);
      });
    };

    const initEditor = async () => {
      try {
        await loadScript();

        // Configure for presentation mode
        const presentConfig = {
          ...config,
          type: 'embedded',
          editorConfig: {
            ...config.editorConfig,
            mode: 'view',
            customization: {
              ...config.editorConfig?.customization,
              compactHeader: true,
              toolbarNoTabs: true,
              header: false,
              toolbar: false,
              statusBar: false,
              leftMenu: false,
              rightMenu: false,
            },
          },
          events: {
            onAppReady: () => {
              // Try to start slideshow automatically
              setTimeout(() => {
                const iframe = document.querySelector('#presentation-container iframe') as HTMLIFrameElement;
                if (iframe?.contentWindow) {
                  // Simulate F5 key press to start presentation
                  const event = new KeyboardEvent('keydown', {
                    key: 'F5',
                    code: 'F5',
                    keyCode: 116,
                    which: 116,
                    bubbles: true,
                  });
                  iframe.contentWindow.document.dispatchEvent(event);
                }
              }, 1000);
            },
          },
        };

        if ((window as any).DocsAPI) {
          new (window as any).DocsAPI.DocEditor('presentation-container', presentConfig);
        }
      } catch (err: any) {
        setError(err.message);
      }
    };

    initEditor();

    // Handle escape key to exit
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        router.back();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [config, router]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto"></div>
          <p className="mt-4">Loading presentation...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={() => router.back()}
            className="px-4 py-2 bg-white text-black rounded-lg"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Presentation Mode - Bheem Slides</title>
      </Head>

      <div className="fixed inset-0 bg-black">
        {/* Exit button */}
        <button
          onClick={() => router.back()}
          className="absolute top-4 right-4 z-50 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg backdrop-blur-sm transition-colors"
        >
          Exit (Esc)
        </button>

        {/* Presentation container */}
        <div
          id="presentation-container"
          className="w-full h-full"
        />
      </div>
    </>
  );
}
