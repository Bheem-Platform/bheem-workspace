import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  Settings,
  User,
  ArrowLeft,
  AlertCircle,
  ChevronDown,
  Volume2,
  Monitor,
} from 'lucide-react';
import { useMeetStore } from '@/stores/meetStore';
import { MeetButton, MeetInput, MeetAvatar } from './ui';

interface PreJoinScreenProps {
  roomCode: string;
  roomName?: string;
  onJoin: (participantName: string) => void;
  userName?: string;
}

export default function PreJoinScreen({
  roomCode,
  roomName,
  onJoin,
  userName,
}: PreJoinScreenProps) {
  const { isMicEnabled, isCameraEnabled, toggleMic, toggleCamera, loading } = useMeetStore();

  const [name, setName] = useState(userName || '');
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);
  const [hasCamera, setHasCamera] = useState(true);
  const [hasMic, setHasMic] = useState(true);
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [microphones, setMicrophones] = useState<MediaDeviceInfo[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>('');
  const [selectedMic, setSelectedMic] = useState<string>('');

  const videoRef = useRef<HTMLVideoElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Check available devices on mount
  useEffect(() => {
    const checkDevices = async () => {
      try {
        // Request permissions first to get device labels
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
          stream.getTracks().forEach(track => track.stop());
        } catch {
          // Permission denied, continue with enumeration
        }

        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(d => d.kind === 'videoinput');
        const audioDevices = devices.filter(d => d.kind === 'audioinput');

        setCameras(videoDevices);
        setMicrophones(audioDevices);
        setHasCamera(videoDevices.length > 0);
        setHasMic(audioDevices.length > 0);

        if (videoDevices.length > 0) {
          setSelectedCamera(videoDevices[0].deviceId);
        }
        if (audioDevices.length > 0) {
          setSelectedMic(audioDevices[0].deviceId);
        }

        if (videoDevices.length === 0 && audioDevices.length === 0) {
          setDeviceError('No camera or microphone detected. You can still join the meeting.');
        } else if (videoDevices.length === 0) {
          setDeviceError('No camera detected. You can join with audio only.');
        } else if (audioDevices.length === 0) {
          setDeviceError('No microphone detected. You can join with video only.');
        }
      } catch (err) {
        console.error('Failed to enumerate devices:', err);
        setDeviceError('Unable to access media devices. You can still join the meeting.');
        setHasCamera(false);
        setHasMic(false);
      }
    };

    checkDevices();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  // Get camera preview
  useEffect(() => {
    if (isCameraEnabled && hasCamera) {
      const constraints: MediaStreamConstraints = {
        video: selectedCamera ? { deviceId: { exact: selectedCamera } } : true,
        audio: false,
      };

      navigator.mediaDevices
        .getUserMedia(constraints)
        .then((stream) => {
          setVideoStream(stream);
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        })
        .catch((err) => {
          console.error('Failed to get camera:', err);
          setHasCamera(false);
          setDeviceError('Camera access denied or not available.');
        });
    } else {
      if (videoStream) {
        videoStream.getTracks().forEach((track) => track.stop());
        setVideoStream(null);
      }
    }

    return () => {
      if (videoStream) {
        videoStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [isCameraEnabled, hasCamera, selectedCamera]);

  // Audio level meter
  useEffect(() => {
    if (isMicEnabled && hasMic) {
      const constraints: MediaStreamConstraints = {
        audio: selectedMic ? { deviceId: { exact: selectedMic } } : true,
        video: false,
      };

      navigator.mediaDevices
        .getUserMedia(constraints)
        .then((stream) => {
          audioContextRef.current = new AudioContext();
          const source = audioContextRef.current.createMediaStreamSource(stream);
          analyserRef.current = audioContextRef.current.createAnalyser();
          analyserRef.current.fftSize = 256;
          source.connect(analyserRef.current);

          const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);

          const updateLevel = () => {
            if (analyserRef.current) {
              analyserRef.current.getByteFrequencyData(dataArray);
              const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
              setAudioLevel(average / 128); // Normalize to 0-1
            }
            animationFrameRef.current = requestAnimationFrame(updateLevel);
          };

          updateLevel();
        })
        .catch((err) => {
          console.error('Failed to get microphone:', err);
        });
    } else {
      setAudioLevel(0);
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    }
  }, [isMicEnabled, hasMic, selectedMic]);

  const handleJoin = () => {
    if (!name.trim()) return;
    onJoin(name.trim());
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-5xl">
        {/* Back button */}
        <Link
          href="/meet"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-8 transition-colors group"
        >
          <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
          <span>Back to meetings</span>
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid md:grid-cols-2 gap-8 items-center"
        >
          {/* Video Preview */}
          <div className="relative">
            <div className="relative bg-gray-800 rounded-3xl overflow-hidden aspect-video shadow-2xl">
              {isCameraEnabled && videoStream && hasCamera ? (
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover scale-x-[-1]"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center flex-col gap-4 bg-gradient-to-br from-gray-800 to-gray-900">
                  <div className="w-28 h-28 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                    {!hasCamera ? (
                      <VideoOff size={48} className="text-white/80" />
                    ) : name ? (
                      <span className="text-4xl text-white font-bold">
                        {name.charAt(0).toUpperCase()}
                      </span>
                    ) : (
                      <User size={48} className="text-white/80" />
                    )}
                  </div>
                  {!hasCamera && (
                    <p className="text-gray-400 text-sm">Camera is off</p>
                  )}
                </div>
              )}

              {/* Device warning */}
              <AnimatePresence>
                {deviceError && (
                  <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="absolute top-4 left-4 right-4 bg-amber-500/20 border border-amber-500/50 backdrop-blur-sm rounded-xl px-4 py-3 flex items-center gap-3"
                  >
                    <AlertCircle size={18} className="text-amber-400 flex-shrink-0" />
                    <span className="text-amber-200 text-sm">{deviceError}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Controls */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={toggleMic}
                  disabled={!hasMic}
                  className={`
                    relative p-4 rounded-full transition-all duration-200
                    ${!hasMic
                      ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                      : isMicEnabled
                        ? 'bg-gray-700/80 backdrop-blur-sm text-white hover:bg-gray-600'
                        : 'bg-red-500 text-white hover:bg-red-600'
                    }
                  `}
                  title={!hasMic ? 'No microphone available' : isMicEnabled ? 'Mute' : 'Unmute'}
                >
                  {isMicEnabled && hasMic ? <Mic size={22} /> : <MicOff size={22} />}
                  {/* Audio level indicator */}
                  {isMicEnabled && hasMic && audioLevel > 0.1 && (
                    <span
                      className="absolute inset-0 rounded-full border-2 border-emerald-400 animate-ping opacity-50"
                      style={{ animationDuration: '1.5s' }}
                    />
                  )}
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={toggleCamera}
                  disabled={!hasCamera}
                  className={`
                    p-4 rounded-full transition-all duration-200
                    ${!hasCamera
                      ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                      : isCameraEnabled
                        ? 'bg-gray-700/80 backdrop-blur-sm text-white hover:bg-gray-600'
                        : 'bg-red-500 text-white hover:bg-red-600'
                    }
                  `}
                  title={!hasCamera ? 'No camera available' : isCameraEnabled ? 'Turn off camera' : 'Turn on camera'}
                >
                  {isCameraEnabled && hasCamera ? <Video size={22} /> : <VideoOff size={22} />}
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowSettings(!showSettings)}
                  className="p-4 rounded-full bg-gray-700/80 backdrop-blur-sm text-white hover:bg-gray-600 transition-colors"
                  title="Settings"
                >
                  <Settings size={22} />
                </motion.button>
              </div>

              {/* Audio Level Meter */}
              {isMicEnabled && hasMic && (
                <div className="absolute bottom-20 left-4 right-4">
                  <div className="flex items-center gap-2">
                    <Volume2 size={16} className="text-gray-400" />
                    <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500"
                        animate={{ width: `${audioLevel * 100}%` }}
                        transition={{ duration: 0.1 }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Settings Dropdown */}
            <AnimatePresence>
              {showSettings && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute top-full left-0 right-0 mt-4 bg-gray-800 border border-gray-700 rounded-2xl p-4 shadow-xl z-10"
                >
                  <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                    <Settings size={16} />
                    Device Settings
                  </h3>

                  {/* Camera Selection */}
                  <div className="mb-4">
                    <label className="block text-xs text-gray-400 mb-2 flex items-center gap-2">
                      <Video size={14} />
                      Camera
                    </label>
                    <div className="relative">
                      <select
                        value={selectedCamera}
                        onChange={(e) => setSelectedCamera(e.target.value)}
                        disabled={cameras.length === 0}
                        className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-xl text-white text-sm appearance-none cursor-pointer focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none disabled:opacity-50"
                      >
                        {cameras.length === 0 ? (
                          <option>No camera found</option>
                        ) : (
                          cameras.map((camera) => (
                            <option key={camera.deviceId} value={camera.deviceId}>
                              {camera.label || `Camera ${cameras.indexOf(camera) + 1}`}
                            </option>
                          ))
                        )}
                      </select>
                      <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    </div>
                  </div>

                  {/* Microphone Selection */}
                  <div>
                    <label className="block text-xs text-gray-400 mb-2 flex items-center gap-2">
                      <Mic size={14} />
                      Microphone
                    </label>
                    <div className="relative">
                      <select
                        value={selectedMic}
                        onChange={(e) => setSelectedMic(e.target.value)}
                        disabled={microphones.length === 0}
                        className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-xl text-white text-sm appearance-none cursor-pointer focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none disabled:opacity-50"
                      >
                        {microphones.length === 0 ? (
                          <option>No microphone found</option>
                        ) : (
                          microphones.map((mic) => (
                            <option key={mic.deviceId} value={mic.deviceId}>
                              {mic.label || `Microphone ${microphones.indexOf(mic) + 1}`}
                            </option>
                          ))
                        )}
                      </select>
                      <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Join Form */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-3xl p-8"
          >
            <h1 className="text-2xl font-bold text-white mb-2">Ready to join?</h1>
            <p className="text-gray-400 mb-8">
              {roomName ? (
                <>Meeting: <span className="text-white font-medium">{roomName}</span></>
              ) : (
                <>Room: <span className="font-mono text-white">{roomCode}</span></>
              )}
            </p>

            <div className="space-y-6">
              {/* Name Input */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Your name
                </label>
                <div className="flex items-center gap-3">
                  <MeetAvatar name={name || 'You'} size="lg" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter your name"
                    className="flex-1 px-4 py-3.5 bg-gray-700/50 border border-gray-600 rounded-xl text-white placeholder-gray-500 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                    onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                  />
                </div>
              </div>

              {/* Join Button */}
              <MeetButton
                variant="primary"
                size="lg"
                onClick={handleJoin}
                disabled={!name.trim() || loading.joining}
                isLoading={loading.joining}
                className="w-full py-4 text-base"
              >
                Join now
              </MeetButton>

              {/* Status Summary */}
              <div className="flex items-center justify-center gap-4 text-sm">
                <span className={`flex items-center gap-1.5 ${isMicEnabled ? 'text-emerald-400' : 'text-gray-500'}`}>
                  {isMicEnabled ? <Mic size={16} /> : <MicOff size={16} />}
                  {isMicEnabled ? 'Mic on' : 'Mic off'}
                </span>
                <span className="text-gray-600">•</span>
                <span className={`flex items-center gap-1.5 ${isCameraEnabled ? 'text-emerald-400' : 'text-gray-500'}`}>
                  {isCameraEnabled ? <Video size={16} /> : <VideoOff size={16} />}
                  {isCameraEnabled ? 'Camera on' : 'Camera off'}
                </span>
              </div>
            </div>
          </motion.div>
        </motion.div>

        {/* Tips */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-8 text-center text-sm text-gray-500"
        >
          <p>Make sure your camera and microphone are working before joining.</p>
        </motion.div>
      </div>
    </div>
  );
}
