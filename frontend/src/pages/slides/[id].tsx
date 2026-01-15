/**
 * Bheem Slides - Presentation Editor
 * Google Slides-like presentation editing experience
 */
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import {
  Presentation,
  Star,
  StarOff,
  Share2,
  Play,
  Plus,
  ChevronDown,
  Type,
  Image,
  Square,
  Circle,
  Minus,
  ArrowRight,
  Layout,
  Palette,
  Undo,
  Redo,
  Trash2,
  Copy,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  Maximize,
  Grid,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Bold,
  Italic,
  Underline,
  ArrowLeft,
} from 'lucide-react';
import { useRequireAuth } from '@/stores/authStore';
import { api } from '@/lib/api';

interface SlideElement {
  id: string;
  type: 'text' | 'image' | 'shape';
  x: number;
  y: number;
  width: number;
  height: number;
  content?: string;
  style?: Record<string, any>;
}

interface Slide {
  id: string;
  slide_index: number;
  layout: string;
  content: {
    elements?: SlideElement[];
    title?: string;
    subtitle?: string;
    body?: string;
  };
  speaker_notes?: string;
  background?: {
    color?: string;
    image?: string;
  };
}

interface PresentationData {
  id: string;
  title: string;
  description: string | null;
  is_starred: boolean;
  theme: {
    font_heading: string;
    font_body: string;
    color_primary: string;
    color_secondary: string;
    color_background: string;
  };
  slides: Slide[];
  created_at: string;
  updated_at: string;
}

const SLIDE_LAYOUTS = [
  { id: 'title', name: 'Title Slide', icon: Layout },
  { id: 'title_content', name: 'Title and Content', icon: Layout },
  { id: 'two_column', name: 'Two Columns', icon: Grid },
  { id: 'section', name: 'Section Header', icon: Type },
  { id: 'blank', name: 'Blank', icon: Square },
];

