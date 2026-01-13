/**
 * Virtual Background Selector Component
 * Allows users to select blur or custom backgrounds for video calls
 */
import { useState, useEffect, useCallback } from 'react';
import {
  Image,
  X,
  Check,
  Upload,
  Loader2,
  Sparkles,
  CircleDot,
} from 'lucide-react';

interface VirtualBackgroundSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectBackground: (background: BackgroundOption | null) => void;
  currentBackground: BackgroundOption | null;
}

export interface BackgroundOption {
  type: 'none' | 'blur' | 'image';
  value?: string; // URL for image backgrounds
  name?: string;
  blurAmount?: number; // 0-20, default 10
}

// Preset backgrounds
const PRESET_BACKGROUNDS: BackgroundOption[] = [
  { type: 'none', name: 'No Effect' },
  { type: 'blur', name: 'Slight Blur', blurAmount: 5 },
  { type: 'blur', name: 'Standard Blur', blurAmount: 10 },
  { type: 'blur', name: 'Strong Blur', blurAmount: 15 },
  { type: 'image', name: 'Office', value: '/backgrounds/office.jpg' },
  { type: 'image', name: 'Living Room', value: '/backgrounds/living-room.jpg' },
  { type: 'image', name: 'Nature', value: '/backgrounds/nature.jpg' },
  { type: 'image', name: 'Abstract', value: '/backgrounds/abstract.jpg' },
  { type: 'image', name: 'City', value: '/backgrounds/city.jpg' },
  { type: 'image', name: 'Beach', value: '/backgrounds/beach.jpg' },
];

