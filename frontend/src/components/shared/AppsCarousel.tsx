/**
 * AppsCarousel - Showcase all Bheem apps that connect your life
 * Brand colors: #FFCCF2, #977DFF, #0033FF
 */
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import {
  ChevronLeft,
  ChevronRight,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import {
  BheemMailIcon,
  BheemDocsIcon,
  BheemCalendarIcon,
  BheemMeetIcon,
  BheemDriveIcon,
  BheemSheetsIcon,
  BheemSlidesIcon,
  BheemChatIcon,
} from '@/components/shared/AppIcons';

const apps = [
  {
    id: 1,
    name: 'Bheem Mail',
    tagline: 'Stay Connected',
    description: 'Professional email that keeps you in sync with your team. Smart inbox, powerful search, and seamless integration.',
    icon: BheemMailIcon,
    href: '/mail',
    color: 'from-[#FFCCF2] to-[#977DFF]',
    bgColor: 'bg-gradient-to-br from-[#FFCCF2]/20 to-[#977DFF]/10',
    features: ['Smart Inbox', 'Labels & Filters', 'Email Templates'],
  },
  {
    id: 2,
    name: 'Bheem Meet',
    tagline: 'Face to Face, Anywhere',
    description: 'Crystal clear video meetings with your team. HD video, screen sharing, and real-time collaboration.',
    icon: BheemMeetIcon,
    href: '/meet',
    color: 'from-[#977DFF] to-[#0033FF]',
    bgColor: 'bg-gradient-to-br from-[#977DFF]/20 to-[#0033FF]/10',
    features: ['HD Video Calls', 'Screen Sharing', 'Meeting Recording'],
  },
  {
    id: 3,
    name: 'Bheem Docs',
    tagline: 'Create Together',
    description: 'Collaborate on documents in real-time. Rich editing, comments, and version history all in one place.',
    icon: BheemDocsIcon,
    href: '/docs',
    color: 'from-[#0033FF] to-[#977DFF]',
    bgColor: 'bg-gradient-to-br from-[#0033FF]/20 to-[#977DFF]/10',
    features: ['Real-time Editing', 'Comments', 'Version History'],
  },
  {
    id: 4,
    name: 'Bheem Calendar',
    tagline: 'Time Well Spent',
    description: 'Organize your schedule effortlessly. Smart scheduling, reminders, and seamless meeting integration.',
    icon: BheemCalendarIcon,
    href: '/calendar',
    color: 'from-[#977DFF] to-[#FFCCF2]',
    bgColor: 'bg-gradient-to-br from-[#977DFF]/20 to-[#FFCCF2]/10',
    features: ['Smart Scheduling', 'Reminders', 'Team Calendars'],
  },
  {
    id: 5,
    name: 'Bheem Drive',
    tagline: 'Your Files, Everywhere',
    description: 'Secure cloud storage for all your files. Access anywhere, share easily, and never lose a file again.',
    icon: BheemDriveIcon,
    href: '/drive',
    color: 'from-[#FFCCF2] to-[#0033FF]',
    bgColor: 'bg-gradient-to-br from-[#FFCCF2]/20 to-[#0033FF]/10',
    features: ['Cloud Storage', 'Easy Sharing', 'File Preview'],
  },
  {
    id: 6,
    name: 'Bheem Sheets',
    tagline: 'Data Made Simple',
    description: 'Powerful spreadsheets for data analysis. Formulas, charts, and collaborative editing.',
    icon: BheemSheetsIcon,
    href: '/sheets',
    color: 'from-[#0033FF] via-[#977DFF] to-[#FFCCF2]',
    bgColor: 'bg-gradient-to-br from-[#0033FF]/20 via-[#977DFF]/10 to-[#FFCCF2]/10',
    features: ['Formulas', 'Charts', 'Data Analysis'],
  },
  {
    id: 7,
    name: 'Bheem Slides',
    tagline: 'Present with Impact',
    description: 'Beautiful presentations that captivate. Templates, animations, and live collaboration.',
    icon: BheemSlidesIcon,
    href: '/slides',
    color: 'from-[#977DFF] via-[#FFCCF2] to-[#0033FF]',
    bgColor: 'bg-gradient-to-br from-[#977DFF]/20 via-[#FFCCF2]/10 to-[#0033FF]/10',
    features: ['Templates', 'Animations', 'Present Mode'],
  },
  {
    id: 8,
    name: 'Bheem Chat',
    tagline: 'Conversations Flow',
    description: 'Instant messaging for your team. Channels, direct messages, and file sharing.',
    icon: BheemChatIcon,
    href: '/chat',
    color: 'from-[#FFCCF2] via-[#977DFF] to-[#0033FF]',
    bgColor: 'bg-gradient-to-br from-[#FFCCF2]/20 via-[#977DFF]/10 to-[#0033FF]/10',
    features: ['Channels', 'Direct Messages', 'File Sharing'],
  },
];

// Animated app icon with floating effect
function AnimatedAppIcon({ app, isActive }: { app: typeof apps[0]; isActive: boolean }) {
  const IconComponent = app.icon;

  return (
    <div className="relative w-full h-40 flex items-center justify-center overflow-hidden">
      {/* Background glow */}
      <motion.div
        className={`absolute w-32 h-32 rounded-full bg-gradient-to-br ${app.color} opacity-20 blur-2xl`}
        animate={isActive ? {
          scale: [1, 1.3, 1],
        } : {}}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Orbiting dots */}
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="absolute"
          animate={isActive ? {
            rotate: 360,
          } : {}}
          transition={{
            duration: 8 + i * 2,
            repeat: Infinity,
            ease: 'linear',
          }}
          style={{
            width: 100 + i * 30,
            height: 100 + i * 30,
          }}
        >
          <motion.div
            className={`absolute w-2 h-2 rounded-full bg-gradient-to-br ${app.color} opacity-60`}
            style={{
              top: 0,
              left: '50%',
              transform: 'translateX(-50%)',
            }}
          />
        </motion.div>
      ))}

      {/* Main icon */}
      <motion.div
        className="relative z-10"
        animate={isActive ? {
          y: [0, -8, 0],
          scale: [1, 1.05, 1],
        } : {}}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      >
        <div className="relative">
          <IconComponent size={80} />
          {/* Shine effect */}
          <motion.div
            className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-white/0 via-white/40 to-white/0"
            animate={isActive ? {
              x: ['-100%', '100%'],
            } : {}}
            transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
          />
        </div>
      </motion.div>

      {/* Floating particles */}
      {[...Array(4)].map((_, i) => (
        <motion.div
          key={i}
          className={`absolute w-1.5 h-1.5 rounded-full bg-gradient-to-br ${app.color}`}
          animate={isActive ? {
            opacity: [0, 1, 0],
            y: [20, -30],
            x: [(i - 2) * 20, (i - 2) * 30],
          } : { opacity: 0 }}
          transition={{
            duration: 2,
            delay: i * 0.4,
            repeat: Infinity,
            repeatDelay: 1,
          }}
          style={{
            left: '50%',
            top: '60%',
          }}
        />
      ))}
    </div>
  );
}

