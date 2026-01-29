import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield,
  Cloud,
  Share2,
  FolderSearch,
  Users,
  Zap,
  ChevronLeft,
  ChevronRight,
  HardDrive,
  Lock,
  FileText,
  Sparkles,
} from 'lucide-react';

const features = [
  {
    id: 1,
    title: 'Secure Cloud Storage',
    description: 'Store all your files safely in the cloud with enterprise-grade encryption. Access them anywhere, anytime, from any device.',
    icon: Cloud,
    color: 'from-[#FFCCF2] via-[#977DFF] to-[#0033FF]',
    bgColor: 'bg-gradient-to-br from-[#FFCCF2]/10 via-[#977DFF]/10 to-[#0033FF]/10',
  },
  {
    id: 2,
    title: 'Easy File Sharing',
    description: 'Share files and folders with teammates or external collaborators. Set permissions and expiry dates for shared links.',
    icon: Share2,
    color: 'from-[#977DFF] to-[#0033FF]',
    bgColor: 'bg-gradient-to-br from-[#977DFF]/10 to-[#0033FF]/10',
  },
  {
    id: 3,
    title: 'Smart Organization',
    description: 'Keep your files organized with folders, tags, and powerful search. Find any file in seconds with intelligent filtering.',
    icon: FolderSearch,
    color: 'from-[#0033FF] to-[#977DFF]',
    bgColor: 'bg-gradient-to-br from-[#0033FF]/10 to-[#977DFF]/10',
  },
  {
    id: 4,
    title: 'Real-time Collaboration',
    description: 'Work together on documents, spreadsheets, and presentations. See changes in real-time and never lose work.',
    icon: Users,
    color: 'from-[#977DFF] to-[#FFCCF2]',
    bgColor: 'bg-gradient-to-br from-[#977DFF]/10 to-[#FFCCF2]/10',
  },
  {
    id: 5,
    title: 'Advanced Security',
    description: 'End-to-end encryption, access controls, and audit logs keep your sensitive data protected at all times.',
    icon: Shield,
    color: 'from-[#FFCCF2] to-[#0033FF]',
    bgColor: 'bg-gradient-to-br from-[#FFCCF2]/10 to-[#0033FF]/10',
  },
  {
    id: 6,
    title: 'Lightning Fast Sync',
    description: 'Changes sync instantly across all devices. Upload large files quickly with resumable uploads.',
    icon: Zap,
    color: 'from-[#0033FF] via-[#977DFF] to-[#FFCCF2]',
    bgColor: 'bg-gradient-to-br from-[#0033FF]/10 via-[#977DFF]/10 to-[#FFCCF2]/10',
  },
];

// File type icons for animation
const fileTypes = [
  { icon: FileText, color: 'from-blue-400 to-blue-600', label: 'DOC' },
  { icon: HardDrive, color: 'from-purple-400 to-purple-600', label: 'ZIP' },
  { icon: Lock, color: 'from-green-400 to-green-600', label: 'PDF' },
  { icon: Cloud, color: 'from-pink-400 to-pink-600', label: 'IMG' },
  { icon: Sparkles, color: 'from-orange-400 to-orange-600', label: 'XLS' },
];

