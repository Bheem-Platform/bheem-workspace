import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield,
  Video,
  Monitor,
  MessageSquare,
  Users,
  Zap,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

const features = [
  {
    id: 1,
    title: 'Crystal Clear HD Video',
    description: 'Experience stunning video quality with adaptive streaming that adjusts to your connection for the best possible experience.',
    icon: Video,
    color: 'from-[#FFCCF2] via-[#977DFF] to-[#0033FF]',
    bgColor: 'bg-gradient-to-br from-[#FFCCF2]/10 via-[#977DFF]/10 to-[#0033FF]/10',
  },
  {
    id: 2,
    title: 'End-to-End Encryption',
    description: 'Your conversations stay private with enterprise-grade security. All meetings are encrypted from start to finish.',
    icon: Shield,
    color: 'from-[#977DFF] to-[#0033FF]',
    bgColor: 'bg-gradient-to-br from-[#977DFF]/10 to-[#0033FF]/10',
  },
  {
    id: 3,
    title: 'Instant Screen Sharing',
    description: 'Share your entire screen or specific windows with one click. Perfect for presentations and collaboration.',
    icon: Monitor,
    color: 'from-[#0033FF] to-[#977DFF]',
    bgColor: 'bg-gradient-to-br from-[#0033FF]/10 to-[#977DFF]/10',
  },
  {
    id: 4,
    title: 'Real-time Chat & Reactions',
    description: 'Send messages, share files, and react with emojis during your meetings without interrupting the conversation.',
    icon: MessageSquare,
    color: 'from-[#977DFF] to-[#FFCCF2]',
    bgColor: 'bg-gradient-to-br from-[#977DFF]/10 to-[#FFCCF2]/10',
  },
  {
    id: 5,
    title: 'Host Large Meetings',
    description: 'Invite up to 100 participants to your meetings. Perfect for team all-hands, webinars, and virtual events.',
    icon: Users,
    color: 'from-[#FFCCF2] to-[#0033FF]',
    bgColor: 'bg-gradient-to-br from-[#FFCCF2]/10 to-[#0033FF]/10',
  },
  {
    id: 6,
    title: 'Lightning Fast Performance',
    description: 'Join meetings instantly with no downloads required. Works seamlessly in your browser on any device.',
    icon: Zap,
    color: 'from-[#0033FF] via-[#977DFF] to-[#FFCCF2]',
    bgColor: 'bg-gradient-to-br from-[#0033FF]/10 via-[#977DFF]/10 to-[#FFCCF2]/10',
  },
];

// Avatar data for animated people
const avatars = [
  { name: 'Alex', color: 'from-pink-400 to-rose-500', initials: 'A' },
  { name: 'Jordan', color: 'from-blue-400 to-indigo-500', initials: 'J' },
  { name: 'Sam', color: 'from-green-400 to-emerald-500', initials: 'S' },
  { name: 'Taylor', color: 'from-purple-400 to-violet-500', initials: 'T' },
  { name: 'Morgan', color: 'from-orange-400 to-amber-500', initials: 'M' },
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

      {/* Floating avatars around the main icon */}
      {avatars.map((avatar, i) => {
        const angle = (i * 72) * (Math.PI / 180); // Distribute evenly in circle
        const radius = 80;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;

        return (
          <motion.div
            key={avatar.name}
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
              className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br ${avatar.color} flex items-center justify-center text-white font-bold text-sm sm:text-base shadow-lg border-2 border-white`}
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
              {avatar.initials}
            </motion.div>
            {/* Online indicator */}
            <motion.div
              className="absolute -bottom-0.5 -right-0.5 w-3 h-3 sm:w-3.5 sm:h-3.5 bg-green-500 rounded-full border-2 border-white"
              animate={isActive ? {
                scale: [1, 1.2, 1],
              } : {}}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
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

      {/* Connection lines from avatars to center */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 5 }}>
        {avatars.map((avatar, i) => {
          const angle = (i * 72) * (Math.PI / 180);
          const radius = 80;
          const x = Math.cos(angle) * radius + 50; // offset to center
          const y = Math.sin(angle) * radius + 50;

          return (
            <motion.line
              key={`line-${i}`}
              x1="50%"
              y1="50%"
              x2={`${x}%`}
              y2={`${y}%`}
              stroke="url(#gradient)"
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
          <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
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

export default function FeaturesCarousel() {
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
    // Resume auto-play after 10 seconds of inactivity
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
      className="mb-10 sm:mb-14"
    >
      <div className={`relative rounded-3xl ${currentFeature.bgColor} p-6 sm:p-10 overflow-hidden transition-colors duration-500`}>
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden">
          <div className={`absolute -top-20 -right-20 w-40 h-40 sm:w-64 sm:h-64 rounded-full bg-gradient-to-br ${currentFeature.color} opacity-10 blur-3xl`} />
          <div className={`absolute -bottom-20 -left-20 w-40 h-40 sm:w-64 sm:h-64 rounded-full bg-gradient-to-br ${currentFeature.color} opacity-10 blur-3xl`} />
        </div>

        <div className="relative z-10">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Zap size={18} className="text-[#977DFF]" />
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
          <div className="grid md:grid-cols-2 gap-6 sm:gap-10 items-center">
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
                  <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3 sm:mb-4">
                    {currentFeature.title}
                  </h2>
                  <p className="text-gray-600 text-base sm:text-lg leading-relaxed mb-6">
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