export default function AppsCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  // Auto-advance slides
  useEffect(() => {
    if (!isAutoPlaying) return;

    const interval = setInterval(() => {
      setDirection(1);
      setCurrentIndex((prev) => (prev + 1) % apps.length);
    }, 4000);

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
    setCurrentIndex((prev) => (prev - 1 + apps.length) % apps.length);
    setIsAutoPlaying(false);
    setTimeout(() => setIsAutoPlaying(true), 10000);
  };

  const goToNext = () => {
    setDirection(1);
    setCurrentIndex((prev) => (prev + 1) % apps.length);
    setIsAutoPlaying(false);
    setTimeout(() => setIsAutoPlaying(true), 10000);
  };

  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 200 : -200,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (direction: number) => ({
      x: direction < 0 ? 200 : -200,
      opacity: 0,
    }),
  };

  const currentApp = apps[currentIndex];

  return (
    <div className={`relative rounded-xl ${currentApp.bgColor} p-6 overflow-hidden transition-colors duration-500 border border-gray-200`}>
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className={`absolute -top-16 -right-16 w-48 h-48 rounded-full bg-gradient-to-br ${currentApp.color} opacity-10 blur-3xl`} />
        <div className={`absolute -bottom-16 -left-16 w-48 h-48 rounded-full bg-gradient-to-br ${currentApp.color} opacity-10 blur-3xl`} />
      </div>

      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-[#977DFF]" />
            <span className="text-sm font-medium text-[#977DFF]">Apps that connect your life</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={goToPrev}
              className="p-1.5 rounded-full bg-white/80 hover:bg-white text-gray-600 hover:text-gray-900 transition-colors shadow-sm"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={goToNext}
              className="p-1.5 rounded-full bg-white/80 hover:bg-white text-gray-600 hover:text-gray-900 transition-colors shadow-sm"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
          {/* Animated Icon */}
          <div className="order-2 md:order-1">
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={currentIndex}
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.4, ease: 'easeInOut' }}
              >
                <AnimatedAppIcon app={currentApp} isActive={true} />
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
                transition={{ duration: 0.4, ease: 'easeInOut' }}
              >
                <p className="text-xs font-medium text-[#977DFF] uppercase tracking-wider mb-1">
                  {currentApp.tagline}
                </p>
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  {currentApp.name}
                </h3>
                <p className="text-gray-600 text-sm leading-relaxed mb-3">
                  {currentApp.description}
                </p>

                {/* Feature tags */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {currentApp.features.map((feature, i) => (
                    <span
                      key={i}
                      className="px-2 py-1 text-xs font-medium bg-white/60 text-gray-700 rounded-full"
                    >
                      {feature}
                    </span>
                  ))}
                </div>

                {/* CTA Button */}
                <Link href={currentApp.href}>
                  <motion.button
                    className={`inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r ${currentApp.color} text-white text-sm font-medium rounded-lg shadow-md hover:shadow-lg transition-shadow`}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    Open {currentApp.name.replace('Bheem ', '')}
                    <ArrowRight size={14} />
                  </motion.button>
                </Link>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Progress indicators */}
        <div className="flex items-center justify-center gap-1.5 mt-4">
          {apps.map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className="relative h-1 rounded-full overflow-hidden transition-all duration-300"
              style={{ width: index === currentIndex ? 24 : 8 }}
            >
              <div className="absolute inset-0 bg-gray-300" />
              {index === currentIndex && (
                <motion.div
                  className={`absolute inset-0 bg-gradient-to-r ${currentApp.color}`}
                  initial={{ width: '0%' }}
                  animate={{ width: '100%' }}
                  transition={{ duration: 4, ease: 'linear' }}
                  key={`progress-${currentIndex}`}
                />
              )}
              {index < currentIndex && (
                <div className={`absolute inset-0 bg-gradient-to-r ${apps[index].color}`} />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
