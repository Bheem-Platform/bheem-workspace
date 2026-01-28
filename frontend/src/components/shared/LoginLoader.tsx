/**
 * Bheem Login Loader - Clean, Modern Post-Login Loading Experience
 * Brand Colors: #FFCCF2 (Pink), #977DFF (Purple), #0033FF (Blue)
 * Circular loading animation around the branded logo
 */
import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface LoginLoaderProps {
  userName?: string;
  onComplete?: () => void;
}

export default function LoginLoader({ userName, onComplete }: LoginLoaderProps) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          setTimeout(() => onComplete?.(), 300);
          return 100;
        }
        return prev + 1.5;
      });
    }, 30);

    return () => clearInterval(progressInterval);
  }, [onComplete]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{
        background: 'linear-gradient(135deg, #f8f9ff 0%, #ffffff 50%, #fdf8fc 100%)',
      }}
    >
      {/* Animated gradient blobs */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          className="absolute w-[500px] h-[500px] rounded-full opacity-30"
          style={{
            background: 'radial-gradient(circle, #FFCCF2 0%, transparent 70%)',
            top: '-10%',
            right: '-5%',
          }}
          animate={{
            scale: [1, 1.2, 1],
            x: [0, -30, 0],
            y: [0, 20, 0],
          }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute w-[400px] h-[400px] rounded-full opacity-25"
          style={{
            background: 'radial-gradient(circle, #977DFF 0%, transparent 70%)',
            bottom: '-5%',
            left: '-5%',
          }}
          animate={{
            scale: [1, 1.3, 1],
            x: [0, 20, 0],
            y: [0, -30, 0],
          }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute w-[300px] h-[300px] rounded-full opacity-20"
          style={{
            background: 'radial-gradient(circle, #0033FF 0%, transparent 70%)',
            top: '40%',
            left: '60%',
          }}
          animate={{
            scale: [1, 1.4, 1],
          }}
          transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex flex-col items-center">
        {/* Logo with Circular Loading */}
        <div className="relative mb-10">
          {/* Circular Progress Ring */}
          <svg
            className="absolute -inset-6"
            width="152"
            height="152"
            viewBox="0 0 152 152"
            style={{ transform: 'rotate(-90deg)' }}
          >
            <defs>
              <linearGradient id="progressGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FFCCF2" />
                <stop offset="50%" stopColor="#977DFF" />
                <stop offset="100%" stopColor="#0033FF" />
              </linearGradient>
            </defs>
            {/* Background circle */}
            <circle
              cx="76"
              cy="76"
              r="70"
              fill="none"
              stroke="#f0f0f5"
              strokeWidth="6"
            />
            {/* Progress circle */}
            <motion.circle
              cx="76"
              cy="76"
              r="70"
              fill="none"
              stroke="url(#progressGrad)"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={440}
              strokeDashoffset={440 - (440 * progress) / 100}
              style={{
                filter: 'drop-shadow(0 0 8px rgba(151, 125, 255, 0.5))',
              }}
            />
          </svg>

          {/* Outer spinning ring */}
          <motion.div
            className="absolute -inset-10"
            animate={{ rotate: 360 }}
            transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
          >
            <svg viewBox="0 0 180 180" className="w-full h-full">
              <defs>
                <linearGradient id="spinGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#FFCCF2" stopOpacity="0.6" />
                  <stop offset="50%" stopColor="#977DFF" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#0033FF" stopOpacity="0.2" />
                </linearGradient>
              </defs>
              <circle
                cx="90"
                cy="90"
                r="85"
                fill="none"
                stroke="url(#spinGrad1)"
                strokeWidth="1.5"
                strokeDasharray="30 50"
                strokeLinecap="round"
              />
            </svg>
          </motion.div>

          {/* Inner spinning ring - opposite direction */}
          <motion.div
            className="absolute -inset-3"
            animate={{ rotate: -360 }}
            transition={{ duration: 5, repeat: Infinity, ease: 'linear' }}
          >
            <svg viewBox="0 0 126 126" className="w-full h-full">
              <defs>
                <linearGradient id="spinGrad2" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#0033FF" stopOpacity="0.4" />
                  <stop offset="50%" stopColor="#977DFF" stopOpacity="0.6" />
                  <stop offset="100%" stopColor="#FFCCF2" stopOpacity="0.4" />
                </linearGradient>
              </defs>
              <circle
                cx="63"
                cy="63"
                r="58"
                fill="none"
                stroke="url(#spinGrad2)"
                strokeWidth="2"
                strokeDasharray="20 40"
                strokeLinecap="round"
              />
            </svg>
          </motion.div>

          {/* Pulsing glow behind logo */}
          <motion.div
            className="absolute inset-0 rounded-2xl"
            style={{
              background: 'linear-gradient(135deg, #FFCCF2, #977DFF, #0033FF)',
              filter: 'blur(20px)',
            }}
            animate={{
              opacity: [0.4, 0.7, 0.4],
              scale: [1, 1.15, 1],
            }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          />

          {/* Logo container */}
          <motion.div
            className="relative w-20 h-20 rounded-2xl flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, #FFCCF2 0%, #977DFF 50%, #0033FF 100%)',
              boxShadow: '0 15px 50px -10px rgba(151, 125, 255, 0.5)',
            }}
            initial={{ scale: 0, rotate: -90 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', duration: 0.8, bounce: 0.4 }}
          >
            {/* Shine sweep effect */}
            <motion.div className="absolute inset-0 rounded-2xl overflow-hidden">
              <motion.div
                className="absolute inset-0"
                style={{
                  background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.4) 50%, transparent 60%)',
                }}
                animate={{ x: ['-100%', '200%'] }}
                transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 1.5, ease: 'easeInOut' }}
              />
            </motion.div>

            {/* B Letter */}
            <span
              className="text-4xl font-black text-white"
              style={{
                fontFamily: 'system-ui, -apple-system, sans-serif',
                textShadow: '0 2px 10px rgba(0,0,0,0.2)'
              }}
            >
              B
            </span>
          </motion.div>

          {/* Orbiting dots */}
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="absolute w-2.5 h-2.5 rounded-full"
              style={{
                background: i === 0 ? '#FFCCF2' : i === 1 ? '#977DFF' : '#0033FF',
                boxShadow: `0 0 12px ${i === 0 ? '#FFCCF2' : i === 1 ? '#977DFF' : '#0033FF'}`,
                top: '50%',
                left: '50%',
              }}
              animate={{
                x: [
                  Math.cos((i * 120 * Math.PI) / 180) * 55,
                  Math.cos(((i * 120 + 360) * Math.PI) / 180) * 55,
                ],
                y: [
                  Math.sin((i * 120 * Math.PI) / 180) * 55,
                  Math.sin(((i * 120 + 360) * Math.PI) / 180) * 55,
                ],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: 'linear',
                delay: i * 0.2,
              }}
            />
          ))}

          {/* Progress percentage in corner */}
          <motion.div
            className="absolute -bottom-2 -right-2 w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold"
            style={{
              background: 'linear-gradient(135deg, #977DFF, #0033FF)',
              color: 'white',
              boxShadow: '0 4px 15px rgba(151, 125, 255, 0.4)',
            }}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.3 }}
          >
            {Math.round(progress)}%
          </motion.div>
        </div>

        {/* Welcome Text */}
        <motion.div
          className="text-center mb-4"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          <h1
            className="text-3xl font-bold mb-2"
            style={{
              background: 'linear-gradient(135deg, #977DFF 0%, #0033FF 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            {userName ? `Welcome, ${userName}!` : 'Welcome back!'}
          </h1>
          <p className="text-gray-500 text-base">
            Setting up your workspace...
          </p>
        </motion.div>

        {/* Brand tagline */}
        <motion.p
          className="mt-8 text-sm text-gray-400"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
        >
          Powered by{' '}
          <span
            className="font-semibold"
            style={{
              background: 'linear-gradient(90deg, #977DFF, #0033FF)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            Bheem Workspace
          </span>
        </motion.p>
      </div>
    </motion.div>
  );
}
