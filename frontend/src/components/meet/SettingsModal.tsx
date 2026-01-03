'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Settings,
  Mic,
  Video,
  Volume2,
  Monitor,
  Keyboard,
  Info,
  ChevronRight,
  Check,
  Play,
  Square,
} from 'lucide-react';
import { MeetButton } from './ui';

type SettingsTab = 'audio' | 'video' | 'general' | 'shortcuts';

interface AudioDevice {
  deviceId: string;
  label: string;
  kind: 'audioinput' | 'audiooutput';
}

interface VideoDevice {
  deviceId: string;
  label: string;
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave?: (settings: MeetSettings) => void;
}

interface MeetSettings {
  audioInput: string;
  audioOutput: string;
  videoInput: string;
  noiseCancellation: boolean;
  mirrorVideo: boolean;
  hdVideo: boolean;
  autoGainControl: boolean;
}

const SHORTCUTS = [
  { key: 'M', action: 'Toggle microphone' },
  { key: 'V', action: 'Toggle camera' },
  { key: 'C', action: 'Toggle chat panel' },
  { key: 'P', action: 'Toggle participants panel' },
  { key: 'F', action: 'Toggle fullscreen' },
  { key: 'S', action: 'Toggle screen sharing' },
  { key: 'H', action: 'Raise/lower hand' },
  { key: 'Esc', action: 'Exit fullscreen / Close panel' },
];

