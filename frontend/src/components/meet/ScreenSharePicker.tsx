'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Monitor, AppWindow, Chrome, Volume2, Check, AlertCircle } from 'lucide-react';
import { MeetButton } from './ui';

type ShareType = 'screen' | 'window' | 'tab';

interface ShareOption {
  id: string;
  type: ShareType;
  name: string;
  thumbnail?: string;
}

interface ScreenSharePickerProps {
  isOpen: boolean;
  onClose: () => void;
  onShare: (sourceId: string, withAudio: boolean) => void;
}

export default function ScreenSharePicker({
  isOpen,
  onClose,
  onShare,
}: ScreenSharePickerProps) {
  const [selectedType, setSelectedType] = useState<ShareType>('screen');
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [shareAudio, setShareAudio] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mock sources - in real app, these would come from getDisplayMedia
  const [sources] = useState<ShareOption[]>([
    { id: 'screen-1', type: 'screen', name: 'Entire Screen' },
    { id: 'screen-2', type: 'screen', name: 'Display 2' },
    { id: 'window-1', type: 'window', name: 'Visual Studio Code' },
    { id: 'window-2', type: 'window', name: 'Chrome - Bheem Meet' },
    { id: 'window-3', type: 'window', name: 'Figma - Design System' },
    { id: 'tab-1', type: 'tab', name: 'Google Docs - Meeting Notes' },
    { id: 'tab-2', type: 'tab', name: 'YouTube - Tutorial Video' },
  ]);

  const filteredSources = sources.filter(s => s.type === selectedType);

  useEffect(() => {
    if (isOpen) {
      setSelectedSource(null);
      setError(null);
    }
  }, [isOpen]);

  const handleShare = async () => {
    if (!selectedSource) return;

    setIsLoading(true);
    setError(null);

    try {
      // In real implementation, this would call getDisplayMedia
      // For now, we simulate a brief loading state
      await new Promise(resolve => setTimeout(resolve, 500));
      onShare(selectedSource, shareAudio);
      onClose();
    } catch (err) {
      setError('Failed to start screen sharing. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const getIcon = (type: ShareType) => {
    switch (type) {
      case 'screen':
        return Monitor;
      case 'window':
        return AppWindow;
      case 'tab':
        return Chrome;
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-full max-w-2xl mx-4 bg-gray-800 rounded-2xl shadow-2xl border border-gray-700 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-700">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                  <Monitor size={20} className="text-emerald-400" />
                </div>
                <h2 className="text-lg font-semibold text-white">Share your screen</h2>
              </div>
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-700">
              {[
                { key: 'screen' as ShareType, label: 'Entire Screen', icon: Monitor },
                { key: 'window' as ShareType, label: 'Window', icon: AppWindow },
                { key: 'tab' as ShareType, label: 'Browser Tab', icon: Chrome },
              ].map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => {
                    setSelectedType(key);
                    setSelectedSource(null);
                  }}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors relative ${
                    selectedType === key
                      ? 'text-emerald-400'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <Icon size={18} />
                  {label}
                  {selectedType === key && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500"
                    />
                  )}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="p-6">
              {/* Error message */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 p-3 mb-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm"
                >
                  <AlertCircle size={16} />
                  {error}
                </motion.div>
              )}

              {/* Source grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 max-h-64 overflow-y-auto scrollbar-thin">
                {filteredSources.map((source) => {
                  const Icon = getIcon(source.type);
                  const isSelected = selectedSource === source.id;

                  return (
                    <motion.button
                      key={source.id}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setSelectedSource(source.id)}
                      className={`relative aspect-video rounded-xl border-2 transition-all overflow-hidden ${
                        isSelected
                          ? 'border-emerald-500 bg-emerald-500/10'
                          : 'border-gray-600 hover:border-gray-500 bg-gray-700/50'
                      }`}
                    >
                      {/* Thumbnail placeholder */}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Icon
                          size={32}
                          className={isSelected ? 'text-emerald-400' : 'text-gray-500'}
                        />
                      </div>

                      {/* Name label */}
                      <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
                        <p className="text-xs text-white truncate">{source.name}</p>
                      </div>

                      {/* Selected indicator */}
                      {isSelected && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="absolute top-2 right-2 w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center"
                        >
                          <Check size={14} className="text-white" />
                        </motion.div>
                      )}
                    </motion.button>
                  );
                })}
              </div>

              {filteredSources.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-gray-400">No {selectedType}s available to share</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between p-6 pt-0">
              {/* Audio option */}
              <label className="flex items-center gap-3 cursor-pointer group">
                <div
                  className={`relative w-10 h-6 rounded-full transition-colors ${
                    shareAudio ? 'bg-emerald-500' : 'bg-gray-600'
                  }`}
                  onClick={() => setShareAudio(!shareAudio)}
                >
                  <motion.div
                    animate={{ x: shareAudio ? 16 : 2 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    className="absolute top-1 w-4 h-4 bg-white rounded-full shadow"
                  />
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-300">
                  <Volume2 size={16} />
                  Share audio
                </div>
              </label>

              {/* Actions */}
              <div className="flex items-center gap-3">
                <MeetButton variant="ghost" onClick={onClose}>
                  Cancel
                </MeetButton>
                <MeetButton
                  variant="primary"
                  onClick={handleShare}
                  disabled={!selectedSource || isLoading}
                >
                  {isLoading ? 'Starting...' : 'Share'}
                </MeetButton>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