// Animated illustration component
function AnimatedIllustration({ feature, isActive }: { feature: typeof features[0]; isActive: boolean }) {
  const Icon = feature.icon;

  return (
    <div className="relative w-full h-48 sm:h-64 flex items-center justify-center overflow-hidden">
      {/* Background circles */}
      <motion.div
        className={`absolute w-32 h-32 sm:w-48 sm:h-48 rounded-full bg-gradient-to-br ${feature.color} opacity-20 blur-3xl`}
        animate={isActive ? {
          scale: [1, 1.2, 1],
          rotate: [0, 180, 360],
        } : {}}
        transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
      />

      {/* Floating file icons around the main icon */}
      {fileTypes.map((file, i) => {
        const angle = (i * 72) * (Math.PI / 180);
        const radius = 75;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        const FileIcon = file.icon;

        return (
          <motion.div
            key={file.label}
            className="absolute z-20"
            initial={{ opacity: 0, scale: 0 }}
            animate={isActive ? {
              opacity: 1,
              scale: 1,
              x: [x, x + (i % 2 === 0 ? 5 : -5), x],
              y: [y, y - 8, y],
            } : { opacity: 0, scale: 0 }}
            transition={{
              opacity: { duration: 0.5, delay: i * 0.1 },
              scale: { duration: 0.5, delay: i * 0.1 },
              x: { duration: 3, repeat: Infinity, ease: 'easeInOut', delay: i * 0.2 },
              y: { duration: 2, repeat: Infinity, ease: 'easeInOut', delay: i * 0.3 },
            }}
          >
            <motion.div
              className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br ${file.color} flex items-center justify-center text-white shadow-lg border-2 border-white`}
              whileHover={{ scale: 1.2 }}
              animate={isActive ? {
                boxShadow: [
                  '0 4px 15px rgba(0,0,0,0.1)',
                  '0 8px 25px rgba(0,0,0,0.2)',
                  '0 4px 15px rgba(0,0,0,0.1)',
                ],
              } : {}}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <FileIcon size={20} className="sm:w-6 sm:h-6" />
            </motion.div>
            {/* Label */}
            <motion.div
              className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 px-1.5 py-0.5 bg-white rounded text-[10px] font-bold text-gray-600 shadow-sm"
              animate={isActive ? { opacity: [0.7, 1, 0.7] } : {}}
              transition={{ duration: 2, repeat: Infinity }}
            >
              {file.label}
            </motion.div>
          </motion.div>
        );
      })}

      {/* Floating particles */}
      {[...Array(6)].map((_, i) => (
        <motion.div
          key={i}
          className={`absolute w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-gradient-to-br ${feature.color}`}
          initial={{ opacity: 0 }}
          animate={isActive ? {
            opacity: [0, 1, 0],
            x: [0, (i % 2 === 0 ? 1 : -1) * (30 + i * 10)],
            y: [0, -50 - i * 10],
            scale: [0, 1, 0],
          } : { opacity: 0 }}
          transition={{
            duration: 2,
            delay: i * 0.3,
            repeat: Infinity,
            repeatDelay: 1,
          }}
          style={{
            left: `${40 + i * 5}%`,
            top: '60%',
          }}
        />
      ))}

      {/* Main icon container */}
      <motion.div
        className={`relative z-10 w-20 h-20 sm:w-28 sm:h-28 rounded-3xl bg-gradient-to-br ${feature.color} flex items-center justify-center shadow-2xl`}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={isActive ? {
          scale: 1,
          opacity: 1,
          y: [0, -10, 0],
        } : { scale: 0.8, opacity: 0 }}
        transition={{
          scale: { duration: 0.5 },
          y: { duration: 3, repeat: Infinity, ease: 'easeInOut' }
        }}
      >
        <Icon size={40} className="text-white sm:w-14 sm:h-14" />

        {/* Shine effect */}
        <motion.div
          className="absolute inset-0 rounded-3xl bg-gradient-to-tr from-white/0 via-white/30 to-white/0"
          animate={isActive ? {
            x: ['-100%', '100%'],
          } : {}}
          transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
        />
      </motion.div>

      {/* Connection lines from files to center */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 5 }}>
        {fileTypes.map((file, i) => {
          const angle = (i * 72) * (Math.PI / 180);
          const radius = 75;
          const x = Math.cos(angle) * radius + 50;
          const y = Math.sin(angle) * radius + 50;

          return (
            <motion.line
              key={`line-${i}`}
              x1="50%"
              y1="50%"
              x2={`${x}%`}
              y2={`${y}%`}
              stroke="url(#driveGradient)"
              strokeWidth="1"
              strokeDasharray="4 4"
              initial={{ opacity: 0 }}
              animate={isActive ? {
                opacity: [0.2, 0.5, 0.2],
                strokeDashoffset: [0, 8],
              } : { opacity: 0 }}
              transition={{
                opacity: { duration: 2, repeat: Infinity },
                strokeDashoffset: { duration: 1, repeat: Infinity, ease: 'linear' },
              }}
            />
          );
        })}
        <defs>
          <linearGradient id="driveGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#977DFF" />
            <stop offset="100%" stopColor="#0033FF" />
          </linearGradient>
        </defs>
      </svg>

      {/* Orbiting elements */}
      {[0, 1].map((i) => (
        <motion.div
          key={i}
          className="absolute"
          animate={isActive ? {
            rotate: i === 0 ? 360 : -360,
          } : {}}
          transition={{
            duration: 15 + i * 5,
            repeat: Infinity,
            ease: 'linear',
          }}
          style={{
            width: 160 + i * 40,
            height: 160 + i * 40,
          }}
        >
          <motion.div
            className={`absolute w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-gradient-to-br ${feature.color} shadow-lg opacity-60`}
            style={{
              top: 0,
              left: '50%',
              transform: 'translateX(-50%)',
            }}
            animate={isActive ? { scale: [1, 1.3, 1] } : {}}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
        </motion.div>
      ))}
    </div>
  );
}

export default function DriveFeaturesCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  // Auto-advance slides
  useEffect(() => {
    if (!isAutoPlaying) return;

    const interval = setInterval(() => {
      setDirection(1);
      setCurrentIndex((prev) => (prev + 1) % features.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [isAutoPlaying]);

  const goToSlide = (index: number) => {
    setDirection(index > currentIndex ? 1 : -1);
    setCurrentIndex(index);
    setIsAutoPlaying(false);
    setTimeout(() => setIsAutoPlaying(true), 10000);
  };

  const goToPrev = () => {
    setDirection(-1);
    setCurrentIndex((prev) => (prev - 1 + features.length) % features.length);
    setIsAutoPlaying(false);
    setTimeout(() => setIsAutoPlaying(true), 10000);
  };

  const goToNext = () => {
    setDirection(1);
    setCurrentIndex((prev) => (prev + 1) % features.length);
    setIsAutoPlaying(false);
    setTimeout(() => setIsAutoPlaying(true), 10000);
  };

  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 300 : -300,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (direction: number) => ({
      x: direction < 0 ? 300 : -300,
      opacity: 0,
    }),
  };

  const currentFeature = features[currentIndex];

  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.2 }}
      className="mb-6"
    >
      <div className={`relative rounded-2xl ${currentFeature.bgColor} p-5 sm:p-8 overflow-hidden transition-colors duration-500`}>
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden">
          <div className={`absolute -top-20 -right-20 w-40 h-40 sm:w-64 sm:h-64 rounded-full bg-gradient-to-br ${currentFeature.color} opacity-10 blur-3xl`} />
          <div className={`absolute -bottom-20 -left-20 w-40 h-40 sm:w-64 sm:h-64 rounded-full bg-gradient-to-br ${currentFeature.color} opacity-10 blur-3xl`} />
        </div>

        <div className="relative z-10">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <HardDrive size={18} className="text-[#977DFF]" />
              <span className="text-sm font-medium text-[#977DFF]">Features</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={goToPrev}
                className="p-2 rounded-full bg-white/80 hover:bg-white text-gray-600 hover:text-gray-900 transition-colors shadow-sm"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                onClick={goToNext}
                className="p-2 rounded-full bg-white/80 hover:bg-white text-gray-600 hover:text-gray-900 transition-colors shadow-sm"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="grid md:grid-cols-2 gap-4 sm:gap-8 items-center">
            {/* Animated Illustration */}
            <div className="order-2 md:order-1">
              <AnimatePresence mode="wait" custom={direction}>
                <motion.div
                  key={currentIndex}
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.5, ease: 'easeInOut' }}
                >
                  <AnimatedIllustration feature={currentFeature} isActive={true} />
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Text Content */}
            <div className="order-1 md:order-2">
              <AnimatePresence mode="wait" custom={direction}>
                <motion.div
                  key={currentIndex}
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.5, ease: 'easeInOut' }}
                >
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2 sm:mb-3">
                    {currentFeature.title}
                  </h2>
                  <p className="text-gray-600 text-sm sm:text-base leading-relaxed mb-4">
                    {currentFeature.description}
                  </p>
                </motion.div>
              </AnimatePresence>

              {/* Progress indicators */}
              <div className="flex items-center gap-2">
                {features.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => goToSlide(index)}
                    className="relative h-1.5 rounded-full overflow-hidden transition-all duration-300"
                    style={{ width: index === currentIndex ? 32 : 12 }}
                  >
                    <div className="absolute inset-0 bg-gray-300" />
                    {index === currentIndex && (
                      <motion.div
                        className={`absolute inset-0 bg-gradient-to-r ${currentFeature.color}`}
                        initial={{ width: '0%' }}
                        animate={{ width: '100%' }}
                        transition={{ duration: 5, ease: 'linear' }}
                        key={`progress-${currentIndex}`}
                      />
                    )}
                    {index < currentIndex && (
                      <div className={`absolute inset-0 bg-gradient-to-r ${features[index].color}`} />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.section>
  );
}