export default function SettingsModal({
  isOpen,
  onClose,
  onSave,
}: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('audio');
  const [audioInputs, setAudioInputs] = useState<AudioDevice[]>([]);
  const [audioOutputs, setAudioOutputs] = useState<AudioDevice[]>([]);
  const [videoInputs, setVideoInputs] = useState<VideoDevice[]>([]);
  const [isTestingMic, setIsTestingMic] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [settings, setSettings] = useState<MeetSettings>({
    audioInput: 'default',
    audioOutput: 'default',
    videoInput: 'default',
    noiseCancellation: true,
    mirrorVideo: true,
    hdVideo: true,
    autoGainControl: true,
  });

  // Enumerate devices
  useEffect(() => {
    const getDevices = async () => {
      try {
        // Request permissions first
        await navigator.mediaDevices.getUserMedia({ audio: true, video: true });

        const devices = await navigator.mediaDevices.enumerateDevices();

        const audioIn = devices
          .filter(d => d.kind === 'audioinput')
          .map(d => ({ deviceId: d.deviceId, label: d.label || 'Microphone', kind: 'audioinput' as const }));

        const audioOut = devices
          .filter(d => d.kind === 'audiooutput')
          .map(d => ({ deviceId: d.deviceId, label: d.label || 'Speaker', kind: 'audiooutput' as const }));

        const videoIn = devices
          .filter(d => d.kind === 'videoinput')
          .map(d => ({ deviceId: d.deviceId, label: d.label || 'Camera' }));

        setAudioInputs(audioIn);
        setAudioOutputs(audioOut);
        setVideoInputs(videoIn);
      } catch (err) {
        console.error('Failed to enumerate devices:', err);
      }
    };

    if (isOpen) {
      getDevices();
    }

    return () => {
      stopMicTest();
    };
  }, [isOpen]);

  const startMicTest = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: settings.audioInput },
      });

      streamRef.current = stream;
      audioContextRef.current = new AudioContext();
      analyserRef.current = audioContextRef.current.createAnalyser();

      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);

      analyserRef.current.fftSize = 256;
      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);

      setIsTestingMic(true);

      const updateLevel = () => {
        if (!analyserRef.current || !isTestingMic) return;

        analyserRef.current.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        setAudioLevel(Math.min(100, average * 2));

        requestAnimationFrame(updateLevel);
      };

      updateLevel();
    } catch (err) {
      console.error('Failed to start mic test:', err);
    }
  };

  const stopMicTest = () => {
    setIsTestingMic(false);
    setAudioLevel(0);

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  };

  const handleSave = () => {
    onSave?.(settings);
    onClose();
  };

  const tabs = [
    { key: 'audio' as SettingsTab, label: 'Audio', icon: Mic },
    { key: 'video' as SettingsTab, label: 'Video', icon: Video },
    { key: 'general' as SettingsTab, label: 'General', icon: Settings },
    { key: 'shortcuts' as SettingsTab, label: 'Shortcuts', icon: Keyboard },
  ];

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
                <div className="w-10 h-10 rounded-xl bg-gray-700 flex items-center justify-center">
                  <Settings size={20} className="text-gray-300" />
                </div>
                <h2 className="text-lg font-semibold text-white">Settings</h2>
              </div>
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex min-h-[400px]">
              {/* Sidebar */}
              <div className="w-48 border-r border-gray-700 p-3">
                {tabs.map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    onClick={() => setActiveTab(key)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                      activeTab === key
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                    }`}
                  >
                    <Icon size={18} />
                    {label}
                  </button>
                ))}
              </div>

              {/* Content */}
              <div className="flex-1 p-6 overflow-y-auto">
                <AnimatePresence mode="wait">
                  {activeTab === 'audio' && (
                    <motion.div
                      key="audio"
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      className="space-y-6"
                    >
                      {/* Microphone */}
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Microphone
                        </label>
                        <select
                          value={settings.audioInput}
                          onChange={(e) => setSettings(s => ({ ...s, audioInput: e.target.value }))}
                          className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                        >
                          {audioInputs.map(device => (
                            <option key={device.deviceId} value={device.deviceId}>
                              {device.label}
                            </option>
                          ))}
                        </select>

                        {/* Mic test */}
                        <div className="mt-3 flex items-center gap-3">
                          <button
                            onClick={isTestingMic ? stopMicTest : startMicTest}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                              isTestingMic
                                ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                            }`}
                          >
                            {isTestingMic ? <Square size={14} /> : <Play size={14} />}
                            {isTestingMic ? 'Stop test' : 'Test microphone'}
                          </button>

                          {isTestingMic && (
                            <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
                              <motion.div
                                className="h-full bg-emerald-500"
                                animate={{ width: `${audioLevel}%` }}
                                transition={{ duration: 0.1 }}
                              />
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Speaker */}
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Speaker
                        </label>
                        <select
                          value={settings.audioOutput}
                          onChange={(e) => setSettings(s => ({ ...s, audioOutput: e.target.value }))}
                          className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                        >
                          {audioOutputs.map(device => (
                            <option key={device.deviceId} value={device.deviceId}>
                              {device.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Audio options */}
                      <div className="space-y-3">
                        <SettingToggle
                          label="Noise cancellation"
                          description="Reduce background noise"
                          checked={settings.noiseCancellation}
                          onChange={(v) => setSettings(s => ({ ...s, noiseCancellation: v }))}
                        />
                        <SettingToggle
                          label="Auto gain control"
                          description="Automatically adjust microphone volume"
                          checked={settings.autoGainControl}
                          onChange={(v) => setSettings(s => ({ ...s, autoGainControl: v }))}
                        />
                      </div>
                    </motion.div>
                  )}

                  {activeTab === 'video' && (
                    <motion.div
                      key="video"
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      className="space-y-6"
                    >
                      {/* Camera */}
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Camera
                        </label>
                        <select
                          value={settings.videoInput}
                          onChange={(e) => setSettings(s => ({ ...s, videoInput: e.target.value }))}
                          className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                        >
                          {videoInputs.map(device => (
                            <option key={device.deviceId} value={device.deviceId}>
                              {device.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Video options */}
                      <div className="space-y-3">
                        <SettingToggle
                          label="Mirror video"
                          description="Flip your video horizontally"
                          checked={settings.mirrorVideo}
                          onChange={(v) => setSettings(s => ({ ...s, mirrorVideo: v }))}
                        />
                        <SettingToggle
                          label="HD video"
                          description="Send video in high definition (uses more bandwidth)"
                          checked={settings.hdVideo}
                          onChange={(v) => setSettings(s => ({ ...s, hdVideo: v }))}
                        />
                      </div>
                    </motion.div>
                  )}

                  {activeTab === 'general' && (
                    <motion.div
                      key="general"
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      className="space-y-4"
                    >
                      <div className="p-4 bg-gray-700/50 rounded-xl">
                        <div className="flex items-center gap-3 mb-2">
                          <Info size={18} className="text-gray-400" />
                          <h3 className="font-medium text-white">About Bheem Meet</h3>
                        </div>
                        <p className="text-sm text-gray-400">
                          Version 1.0.0
                        </p>
                        <p className="text-sm text-gray-500 mt-1">
                          A modern video conferencing solution for teams.
                        </p>
                      </div>
                    </motion.div>
                  )}

                  {activeTab === 'shortcuts' && (
                    <motion.div
                      key="shortcuts"
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      className="space-y-2"
                    >
                      {SHORTCUTS.map(({ key, action }) => (
                        <div
                          key={key}
                          className="flex items-center justify-between py-3 border-b border-gray-700/50 last:border-0"
                        >
                          <span className="text-sm text-gray-300">{action}</span>
                          <kbd className="px-3 py-1.5 bg-gray-700 border border-gray-600 rounded-lg text-xs font-mono text-gray-300">
                            {key}
                          </kbd>
                        </div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-700">
              <MeetButton variant="ghost" onClick={onClose}>
                Cancel
              </MeetButton>
              <MeetButton variant="primary" onClick={handleSave}>
                Save changes
              </MeetButton>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

interface SettingToggleProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}

function SettingToggle({ label, description, checked, onChange }: SettingToggleProps) {
  return (
    <div
      className="flex items-center justify-between p-3 bg-gray-700/30 rounded-xl cursor-pointer hover:bg-gray-700/50 transition-colors"
      onClick={() => onChange(!checked)}
    >
      <div>
        <p className="text-sm font-medium text-white">{label}</p>
        {description && (
          <p className="text-xs text-gray-400 mt-0.5">{description}</p>
        )}
      </div>
      <div
        className={`relative w-10 h-6 rounded-full transition-colors ${
          checked ? 'bg-emerald-500' : 'bg-gray-600'
        }`}
      >
        <motion.div
          animate={{ x: checked ? 16 : 2 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          className="absolute top-1 w-4 h-4 bg-white rounded-full shadow"
        />
      </div>
    </div>
  );
}