export default function PresentationEditor() {
  const router = useRouter();
  const { id } = router.query;
  const { isAuthenticated, isLoading: authLoading } = useRequireAuth();

  const [presentation, setPresentation] = useState<PresentationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [showLayoutMenu, setShowLayoutMenu] = useState(false);
  const [isPresentMode, setIsPresentMode] = useState(false);
  const [selectedElement, setSelectedElement] = useState<string | null>(null);

  const fetchPresentation = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const response = await api.get(`/slides/${id}`);
      setPresentation(response.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load presentation');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (isAuthenticated && !authLoading && id) {
      fetchPresentation();
    }
  }, [isAuthenticated, authLoading, id, fetchPresentation]);

  const updateTitle = async (newTitle: string) => {
    if (!presentation || newTitle === presentation.title) return;
    try {
      await api.put(`/slides/${presentation.id}`, { title: newTitle });
      setPresentation({ ...presentation, title: newTitle });
    } catch (err) {
      console.error('Failed to update title:', err);
    }
  };

  const toggleStar = async () => {
    if (!presentation) return;
    try {
      await api.post(`/slides/${presentation.id}/star`);
      setPresentation({ ...presentation, is_starred: !presentation.is_starred });
    } catch (err) {
      console.error('Failed to toggle star:', err);
    }
  };

  const addSlide = async (layout: string = 'blank') => {
    if (!presentation) return;
    try {
      setIsSaving(true);
      const response = await api.post(`/slides/${presentation.id}/slides`, {
        layout,
        after_index: activeSlideIndex
      });
      const newSlide = response.data.slide;
      const newSlides = [...presentation.slides];
      newSlides.splice(activeSlideIndex + 1, 0, newSlide);
      // Update indexes
      newSlides.forEach((s, i) => s.slide_index = i);
      setPresentation({ ...presentation, slides: newSlides });
      setActiveSlideIndex(activeSlideIndex + 1);
    } catch (err) {
      console.error('Failed to add slide:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const deleteSlide = async (slideId: string) => {
    if (!presentation || presentation.slides.length <= 1) return;
    try {
      setIsSaving(true);
      await api.delete(`/slides/${presentation.id}/slides/${slideId}`);
      const newSlides = presentation.slides.filter(s => s.id !== slideId);
      newSlides.forEach((s, i) => s.slide_index = i);
      setPresentation({ ...presentation, slides: newSlides });
      if (activeSlideIndex >= newSlides.length) {
        setActiveSlideIndex(newSlides.length - 1);
      }
    } catch (err) {
      console.error('Failed to delete slide:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const duplicateSlide = async (slideId: string) => {
    if (!presentation) return;
    try {
      setIsSaving(true);
      const response = await api.post(`/slides/${presentation.id}/slides/${slideId}/duplicate`);
      const newSlide = response.data.slide;
      const slideIndex = presentation.slides.findIndex(s => s.id === slideId);
      const newSlides = [...presentation.slides];
      newSlides.splice(slideIndex + 1, 0, newSlide);
      newSlides.forEach((s, i) => s.slide_index = i);
      setPresentation({ ...presentation, slides: newSlides });
      setActiveSlideIndex(slideIndex + 1);
    } catch (err) {
      console.error('Failed to duplicate slide:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const updateSlideContent = async (slideId: string, content: any) => {
    if (!presentation) return;
    try {
      setIsSaving(true);
      await api.put(`/slides/${presentation.id}/slides/${slideId}`, { content });
      setPresentation({
        ...presentation,
        slides: presentation.slides.map(s =>
          s.id === slideId ? { ...s, content } : s
        )
      });
    } catch (err) {
      console.error('Failed to update slide:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const startPresentation = () => {
    setIsPresentMode(true);
    setActiveSlideIndex(0);
    // Request fullscreen
    document.documentElement.requestFullscreen?.();
  };

  const exitPresentation = () => {
    setIsPresentMode(false);
    document.exitFullscreen?.();
  };

  const navigateSlide = (direction: 'prev' | 'next') => {
    if (!presentation) return;
    if (direction === 'prev' && activeSlideIndex > 0) {
      setActiveSlideIndex(activeSlideIndex - 1);
    } else if (direction === 'next' && activeSlideIndex < presentation.slides.length - 1) {
      setActiveSlideIndex(activeSlideIndex + 1);
    }
  };

  // Keyboard navigation for presentation mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isPresentMode) {
        if (e.key === 'Escape') {
          exitPresentation();
        } else if (e.key === 'ArrowRight' || e.key === ' ') {
          navigateSlide('next');
        } else if (e.key === 'ArrowLeft') {
          navigateSlide('prev');
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPresentMode, activeSlideIndex, presentation?.slides.length]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-600"></div>
      </div>
    );
  }

  if (error || !presentation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <Presentation className="mx-auto h-16 w-16 text-gray-400" />
          <h2 className="mt-4 text-xl font-medium text-white">
            {error || 'Presentation not found'}
          </h2>
          <Link href="/slides" className="mt-4 inline-flex items-center text-yellow-500 hover:text-yellow-400">
            <ArrowLeft size={20} className="mr-1" />
            Back to Slides
          </Link>
        </div>
      </div>
    );
  }

  const activeSlide = presentation.slides[activeSlideIndex];

  // Presentation Mode
  if (isPresentMode) {
    return (
      <div
        className="fixed inset-0 bg-black flex items-center justify-center"
        onClick={() => navigateSlide('next')}
      >
        <div
          className="w-full h-full max-w-[1920px] max-h-[1080px] bg-white relative"
          style={{
            aspectRatio: '16/9',
            backgroundColor: activeSlide?.background?.color || presentation.theme.color_background
          }}
        >
          {/* Slide Content */}
          <div className="absolute inset-0 p-16 flex flex-col">
            {activeSlide?.layout === 'title' && (
              <div className="flex-1 flex flex-col items-center justify-center text-center">
                <h1
                  className="text-6xl font-bold mb-4"
                  style={{ color: presentation.theme.color_primary }}
                >
                  {activeSlide.content.title || 'Title'}
                </h1>
                <p className="text-2xl text-gray-600">
                  {activeSlide.content.subtitle || ''}
                </p>
              </div>
            )}

            {activeSlide?.layout === 'title_content' && (
              <>
                <h2
                  className="text-4xl font-bold mb-8"
                  style={{ color: presentation.theme.color_primary }}
                >
                  {activeSlide.content.title || 'Title'}
                </h2>
                <div className="flex-1 text-xl text-gray-700">
                  {activeSlide.content.body || 'Content goes here...'}
                </div>
              </>
            )}

            {activeSlide?.layout === 'section' && (
              <div className="flex-1 flex items-center justify-center">
                <h2
                  className="text-5xl font-bold"
                  style={{ color: presentation.theme.color_primary }}
                >
                  {activeSlide.content.title || 'Section Title'}
                </h2>
              </div>
            )}

            {activeSlide?.layout === 'blank' && (
              <div className="flex-1">
                {/* Render elements */}
              </div>
            )}
          </div>

          {/* Navigation */}
          <div className="absolute bottom-4 right-4 flex items-center space-x-2 text-gray-400">
            <span>{activeSlideIndex + 1} / {presentation.slides.length}</span>
            <button
              onClick={(e) => { e.stopPropagation(); exitPresentation(); }}
              className="p-2 hover:bg-gray-800 rounded"
            >
              <Maximize size={20} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>{presentation.title} - Bheem Slides</title>
      </Head>

      <div className="min-h-screen bg-gray-800 flex flex-col">
        {/* Top Bar */}
        <header className="bg-gray-900 text-white flex-shrink-0">
          <div className="flex items-center px-3 py-2">
            <Link href="/slides" className="p-2 hover:bg-gray-800 rounded-full">
              <Presentation className="h-8 w-8 text-yellow-500" />
            </Link>

            <div className="ml-2 flex-1">
              <input
                type="text"
                value={presentation.title}
                onChange={(e) => setPresentation({ ...presentation, title: e.target.value })}
                onBlur={(e) => updateTitle(e.target.value)}
                className="text-lg font-medium text-white bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-yellow-500 rounded px-2 py-1"
              />
              <div className="flex items-center space-x-1 text-xs text-gray-400 ml-2">
                <button
                  onClick={toggleStar}
                  className="p-1 hover:bg-gray-800 rounded"
                >
                  {presentation.is_starred ? (
                    <Star size={14} className="text-yellow-500 fill-yellow-500" />
                  ) : (
                    <StarOff size={14} />
                  )}
                </button>
                <span>{isSaving ? 'Saving...' : 'All changes saved'}</span>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={startPresentation}
                className="flex items-center px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700"
              >
                <Play size={18} className="mr-2" />
                Present
              </button>
              <button className="flex items-center px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600">
                <Share2 size={18} className="mr-2" />
                Share
              </button>
            </div>
          </div>

          {/* Toolbar */}
          <div className="flex items-center px-3 py-1 border-t border-gray-700 space-x-1">
            <button className="p-1.5 text-gray-300 hover:bg-gray-700 rounded">
              <Undo size={18} />
            </button>
            <button className="p-1.5 text-gray-300 hover:bg-gray-700 rounded">
              <Redo size={18} />
            </button>
            <div className="w-px h-5 bg-gray-600 mx-1" />

            {/* Add Slide */}
            <div className="relative">
              <button
                onClick={() => setShowLayoutMenu(!showLayoutMenu)}
                className="flex items-center px-3 py-1.5 text-gray-300 hover:bg-gray-700 rounded"
              >
                <Plus size={18} className="mr-1" />
                <span className="text-sm">New slide</span>
                <ChevronDown size={14} className="ml-1" />
              </button>
              {showLayoutMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowLayoutMenu(false)} />
                  <div className="absolute top-full left-0 mt-1 bg-gray-800 border border-gray-600 rounded-lg shadow-lg py-1 z-50 w-48">
                    {SLIDE_LAYOUTS.map((layout) => (
                      <button
                        key={layout.id}
                        onClick={() => {
                          addSlide(layout.id);
                          setShowLayoutMenu(false);
                        }}
                        className="w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-gray-700 flex items-center space-x-2"
                      >
                        <layout.icon size={16} />
                        <span>{layout.name}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="w-px h-5 bg-gray-600 mx-1" />

            {/* Insert Elements */}
            <button className="flex items-center px-3 py-1.5 text-gray-300 hover:bg-gray-700 rounded">
              <Type size={18} className="mr-1" />
              <span className="text-sm">Text</span>
            </button>
            <button className="flex items-center px-3 py-1.5 text-gray-300 hover:bg-gray-700 rounded">
              <Image size={18} className="mr-1" />
              <span className="text-sm">Image</span>
            </button>
            <button className="flex items-center px-3 py-1.5 text-gray-300 hover:bg-gray-700 rounded">
              <Square size={18} className="mr-1" />
              <span className="text-sm">Shape</span>
            </button>

            <div className="w-px h-5 bg-gray-600 mx-1" />

            <button className="flex items-center px-3 py-1.5 text-gray-300 hover:bg-gray-700 rounded">
              <Palette size={18} className="mr-1" />
              <span className="text-sm">Theme</span>
            </button>
          </div>
        </header>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Slide Thumbnails */}
          <div className="w-48 bg-gray-900 border-r border-gray-700 overflow-y-auto flex-shrink-0">
            <div className="p-2 space-y-2">
              {presentation.slides.map((slide, index) => (
                <div
                  key={slide.id}
                  className={`relative group cursor-pointer ${
                    index === activeSlideIndex ? 'ring-2 ring-yellow-500' : ''
                  }`}
                  onClick={() => setActiveSlideIndex(index)}
                >
                  <div className="flex items-start">
                    <span className="text-xs text-gray-500 w-6 flex-shrink-0 pt-2">
                      {index + 1}
                    </span>
                    <div
                      className="flex-1 aspect-video bg-white rounded overflow-hidden"
                      style={{ backgroundColor: slide.background?.color || presentation.theme.color_background }}
                    >
                      {/* Thumbnail preview */}
                      <div className="p-2 text-[6px] overflow-hidden h-full">
                        {slide.layout === 'title' && (
                          <div className="h-full flex flex-col items-center justify-center text-center">
                            <p className="font-bold truncate" style={{ color: presentation.theme.color_primary }}>
                              {slide.content.title || 'Title'}
                            </p>
                            <p className="text-gray-400 truncate">
                              {slide.content.subtitle || ''}
                            </p>
                          </div>
                        )}
                        {slide.layout === 'title_content' && (
                          <>
                            <p className="font-bold truncate" style={{ color: presentation.theme.color_primary }}>
                              {slide.content.title || 'Title'}
                            </p>
                          </>
                        )}
                        {slide.layout === 'section' && (
                          <div className="h-full flex items-center justify-center">
                            <p className="font-bold" style={{ color: presentation.theme.color_primary }}>
                              {slide.content.title || 'Section'}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Slide actions */}
                  <div className="absolute top-1 right-1 hidden group-hover:flex space-x-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); duplicateSlide(slide.id); }}
                      className="p-1 bg-gray-800 text-gray-300 rounded hover:bg-gray-700"
                      title="Duplicate"
                    >
                      <Copy size={12} />
                    </button>
                    {presentation.slides.length > 1 && (
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteSlide(slide.id); }}
                        className="p-1 bg-gray-800 text-red-400 rounded hover:bg-gray-700"
                        title="Delete"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {/* Add slide button */}
              <button
                onClick={() => addSlide('blank')}
                className="w-full flex items-center justify-center py-3 border-2 border-dashed border-gray-600 rounded text-gray-500 hover:border-yellow-500 hover:text-yellow-500"
              >
                <Plus size={20} />
              </button>
            </div>
          </div>

          {/* Slide Editor */}
          <div className="flex-1 flex items-center justify-center p-8 overflow-auto">
            <div
              className="w-full max-w-4xl aspect-video bg-white rounded-lg shadow-2xl relative"
              style={{
                backgroundColor: activeSlide?.background?.color || presentation.theme.color_background
              }}
            >
              {/* Slide Content */}
              <div className="absolute inset-0 p-12 flex flex-col">
                {activeSlide?.layout === 'title' && (
                  <div className="flex-1 flex flex-col items-center justify-center text-center">
                    <input
                      type="text"
                      value={activeSlide.content.title || ''}
                      onChange={(e) => {
                        const newContent = { ...activeSlide.content, title: e.target.value };
                        setPresentation({
                          ...presentation,
                          slides: presentation.slides.map(s =>
                            s.id === activeSlide.id ? { ...s, content: newContent } : s
                          )
                        });
                      }}
                      onBlur={() => updateSlideContent(activeSlide.id, activeSlide.content)}
                      placeholder="Click to add title"
                      className="text-5xl font-bold text-center bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-yellow-500 rounded w-full"
                      style={{ color: presentation.theme.color_primary }}
                    />
                    <input
                      type="text"
                      value={activeSlide.content.subtitle || ''}
                      onChange={(e) => {
                        const newContent = { ...activeSlide.content, subtitle: e.target.value };
                        setPresentation({
                          ...presentation,
                          slides: presentation.slides.map(s =>
                            s.id === activeSlide.id ? { ...s, content: newContent } : s
                          )
                        });
                      }}
                      onBlur={() => updateSlideContent(activeSlide.id, activeSlide.content)}
                      placeholder="Click to add subtitle"
                      className="text-2xl text-center bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-yellow-500 rounded w-full mt-4 text-gray-600"
                    />
                  </div>
                )}

                {activeSlide?.layout === 'title_content' && (
                  <>
                    <input
                      type="text"
                      value={activeSlide.content.title || ''}
                      onChange={(e) => {
                        const newContent = { ...activeSlide.content, title: e.target.value };
                        setPresentation({
                          ...presentation,
                          slides: presentation.slides.map(s =>
                            s.id === activeSlide.id ? { ...s, content: newContent } : s
                          )
                        });
                      }}
                      onBlur={() => updateSlideContent(activeSlide.id, activeSlide.content)}
                      placeholder="Click to add title"
                      className="text-3xl font-bold bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-yellow-500 rounded w-full mb-6"
                      style={{ color: presentation.theme.color_primary }}
                    />
                    <textarea
                      value={activeSlide.content.body || ''}
                      onChange={(e) => {
                        const newContent = { ...activeSlide.content, body: e.target.value };
                        setPresentation({
                          ...presentation,
                          slides: presentation.slides.map(s =>
                            s.id === activeSlide.id ? { ...s, content: newContent } : s
                          )
                        });
                      }}
                      onBlur={() => updateSlideContent(activeSlide.id, activeSlide.content)}
                      placeholder="Click to add content"
                      className="flex-1 text-lg bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-yellow-500 rounded w-full resize-none text-gray-700"
                    />
                  </>
                )}

                {activeSlide?.layout === 'section' && (
                  <div className="flex-1 flex items-center justify-center">
                    <input
                      type="text"
                      value={activeSlide.content.title || ''}
                      onChange={(e) => {
                        const newContent = { ...activeSlide.content, title: e.target.value };
                        setPresentation({
                          ...presentation,
                          slides: presentation.slides.map(s =>
                            s.id === activeSlide.id ? { ...s, content: newContent } : s
                          )
                        });
                      }}
                      onBlur={() => updateSlideContent(activeSlide.id, activeSlide.content)}
                      placeholder="Section Title"
                      className="text-4xl font-bold text-center bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-yellow-500 rounded w-full"
                      style={{ color: presentation.theme.color_primary }}
                    />
                  </div>
                )}

                {activeSlide?.layout === 'blank' && (
                  <div className="flex-1 flex items-center justify-center text-gray-400">
                    <p>Click to add content or insert elements from the toolbar</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Speaker Notes */}
          <div className="w-64 bg-gray-900 border-l border-gray-700 flex-shrink-0">
            <div className="p-3 border-b border-gray-700">
              <h3 className="text-sm font-medium text-gray-300">Speaker Notes</h3>
            </div>
            <div className="p-3">
              <textarea
                value={activeSlide?.speaker_notes || ''}
                onChange={(e) => {
                  const newSlides = presentation.slides.map(s =>
                    s.id === activeSlide?.id ? { ...s, speaker_notes: e.target.value } : s
                  );
                  setPresentation({ ...presentation, slides: newSlides });
                }}
                onBlur={() => {
                  if (activeSlide) {
                    api.put(`/slides/${presentation.id}/slides/${activeSlide.id}`, {
                      speaker_notes: activeSlide.speaker_notes
                    });
                  }
                }}
                placeholder="Add speaker notes..."
                className="w-full h-48 bg-gray-800 text-gray-300 text-sm border border-gray-700 rounded-lg p-2 resize-none focus:outline-none focus:ring-2 focus:ring-yellow-500"
              />
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="flex-shrink-0 bg-gray-900 border-t border-gray-700 px-4 py-2 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => navigateSlide('prev')}
              disabled={activeSlideIndex === 0}
              className="p-1.5 text-gray-400 hover:bg-gray-700 rounded disabled:opacity-50"
            >
              <ChevronLeft size={20} />
            </button>
            <span className="text-sm text-gray-400">
              Slide {activeSlideIndex + 1} of {presentation.slides.length}
            </span>
            <button
              onClick={() => navigateSlide('next')}
              disabled={activeSlideIndex === presentation.slides.length - 1}
              className="p-1.5 text-gray-400 hover:bg-gray-700 rounded disabled:opacity-50"
            >
              <ChevronRight size={20} />
            </button>
          </div>

          <div className="flex items-center space-x-2">
            <select className="bg-gray-800 text-gray-300 text-sm border border-gray-700 rounded px-2 py-1">
              <option>100%</option>
              <option>75%</option>
              <option>50%</option>
              <option>Fit</option>
            </select>
          </div>
        </div>
      </div>
    </>
  );
}