export default function VirtualBackgroundSelector({
  isOpen,
  onClose,
  onSelectBackground,
  currentBackground,
}: VirtualBackgroundSelectorProps) {
  const [selectedBackground, setSelectedBackground] = useState<BackgroundOption | null>(
    currentBackground
  );
  const [customBackgrounds, setCustomBackgrounds] = useState<BackgroundOption[]>([]);
  const [uploading, setUploading] = useState(false);
  const [applying, setApplying] = useState(false);

  // Load custom backgrounds from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('bheem-custom-backgrounds');
    if (saved) {
      try {
        setCustomBackgrounds(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load custom backgrounds:', e);
      }
    }
  }, []);

  const handleSelect = (bg: BackgroundOption) => {
    setSelectedBackground(bg);
  };

  const handleApply = async () => {
    setApplying(true);
    try {
      onSelectBackground(selectedBackground);
      onClose();
    } finally {
      setApplying(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Image must be less than 5MB');
      return;
    }

    setUploading(true);
    try {
      // Convert to base64 for storage
      const reader = new FileReader();
      reader.onload = () => {
        const newBg: BackgroundOption = {
          type: 'image',
          name: file.name.replace(/\.[^/.]+$/, ''),
          value: reader.result as string,
        };

        const updated = [...customBackgrounds, newBg];
        setCustomBackgrounds(updated);
        localStorage.setItem('bheem-custom-backgrounds', JSON.stringify(updated));
        setSelectedBackground(newBg);
      };
      reader.readAsDataURL(file);
    } finally {
      setUploading(false);
    }
  };

  const removeCustomBackground = (index: number) => {
    const updated = customBackgrounds.filter((_, i) => i !== index);
    setCustomBackgrounds(updated);
    localStorage.setItem('bheem-custom-backgrounds', JSON.stringify(updated));
  };

  const isSelected = (bg: BackgroundOption) => {
    if (!selectedBackground) return bg.type === 'none';
    if (bg.type !== selectedBackground.type) return false;
    if (bg.type === 'blur') return bg.blurAmount === selectedBackground.blurAmount;
    if (bg.type === 'image') return bg.value === selectedBackground.value;
    return true;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles size={20} className="text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">Virtual Background</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Blur Options */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Background Blur</h3>
            <div className="grid grid-cols-4 gap-3">
              {PRESET_BACKGROUNDS.filter(bg => bg.type === 'none' || bg.type === 'blur').map(
                (bg, index) => (
                  <button
                    key={index}
                    onClick={() => handleSelect(bg)}
                    className={`relative aspect-video rounded-lg border-2 transition-all flex items-center justify-center ${
                      isSelected(bg)
                        ? 'border-blue-500 ring-2 ring-blue-200'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {bg.type === 'none' ? (
                      <div className="text-center">
                        <X size={24} className="mx-auto text-gray-400" />
                        <span className="text-xs text-gray-500 mt-1 block">None</span>
                      </div>
                    ) : (
                      <div className="text-center">
                        <CircleDot size={24} className="mx-auto text-blue-500" />
                        <span className="text-xs text-gray-600 mt-1 block">{bg.name}</span>
                      </div>
                    )}
                    {isSelected(bg) && (
                      <div className="absolute top-1 right-1 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                        <Check size={12} className="text-white" />
                      </div>
                    )}
                  </button>
                )
              )}
            </div>
          </div>

          {/* Image Backgrounds */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Background Images</h3>
            <div className="grid grid-cols-4 gap-3">
              {PRESET_BACKGROUNDS.filter(bg => bg.type === 'image').map((bg, index) => (
                <button
                  key={index}
                  onClick={() => handleSelect(bg)}
                  className={`relative aspect-video rounded-lg border-2 overflow-hidden transition-all ${
                    isSelected(bg)
                      ? 'border-blue-500 ring-2 ring-blue-200'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <img
                    src={bg.value}
                    alt={bg.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%23ddd" width="100" height="100"/%3E%3C/svg%3E';
                    }}
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                    <span className="text-xs text-white font-medium">{bg.name}</span>
                  </div>
                  {isSelected(bg) && (
                    <div className="absolute top-1 right-1 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                      <Check size={12} className="text-white" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Backgrounds */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">Custom Backgrounds</h3>
            <div className="grid grid-cols-4 gap-3">
              {/* Upload Button */}
              <label
                className={`relative aspect-video rounded-lg border-2 border-dashed border-gray-300 hover:border-blue-400 hover:bg-blue-50 cursor-pointer transition-all flex flex-col items-center justify-center ${
                  uploading ? 'opacity-50 cursor-wait' : ''
                }`}
              >
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleUpload}
                  disabled={uploading}
                  className="hidden"
                />
                {uploading ? (
                  <Loader2 size={24} className="animate-spin text-blue-500" />
                ) : (
                  <>
                    <Upload size={24} className="text-gray-400 mb-1" />
                    <span className="text-xs text-gray-500">Upload</span>
                  </>
                )}
              </label>

              {/* Custom Background Items */}
              {customBackgrounds.map((bg, index) => (
                <div
                  key={index}
                  className="relative group"
                >
                  <button
                    onClick={() => handleSelect(bg)}
                    className={`aspect-video w-full rounded-lg border-2 overflow-hidden transition-all ${
                      isSelected(bg)
                        ? 'border-blue-500 ring-2 ring-blue-200'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <img
                      src={bg.value}
                      alt={bg.name}
                      className="w-full h-full object-cover"
                    />
                    {isSelected(bg) && (
                      <div className="absolute top-1 right-1 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                        <Check size={12} className="text-white" />
                      </div>
                    )}
                  </button>
                  <button
                    onClick={() => removeCustomBackground(index)}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Info */}
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-700">
              <strong>Tip:</strong> For best results, use a well-lit environment with good contrast
              between you and your background. Virtual backgrounds work best with a solid color
              background behind you.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            disabled={applying}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {applying ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Applying...
              </>
            ) : (
              'Apply'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Hook to apply virtual background to a video track
 * Uses the LiveKit track processor API
 */
export function useVirtualBackground() {
  const [isSupported, setIsSupported] = useState(false);
  const [currentBackground, setCurrentBackground] = useState<BackgroundOption | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    // Check if browser supports the required APIs
    const supported = typeof OffscreenCanvas !== 'undefined' &&
      typeof createImageBitmap !== 'undefined';
    setIsSupported(supported);

    // Load saved preference
    const saved = localStorage.getItem('bheem-virtual-bg-preference');
    if (saved) {
      try {
        setCurrentBackground(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load background preference:', e);
      }
    }
  }, []);

  const applyBackground = useCallback(async (
    videoTrack: any, // LocalVideoTrack from LiveKit
    background: BackgroundOption | null
  ) => {
    if (!isSupported) {
      console.warn('Virtual backgrounds not supported in this browser');
      return;
    }

    setIsProcessing(true);

    try {
      // Save preference
      if (background) {
        localStorage.setItem('bheem-virtual-bg-preference', JSON.stringify(background));
      } else {
        localStorage.removeItem('bheem-virtual-bg-preference');
      }

      setCurrentBackground(background);

      // Note: Actual implementation would use @livekit/track-processors
      // This is a placeholder for the integration
      if (!background || background.type === 'none') {
        // Remove processor
        if (videoTrack?.processor) {
          await videoTrack.stopProcessor();
        }
      } else if (background.type === 'blur') {
        // Apply blur
        // const blurProcessor = BackgroundBlur(background.blurAmount || 10);
        // await videoTrack.setProcessor(blurProcessor);
        console.log('Applying blur:', background.blurAmount);
      } else if (background.type === 'image' && background.value) {
        // Apply virtual background image
        // const bgProcessor = VirtualBackground(background.value);
        // await videoTrack.setProcessor(bgProcessor);
        console.log('Applying background image:', background.value);
      }
    } catch (error) {
      console.error('Failed to apply virtual background:', error);
      throw error;
    } finally {
      setIsProcessing(false);
    }
  }, [isSupported]);

  return {
    isSupported,
    currentBackground,
    isProcessing,
    applyBackground,
  };
}
