import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import Script from 'next/script';
import Image from 'next/image';
import { motion, AnimatePresence, useInView, useScroll, useTransform } from 'framer-motion';
import {
  Zap, Shield, Bot, Check, Star, ArrowRight, Play, Sparkles, Users,
  Clock, TrendingUp, Award, CheckCircle2, Lock, Globe,
  Mail, FileText, Video, Calendar, HardDrive, Table, Presentation,
  MessageCircle, ChevronLeft, ChevronRight, Quote, Rocket,
  Target, Heart, Lightbulb, Puzzle, Send, Mic, Camera, Share2,
  Bell, Search, FolderOpen, PenTool, BarChart2, Monitor, Laptop,
  Smartphone, Server, Wifi, Activity, Cpu, Database
} from 'lucide-react';

declare global {
  interface Window {
    Razorpay: any;
  }
}

// Bheem Brand Colors
const BHEEM_COLORS = {
  pink: '#FFCCF2',
  purple: '#977DFF',
  blue: '#0033FF',
  darkBlue: '#0600AB',
  deepBlue: '#00033D',
};

// Animated Avatar Component - Plays once
function AnimatedAvatar({
  name,
  color,
  size = 48,
  delay = 0,
  className = ''
}: {
  name: string;
  color: string;
  size?: number;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0, y: 20 }}
      whileInView={{ opacity: 1, scale: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay, type: 'spring', stiffness: 200 }}
      className={`relative ${className}`}
    >
      <div
        className={`rounded-full bg-gradient-to-br ${color} flex items-center justify-center text-white font-bold shadow-lg border-2 border-white`}
        style={{ width: size, height: size, fontSize: size * 0.35 }}
      >
        {name.split(' ').map(n => n[0]).join('')}
      </div>
      <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
    </motion.div>
  );
}

// Floating Avatars Group - Plays once
function FloatingAvatars({ className = '' }: { className?: string }) {
  const avatars = [
    { name: 'Sarah Chen', color: 'from-pink-400 to-rose-500' },
    { name: 'Alex Kim', color: 'from-blue-400 to-indigo-500' },
    { name: 'Jordan Lee', color: 'from-purple-400 to-violet-500' },
    { name: 'Taylor Swift', color: 'from-green-400 to-emerald-500' },
    { name: 'Morgan Davis', color: 'from-orange-400 to-amber-500' },
  ];

  return (
    <div className={`flex -space-x-3 ${className}`}>
      {avatars.map((avatar, i) => (
        <AnimatedAvatar
          key={i}
          name={avatar.name}
          color={avatar.color}
          size={40}
          delay={i * 0.1}
        />
      ))}
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 0.6 }}
        className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-100 text-gray-600 text-xs font-semibold border-2 border-white"
      >
        +2K
      </motion.div>
    </div>
  );
}

// 3D Floating Icon Component
function Floating3DIcon({
  icon: Icon,
  color,
  size = 60,
  delay = 0,
  rotateX = 15,
  rotateY = -15,
}: {
  icon: any;
  color: string;
  size?: number;
  delay?: number;
  rotateX?: number;
  rotateY?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 50, rotateX: 45, rotateY: -45 }}
      whileInView={{ opacity: 1, y: 0, rotateX, rotateY }}
      viewport={{ once: true }}
      transition={{ delay, duration: 0.8, type: 'spring' }}
      style={{ transformStyle: 'preserve-3d', perspective: 1000 }}
    >
      <motion.div
        animate={{
          y: [0, -15, 0],
          rotateY: [rotateY, rotateY + 10, rotateY],
          rotateX: [rotateX, rotateX - 5, rotateX],
        }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        className={`w-20 h-20 bg-gradient-to-br ${color} rounded-2xl flex items-center justify-center shadow-2xl`}
        style={{
          transformStyle: 'preserve-3d',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255,255,255,0.1) inset'
        }}
      >
        <Icon size={size * 0.5} className="text-white" style={{ transform: 'translateZ(20px)' }} />
      </motion.div>
    </motion.div>
  );
}

// 3D App Showcase Section with Parallax (plays once)
function App3DShowcase() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"]
  });

  // Parallax transforms for backward scrolling
  const logoY = useTransform(scrollYProgress, [0, 1], [50, -50]);
  const leftAppsX = useTransform(scrollYProgress, [0, 1], [-30, 30]);
  const rightAppsX = useTransform(scrollYProgress, [0, 1], [30, -30]);

  const apps = [
    { icon: Mail, color: 'from-red-400 to-rose-600', name: 'Mail', x: -200, y: -100, delay: 0, side: 'left' },
    { icon: Video, color: 'from-green-400 to-emerald-600', name: 'Meet', x: 200, y: -80, delay: 0.1, side: 'right' },
    { icon: FileText, color: 'from-blue-400 to-indigo-600', name: 'Docs', x: -180, y: 100, delay: 0.2, side: 'left' },
    { icon: Shield, color: 'from-purple-400 to-violet-600', name: 'Security', x: 180, y: 120, delay: 0.3, side: 'right' },
    { icon: Calendar, color: 'from-amber-400 to-orange-600', name: 'Calendar', x: 0, y: -150, delay: 0.4, side: 'center' },
    { icon: HardDrive, color: 'from-cyan-400 to-blue-600', name: 'Drive', x: 0, y: 150, delay: 0.5, side: 'center' },
  ];

  return (
    <div ref={ref} className="relative h-[500px] flex items-center justify-center">
      {/* Central Logo with Parallax */}
      <motion.div
        initial={{ opacity: 0, scale: 0 }}
        animate={isInView ? { opacity: 1, scale: 1 } : {}}
        transition={{ duration: 0.5, type: 'spring' }}
        style={{ y: logoY }}
        className="absolute z-10"
      >
        <div className="w-32 h-32 bg-gradient-to-br from-[#FFCCF2] via-[#977DFF] to-[#0033FF] rounded-3xl flex items-center justify-center shadow-2xl">
          <span className="text-white font-black text-5xl">B</span>
        </div>
      </motion.div>

      {/* Apps with Parallax */}
      {apps.map((app, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: 0, y: 0 }}
          animate={isInView ? {
            opacity: 1,
            x: app.x,
            y: app.y,
          } : {}}
          transition={{ delay: app.delay + 0.3, duration: 0.8, type: 'spring' }}
          style={{ x: app.side === 'left' ? leftAppsX : app.side === 'right' ? rightAppsX : undefined }}
          className="absolute"
        >
          <div className={`w-16 h-16 bg-gradient-to-br ${app.color} rounded-xl flex items-center justify-center shadow-xl`}>
            <app.icon size={28} className="text-white" />
          </div>
          <p className="text-center text-xs font-medium text-gray-600 mt-2">{app.name}</p>
        </motion.div>
      ))}

      {/* Connection Lines */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        <defs>
          <linearGradient id="line-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#FFCCF2" stopOpacity="0.3" />
            <stop offset="50%" stopColor="#977DFF" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#0033FF" stopOpacity="0.3" />
          </linearGradient>
        </defs>
        {apps.map((app, i) => (
          <motion.line
            key={i}
            x1="50%"
            y1="50%"
            x2={`calc(50% + ${app.x}px)`}
            y2={`calc(50% + ${app.y}px)`}
            stroke="url(#line-gradient)"
            strokeWidth="2"
            strokeDasharray="5,5"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={isInView ? { pathLength: 1, opacity: 1 } : {}}
            transition={{ delay: app.delay + 0.5, duration: 1 }}
          />
        ))}
      </svg>

      {/* Static Particles (no infinite animation) */}
      {[...Array(8)].map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, scale: 0 }}
          animate={isInView ? { opacity: 0.5, scale: 1 } : {}}
          transition={{ delay: 0.8 + i * 0.1 }}
          className="absolute w-2 h-2 rounded-full bg-gradient-to-r from-[#FFCCF2] to-[#977DFF]"
          style={{
            left: `${25 + (i * 7)}%`,
            top: `${20 + (i % 3) * 25}%`,
          }}
        />
      ))}
    </div>
  );
}

// Overlapping Cards Section
function OverlappingFeatureCards() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  const features = [
    {
      title: 'AI-Powered Email',
      description: 'Smart replies, auto-categorization, and priority inbox powered by AI.',
      icon: Mail,
      color: 'from-red-500 to-rose-600',
      mockup: (
        <div className="bg-white rounded-lg shadow-sm p-3 space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-600">JD</div>
            <div className="flex-1">
              <div className="text-xs font-semibold text-gray-800">John Doe</div>
              <div className="text-[10px] text-gray-500">Project Update - Q4 Goals</div>
            </div>
            <Bell size={12} className="text-[#977DFF]" />
          </div>
          <div className="bg-gradient-to-r from-[#977DFF]/10 to-[#0033FF]/10 rounded p-2">
            <div className="flex items-center gap-1 text-[10px] text-[#977DFF] font-medium">
              <Sparkles size={10} />
              AI Suggested Reply
            </div>
            <div className="text-[10px] text-gray-600 mt-1">Thanks for the update! I'll review the Q4 goals...</div>
          </div>
        </div>
      ),
    },
    {
      title: 'HD Video Meetings',
      description: 'Crystal clear calls with real-time transcription and AI summaries.',
      icon: Video,
      color: 'from-green-500 to-emerald-600',
      mockup: (
        <div className="bg-gray-900 rounded-lg p-3 relative overflow-hidden">
          <div className="grid grid-cols-2 gap-1">
            {[
              { name: 'You', color: 'from-blue-400 to-indigo-500' },
              { name: 'Sarah', color: 'from-pink-400 to-rose-500' },
              { name: 'Alex', color: 'from-green-400 to-emerald-500' },
              { name: 'Jordan', color: 'from-purple-400 to-violet-500' },
            ].map((p, i) => (
              <div key={i} className={`aspect-video bg-gradient-to-br ${p.color} rounded flex items-center justify-center`}>
                <span className="text-white text-[10px] font-medium">{p.name}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-center gap-2 mt-2">
            <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center">
              <Mic size={10} className="text-white" />
            </div>
            <div className="w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center">
              <Camera size={10} className="text-white" />
            </div>
            <div className="w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center">
              <Share2 size={10} className="text-white" />
            </div>
          </div>
        </div>
      ),
    },
    {
      title: 'Secure Cloud Storage',
      description: 'Enterprise-grade security with end-to-end encryption for all files.',
      icon: Shield,
      color: 'from-purple-500 to-violet-600',
      mockup: (
        <div className="bg-white rounded-lg shadow-sm p-3">
          <div className="flex items-center gap-2 mb-2">
            <FolderOpen size={14} className="text-[#977DFF]" />
            <span className="text-xs font-semibold text-gray-800">My Drive</span>
          </div>
          <div className="space-y-1.5">
            {[
              { name: 'Project Docs', icon: FileText, color: 'text-blue-500' },
              { name: 'Q4 Presentation', icon: Presentation, color: 'text-amber-500' },
              { name: 'Budget 2024.xlsx', icon: Table, color: 'text-green-500' },
            ].map((f, i) => (
              <div key={i} className="flex items-center gap-2 p-1.5 rounded hover:bg-gray-50">
                <f.icon size={12} className={f.color} />
                <span className="text-[10px] text-gray-700">{f.name}</span>
                <Lock size={8} className="text-green-500 ml-auto" />
              </div>
            ))}
          </div>
        </div>
      ),
    },
    {
      title: 'Smart Documents',
      description: 'Collaborative editing with AI writing assistance and templates.',
      icon: FileText,
      color: 'from-blue-500 to-indigo-600',
      mockup: (
        <div className="bg-white rounded-lg shadow-sm p-3">
          <div className="flex items-center gap-2 mb-2">
            <FileText size={14} className="text-blue-500" />
            <span className="text-xs font-semibold text-gray-800">Untitled Document</span>
            <div className="flex -space-x-1 ml-auto">
              {['from-pink-400 to-rose-500', 'from-blue-400 to-indigo-500'].map((c, i) => (
                <div key={i} className={`w-4 h-4 rounded-full bg-gradient-to-br ${c} border border-white`} />
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <div className="h-2 bg-gray-200 rounded w-3/4" />
            <div className="h-2 bg-gray-200 rounded w-full" />
            <div className="h-2 bg-gray-200 rounded w-5/6" />
          </div>
          <div className="mt-2 bg-gradient-to-r from-[#FFCCF2]/20 to-[#977DFF]/20 rounded p-1.5 flex items-center gap-1">
            <PenTool size={10} className="text-[#977DFF]" />
            <span className="text-[9px] text-[#977DFF]">AI is writing...</span>
          </div>
        </div>
      ),
    },
  ];

  return (
    <div ref={ref} className="relative">
      <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
        {features.map((feature, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 80, rotateX: 20 }}
            animate={isInView ? { opacity: 1, y: 0, rotateX: 0 } : {}}
            transition={{ delay: i * 0.15, duration: 0.6, type: 'spring' }}
            className="relative group"
            style={{ perspective: 1000 }}
          >
            {/* Main Card */}
            <div className="relative bg-white rounded-3xl border border-gray-100 p-6 lg:p-8 shadow-xl hover:shadow-2xl transition-all duration-300 overflow-hidden">
              {/* Gradient Background */}
              <div className={`absolute -top-20 -right-20 w-40 h-40 bg-gradient-to-br ${feature.color} rounded-full opacity-10 blur-3xl group-hover:opacity-20 transition-opacity`} />

              <div className="relative grid lg:grid-cols-2 gap-6 items-center">
                {/* Content */}
                <div>
                  <motion.div
                    whileHover={{ scale: 1.1, rotate: 5 }}
                    className={`w-14 h-14 bg-gradient-to-br ${feature.color} rounded-2xl flex items-center justify-center mb-4 shadow-lg`}
                  >
                    <feature.icon size={28} className="text-white" />
                  </motion.div>
                  <h3 className="text-xl lg:text-2xl font-bold text-gray-900 mb-2">{feature.title}</h3>
                  <p className="text-gray-600 mb-4">{feature.description}</p>
                  <Link href="/login?mode=signup" className="inline-flex items-center gap-2 text-[#977DFF] font-medium hover:gap-3 transition-all">
                    Learn more <ArrowRight size={16} />
                  </Link>
                </div>

                {/* Mockup */}
                <motion.div
                  initial={{ opacity: 0, x: 30 }}
                  animate={isInView ? { opacity: 1, x: 0 } : {}}
                  transition={{ delay: i * 0.15 + 0.3, duration: 0.5 }}
                  whileHover={{ scale: 1.02, y: -5 }}
                  className="relative"
                >
                  <div className="bg-gradient-to-br from-gray-100 to-gray-50 rounded-2xl p-4 shadow-inner">
                    {feature.mockup}
                  </div>
                </motion.div>
              </div>
            </div>

            {/* Overlapping Badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0, x: 20 }}
              animate={isInView ? { opacity: 1, scale: 1, x: 0 } : {}}
              transition={{ delay: i * 0.15 + 0.5, type: 'spring' }}
              className="absolute -top-3 -right-3 bg-gradient-to-r from-[#977DFF] to-[#0033FF] text-white text-xs font-semibold px-3 py-1.5 rounded-full shadow-lg"
            >
              AI-Powered
            </motion.div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// Testimonials with Avatars
function TestimonialsWithAvatars() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });

  const testimonials = [
    {
      quote: "Bheem has transformed how our team collaborates. The AI features save us hours every week.",
      author: "Sarah Chen",
      role: "CTO, TechStart Inc",
      color: 'from-pink-400 to-rose-500',
      rating: 5,
    },
    {
      quote: "Finally, a workspace that just works. No more switching between apps constantly.",
      author: "Michael Roberts",
      role: "Product Lead, Innovate Labs",
      color: 'from-blue-400 to-indigo-500',
      rating: 5,
    },
    {
      quote: "The meeting transcription alone is worth it. Game changer for our remote team.",
      author: "Emily Watson",
      role: "CEO, Growth Agency",
      color: 'from-green-400 to-emerald-500',
      rating: 5,
    },
    {
      quote: "Best investment we made this year. Our productivity metrics are through the roof.",
      author: "David Kim",
      role: "VP Operations, Scale Corp",
      color: 'from-purple-400 to-violet-500',
      rating: 5,
    },
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % testimonials.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [testimonials.length]);

  return (
    <div ref={ref} className="relative">
      {/* Background Avatars - Static after animation */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[
          { x: '10%', y: '20%', delay: 0 },
          { x: '85%', y: '15%', delay: 0.5 },
          { x: '5%', y: '70%', delay: 1 },
          { x: '90%', y: '75%', delay: 1.5 },
          { x: '50%', y: '5%', delay: 2 },
        ].map((pos, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0 }}
            animate={isInView ? { opacity: 0.3, scale: 1 } : {}}
            transition={{ delay: pos.delay, duration: 0.5 }}
            style={{ left: pos.x, top: pos.y }}
            className="absolute"
          >
            <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${testimonials[i % testimonials.length].color} opacity-30 blur-sm`} />
          </motion.div>
        ))}
      </div>

      <div className="relative max-w-4xl mx-auto text-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -30, scale: 0.95 }}
            transition={{ duration: 0.5 }}
          >
            <Quote size={48} className="mx-auto text-[#FFCCF2] mb-6" />

            {/* Stars */}
            <div className="flex justify-center gap-1 mb-6">
              {[...Array(testimonials[currentIndex].rating)].map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.1 }}
                >
                  <Star size={20} className="text-amber-400 fill-amber-400" />
                </motion.div>
              ))}
            </div>

            <p className="text-2xl lg:text-3xl font-medium text-gray-900 mb-8 leading-relaxed">
              "{testimonials[currentIndex].quote}"
            </p>

            <div className="flex items-center justify-center gap-4">
              <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${testimonials[currentIndex].color} flex items-center justify-center text-white font-bold text-xl shadow-lg`}>
                {testimonials[currentIndex].author.split(' ').map(n => n[0]).join('')}
              </div>
              <div className="text-left">
                <div className="font-semibold text-gray-900 text-lg">{testimonials[currentIndex].author}</div>
                <div className="text-gray-500">{testimonials[currentIndex].role}</div>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex justify-center gap-2 mt-10">
          {testimonials.map((t, i) => (
            <button
              key={i}
              onClick={() => setCurrentIndex(i)}
              className="relative"
            >
              <motion.div
                animate={i === currentIndex ? { scale: 1.2 } : { scale: 1 }}
                className={`w-10 h-10 rounded-full bg-gradient-to-br ${t.color} ${i === currentIndex ? 'opacity-100' : 'opacity-30'} transition-opacity`}
              />
              {i === currentIndex && (
                <motion.div
                  layoutId="testimonial-indicator"
                  className="absolute inset-0 rounded-full border-2 border-[#977DFF]"
                />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// Stats with Animation
function AnimatedStats() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });

  const stats = [
    { value: '50K+', label: 'Active Teams', icon: Users, color: 'from-blue-400 to-indigo-500' },
    { value: '99.9%', label: 'Uptime SLA', icon: Award, color: 'from-green-400 to-emerald-500' },
    { value: '47%', label: 'Productivity Boost', icon: TrendingUp, color: 'from-purple-400 to-violet-500' },
    { value: '12hrs', label: 'Saved Weekly', icon: Clock, color: 'from-amber-400 to-orange-500' },
  ];

  return (
    <div ref={ref} className="relative">
      {/* Floating Avatars around stats */}
      <div className="absolute -top-10 left-[10%]">
        <AnimatedAvatar name="Alex Kim" color="from-blue-400 to-indigo-500" size={36} delay={0.2} />
      </div>
      <div className="absolute -top-5 right-[15%]">
        <AnimatedAvatar name="Sarah Chen" color="from-pink-400 to-rose-500" size={32} delay={0.4} />
      </div>
      <div className="absolute -bottom-8 left-[20%]">
        <AnimatedAvatar name="Jordan Lee" color="from-green-400 to-emerald-500" size={40} delay={0.6} />
      </div>
      <div className="absolute -bottom-5 right-[10%]">
        <AnimatedAvatar name="Taylor Swift" color="from-purple-400 to-violet-500" size={34} delay={0.8} />
      </div>

      <div className="bg-gradient-to-r from-[#977DFF]/5 via-white to-[#FFCCF2]/5 rounded-3xl border border-gray-100 p-8 lg:p-12 shadow-xl relative overflow-hidden">
        {/* Background Gradient Orbs */}
        <div className="absolute -top-20 -left-20 w-40 h-40 bg-[#FFCCF2]/30 rounded-full blur-3xl" />
        <div className="absolute -bottom-20 -right-20 w-40 h-40 bg-[#977DFF]/30 rounded-full blur-3xl" />

        <div className="relative grid grid-cols-2 lg:grid-cols-4 gap-8">
          {stats.map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30, scale: 0.9 }}
              animate={isInView ? { opacity: 1, y: 0, scale: 1 } : {}}
              transition={{ delay: i * 0.15, duration: 0.5, type: 'spring' }}
              className="text-center group"
            >
              <motion.div
                whileHover={{ scale: 1.1, rotate: 5 }}
                className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br ${stat.color} mb-4 shadow-lg`}
              >
                <stat.icon size={32} className="text-white" />
              </motion.div>
              <motion.div
                initial={{ opacity: 0 }}
                animate={isInView ? { opacity: 1 } : {}}
                transition={{ delay: i * 0.15 + 0.3 }}
                className="text-4xl lg:text-5xl font-bold mb-1 bg-gradient-to-r from-[#977DFF] to-[#0033FF] bg-clip-text text-transparent"
              >
                {stat.value}
              </motion.div>
              <div className="text-sm text-gray-500 font-medium">{stat.label}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Pricing Cards with 3D
function Pricing3DCards() {
  const [loading, setLoading] = useState<string | null>(null);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });

  const plans = [
    {
      id: 'WORKSPACE-STARTER',
      name: 'Starter',
      description: 'Perfect for small teams',
      price: '999',
      period: '/user/month',
      features: ['All Bheem Apps', '50 AI actions/month', '10 GB storage', 'Custom domain', 'Email support'],
      color: 'from-[#0033FF] to-[#0600AB]',
    },
    {
      id: 'WORKSPACE-PROFESSIONAL',
      name: 'Professional',
      description: 'For growing businesses',
      price: '2,499',
      period: '/user/month',
      features: ['Everything in Starter', 'Unlimited AI actions', '100 GB storage', 'Advanced analytics', 'Priority support', 'API access'],
      popular: true,
      color: 'from-[#977DFF] to-[#0033FF]',
    },
    {
      id: 'WORKSPACE-ENTERPRISE',
      name: 'Enterprise',
      description: 'For large organizations',
      price: 'Custom',
      period: '',
      features: ['Everything in Pro', 'Unlimited storage', 'Self-hosted option', 'White-label branding', 'Dedicated support', 'Custom integrations'],
      isEnterprise: true,
      color: 'from-[#FFCCF2] to-[#977DFF]',
    }
  ];

  return (
    <div ref={ref} className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
      {plans.map((plan, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 50, rotateX: 20 }}
          animate={isInView ? { opacity: 1, y: 0, rotateX: 0 } : {}}
          transition={{ delay: i * 0.15, duration: 0.6, type: 'spring' }}
          whileHover={{ y: -10, scale: 1.02 }}
          style={{ perspective: 1000 }}
          className="relative"
        >
          {plan.popular && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: i * 0.15 + 0.3 }}
              className="absolute -top-4 left-1/2 -translate-x-1/2 z-10"
            >
              <div className="bg-gradient-to-r from-[#977DFF] to-[#0033FF] text-white px-4 py-1.5 rounded-full text-sm font-semibold shadow-lg">
                Most Popular
              </div>
            </motion.div>
          )}

          <div className={`relative bg-white rounded-3xl border p-8 h-full transition-all ${
            plan.popular ? 'border-[#977DFF] shadow-xl shadow-purple-500/20' : 'border-gray-200 hover:border-[#977DFF]/50 hover:shadow-lg'
          }`}>
            {/* Gradient Background */}
            <div className={`absolute -top-10 -right-10 w-32 h-32 bg-gradient-to-br ${plan.color} rounded-full opacity-10 blur-3xl`} />

            <div className="relative">
              <h3 className="text-xl font-bold text-gray-900 mb-1">{plan.name}</h3>
              <p className="text-sm text-gray-500 mb-4">{plan.description}</p>
              <div className="mb-6">
                <span className="text-4xl font-bold text-gray-900">{plan.price === 'Custom' ? '' : '₹'}{plan.price}</span>
                <span className="text-gray-500 text-sm">{plan.period}</span>
              </div>
              <ul className="space-y-3 mb-8">
                {plan.features.map((feature, j) => (
                  <motion.li
                    key={j}
                    initial={{ opacity: 0, x: -20 }}
                    animate={isInView ? { opacity: 1, x: 0 } : {}}
                    transition={{ delay: i * 0.15 + j * 0.05 + 0.3 }}
                    className="flex items-start gap-3 text-sm"
                  >
                    <CheckCircle2 size={18} className="text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-600">{feature}</span>
                  </motion.li>
                ))}
              </ul>
              {plan.isEnterprise ? (
                <a href="mailto:sales@bheem.cloud" className="block w-full text-center py-3.5 rounded-xl font-semibold border-2 border-gray-200 text-gray-700 hover:border-[#977DFF] hover:bg-[#977DFF]/5 transition-all">
                  Contact sales
                </a>
              ) : (
                <button
                  disabled={loading === plan.id}
                  className={`w-full py-3.5 rounded-xl font-semibold transition-all disabled:opacity-50 ${
                    plan.popular ? 'bg-gradient-to-r from-[#977DFF] to-[#0033FF] text-white hover:shadow-lg hover:shadow-purple-500/25' : 'border-2 border-gray-200 text-gray-700 hover:border-[#977DFF] hover:bg-[#977DFF]/5'
                  }`}
                >
                  {loading === plan.id ? 'Processing...' : 'Get started'}
                </button>
              )}
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

// Combined Hero Visual - Animation + Dashboard Mockup with Parallax (plays once)
function HeroVisualSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"]
  });

  // Parallax transforms - backward scrolling effect
  const imageY = useTransform(scrollYProgress, [0, 1], [100, -100]);
  const floatY1 = useTransform(scrollYProgress, [0, 1], [50, -150]);
  const floatY2 = useTransform(scrollYProgress, [0, 1], [-50, 150]);
  const rotateZ = useTransform(scrollYProgress, [0, 1], [0, 10]);

  const apps = [
    { icon: Mail, color: 'from-red-400 to-rose-600', name: 'Mail', x: -140, y: -100 },
    { icon: Video, color: 'from-green-400 to-emerald-600', name: 'Meet', x: 150, y: -80 },
    { icon: FileText, color: 'from-blue-400 to-indigo-600', name: 'Docs', x: -130, y: 100 },
    { icon: Shield, color: 'from-purple-400 to-violet-600', name: 'Security', x: 140, y: 90 },
    { icon: Calendar, color: 'from-amber-400 to-orange-600', name: 'Calendar', x: 0, y: -140 },
    { icon: HardDrive, color: 'from-cyan-400 to-blue-600', name: 'Drive', x: 0, y: 140 },
  ];

  // Orbiting dots positions
  const orbitDots = [
    { angle: 0, radius: 220, color: '#FFCCF2', size: 8 },
    { angle: 60, radius: 200, color: '#977DFF', size: 6 },
    { angle: 120, radius: 220, color: '#0033FF', size: 10 },
    { angle: 180, radius: 200, color: '#FFCCF2', size: 6 },
    { angle: 240, radius: 220, color: '#977DFF', size: 8 },
    { angle: 300, radius: 200, color: '#0033FF', size: 6 },
  ];

  return (
    <div ref={ref} className="relative w-full h-[550px] flex items-center justify-center">
      {/* Animated Background Gradient - plays once */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={isInView ? { opacity: 0.15, scale: 1 } : {}}
        transition={{ duration: 1.5 }}
        className="absolute w-[450px] h-[450px] rounded-full"
        style={{
          background: 'conic-gradient(from 0deg, #FFCCF2, #977DFF, #0033FF, #977DFF, #FFCCF2)',
          filter: 'blur(80px)',
        }}
      />

      {/* Animated Outer Ring - Rotates slowly */}
      <motion.div
        initial={{ opacity: 0, scale: 0, rotate: -180 }}
        animate={isInView ? { opacity: 1, scale: 1, rotate: 0 } : {}}
        transition={{ duration: 1.2, delay: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="absolute w-[420px] h-[420px]"
      >
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 40, repeat: Infinity, ease: 'linear' }}
          className="w-full h-full rounded-full border-2 border-dashed border-[#977DFF]/30"
        />
      </motion.div>

      {/* Animated Middle Ring - Rotates opposite */}
      <motion.div
        initial={{ opacity: 0, scale: 0, rotate: 180 }}
        animate={isInView ? { opacity: 1, scale: 1, rotate: 0 } : {}}
        transition={{ duration: 1, delay: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="absolute w-[340px] h-[340px]"
      >
        <motion.div
          animate={{ rotate: -360 }}
          transition={{ duration: 35, repeat: Infinity, ease: 'linear' }}
          className="w-full h-full rounded-full border border-[#0033FF]/20"
        />
      </motion.div>

      {/* Inner Glow Ring - Rotates */}
      <motion.div
        initial={{ opacity: 0, scale: 0 }}
        animate={isInView ? { opacity: 0.5, scale: 1 } : {}}
        transition={{ duration: 0.8, delay: 0.5 }}
        className="absolute w-[260px] h-[260px]"
      >
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
          className="w-full h-full rounded-full border-2 border-[#FFCCF2]/40"
        />
      </motion.div>

      {/* Orbiting Dots Container - Rotates in opposite direction */}
      <motion.div
        initial={{ opacity: 0, scale: 0 }}
        animate={isInView ? { opacity: 1, scale: 1 } : {}}
        transition={{ duration: 0.8, delay: 0.6 }}
        className="absolute w-[460px] h-[460px] z-5"
      >
        <motion.div
          animate={{ rotate: -360 }}
          transition={{ duration: 25, repeat: Infinity, ease: 'linear' }}
          className="relative w-full h-full"
        >
          {orbitDots.map((dot, i) => {
            const x = Math.round(Math.cos((dot.angle * Math.PI) / 180) * dot.radius * 100) / 100;
            const y = Math.round(Math.sin((dot.angle * Math.PI) / 180) * dot.radius * 100) / 100;
            return (
              <motion.div
                key={`orbit-${i}`}
                initial={{ opacity: 0, scale: 0 }}
                animate={isInView ? { opacity: 1, scale: 1 } : {}}
                transition={{ delay: 0.8 + i * 0.1, duration: 0.5, type: 'spring' }}
                className="absolute"
                style={{
                  left: `calc(50% + ${x}px - ${dot.size / 2}px)`,
                  top: `calc(50% + ${y}px - ${dot.size / 2}px)`,
                  width: dot.size,
                  height: dot.size,
                }}
              >
                <div
                  className="w-full h-full rounded-full"
                  style={{ backgroundColor: dot.color, boxShadow: `0 0 ${dot.size * 2}px ${dot.color}` }}
                />
              </motion.div>
            );
          })}
        </motion.div>
      </motion.div>

      {/* Animated Sparkles/Particles around image */}
      {[...Array(8)].map((_, i) => {
        const angle = (i * 45) * (Math.PI / 180);
        const radius = 180 + (i % 2) * 40;
        const sparkleX = Math.round(Math.cos(angle) * radius * 100) / 100;
        const sparkleY = Math.round(Math.sin(angle) * radius * 100) / 100;
        return (
          <motion.div
            key={`sparkle-${i}`}
            initial={{ opacity: 0, scale: 0 }}
            animate={isInView ? {
              opacity: [0, 0.8, 0.4],
              scale: [0, 1.2, 1],
            } : {}}
            transition={{ delay: 1 + i * 0.15, duration: 0.8 }}
            className="absolute"
            style={{
              left: `calc(50% + ${sparkleX}px)`,
              top: `calc(50% + ${sparkleY}px)`,
            }}
          >
            <Sparkles size={12 + (i % 3) * 4} className="text-[#977DFF]" style={{ opacity: 0.6 }} />
          </motion.div>
        );
      })}

      {/* Central Dashboard Mockup with Parallax */}
      <motion.div
        initial={{ opacity: 0, y: 60, scale: 0.85 }}
        animate={isInView ? { opacity: 1, y: 0, scale: 1 } : {}}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        style={{ y: imageY }}
        className="relative z-10"
      >
        {/* Browser Window Mockup */}
        <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden w-[320px] lg:w-[380px]">
          {/* Browser Header */}
          <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-200">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
              <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
            </div>
            <div className="flex-1 mx-3">
              <div className="bg-gray-200 rounded-md px-2 py-1 text-[10px] text-gray-500 text-center">
                bheem.cloud/dashboard
              </div>
            </div>
          </div>

          {/* Dashboard Content */}
          <div className="p-3 bg-gradient-to-b from-gray-50 to-white">
            {/* Top Bar */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-gradient-to-br from-[#FFCCF2] via-[#977DFF] to-[#0033FF] rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-xs">B</span>
                </div>
                <span className="font-semibold text-gray-800 text-xs">Bheem Workspace</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Bell size={12} className="text-gray-400" />
                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500" />
              </div>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-3 gap-1.5 mb-3">
              {[
                { label: 'Emails', value: '24', color: 'text-red-500', bg: 'bg-red-50' },
                { label: 'Meetings', value: '3', color: 'text-green-500', bg: 'bg-green-50' },
                { label: 'Tasks', value: '12', color: 'text-blue-500', bg: 'bg-blue-50' },
              ].map((stat, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={isInView ? { opacity: 1, y: 0 } : {}}
                  transition={{ delay: 0.6 + i * 0.1 }}
                  className={`${stat.bg} rounded-lg p-2 text-center`}
                >
                  <div className={`text-base font-bold ${stat.color}`}>{stat.value}</div>
                  <div className="text-[9px] text-gray-500">{stat.label}</div>
                </motion.div>
              ))}
            </div>

            {/* Recent Items */}
            <div className="bg-white rounded-lg p-2 border border-gray-100">
              <div className="text-[10px] font-semibold text-gray-600 mb-1.5">Recent Documents</div>
              {[
                { icon: FileText, name: 'Project Proposal.doc', color: 'text-blue-500' },
                { icon: Table, name: 'Q4 Budget.xlsx', color: 'text-green-500' },
              ].map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={isInView ? { opacity: 1, x: 0 } : {}}
                  transition={{ delay: 0.9 + i * 0.1 }}
                  className="flex items-center gap-2 py-1 text-[10px] text-gray-600"
                >
                  <item.icon size={10} className={item.color} />
                  {item.name}
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Orbiting App Icons Container - Rotates around dashboard */}
      <motion.div
        initial={{ opacity: 0, scale: 0.5, rotate: -180 }}
        animate={isInView ? {
          opacity: 1,
          scale: 1,
          rotate: 0,
        } : {}}
        transition={{ duration: 1.2, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="absolute w-[400px] h-[400px] z-20"
        style={{ transformOrigin: 'center center' }}
      >
        {/* Continuous rotation wrapper */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
          className="relative w-full h-full"
        >
          {apps.map((app, i) => {
            const angle = (i * 60) * (Math.PI / 180); // 6 apps, 60 degrees apart
            const radius = 180;
            const x = Math.round(Math.cos(angle) * radius * 100) / 100;
            const y = Math.round(Math.sin(angle) * radius * 100) / 100;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0 }}
                animate={isInView ? { opacity: 1, scale: 1 } : {}}
                transition={{ delay: 0.5 + i * 0.1, duration: 0.5, type: 'spring' }}
                className="absolute"
                style={{
                  left: `calc(50% + ${x}px - 24px)`,
                  top: `calc(50% + ${y}px - 24px)`,
                }}
              >
                {/* Counter-rotate to keep icons upright */}
                <motion.div
                  animate={{ rotate: -360 }}
                  transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
                >
                  <div className={`w-12 h-12 bg-gradient-to-br ${app.color} rounded-xl flex items-center justify-center shadow-xl border-2 border-white hover:scale-110 transition-transform cursor-pointer`}>
                    <app.icon size={22} className="text-white" />
                  </div>
                  <p className="text-center text-[10px] font-medium text-gray-600 mt-1">{app.name}</p>
                </motion.div>
              </motion.div>
            );
          })}
        </motion.div>
      </motion.div>

      {/* Floating Images/Screenshots with backward parallax */}
      <motion.div
        initial={{ opacity: 0, x: -100, rotate: -10 }}
        animate={isInView ? { opacity: 1, x: 0, rotate: -5 } : {}}
        transition={{ delay: 0.8, duration: 0.8 }}
        style={{ y: floatY2, rotate: rotateZ }}
        className="absolute -left-10 top-10 z-5"
      >
        <div className="w-32 h-24 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden">
          <div className="h-full bg-gradient-to-br from-red-50 to-red-100 p-2">
            <div className="flex items-center gap-1 mb-1">
              <Mail size={10} className="text-red-500" />
              <span className="text-[8px] font-semibold text-red-700">Inbox</span>
            </div>
            <div className="space-y-1">
              <div className="h-2 bg-red-200/50 rounded w-full" />
              <div className="h-2 bg-red-200/50 rounded w-3/4" />
              <div className="h-2 bg-red-200/50 rounded w-5/6" />
            </div>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, x: 100, rotate: 10 }}
        animate={isInView ? { opacity: 1, x: 0, rotate: 5 } : {}}
        transition={{ delay: 0.9, duration: 0.8 }}
        style={{ y: floatY1 }}
        className="absolute -right-10 bottom-20 z-5"
      >
        <div className="w-32 h-24 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden">
          <div className="h-full bg-gradient-to-br from-green-50 to-green-100 p-2">
            <div className="flex items-center gap-1 mb-1">
              <Video size={10} className="text-green-500" />
              <span className="text-[8px] font-semibold text-green-700">Meeting</span>
            </div>
            <div className="grid grid-cols-2 gap-1">
              <div className="aspect-video bg-green-200/50 rounded" />
              <div className="aspect-video bg-green-200/50 rounded" />
              <div className="aspect-video bg-green-200/50 rounded" />
              <div className="aspect-video bg-green-200/50 rounded" />
            </div>
          </div>
        </div>
      </motion.div>

      {/* Animated Connection Lines SVG */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" style={{ overflow: 'visible' }}>
        <defs>
          <linearGradient id="hero-connection-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFCCF2" stopOpacity="0.6" />
            <stop offset="50%" stopColor="#977DFF" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#0033FF" stopOpacity="0.6" />
          </linearGradient>
        </defs>
        {/* Curved connection lines */}
        {[
          { d: 'M 50 250 Q 0 200, -60 180', delay: 1 },
          { d: 'M 330 250 Q 380 200, 440 180', delay: 1.1 },
          { d: 'M 50 300 Q -20 350, -60 380', delay: 1.2 },
          { d: 'M 330 300 Q 380 350, 440 380', delay: 1.3 },
        ].map((line, i) => (
          <motion.path
            key={i}
            d={line.d}
            fill="none"
            stroke="url(#hero-connection-gradient)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray="8,8"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={isInView ? { pathLength: 1, opacity: 0.5 } : {}}
            transition={{ delay: line.delay, duration: 0.8 }}
          />
        ))}
      </svg>

      {/* Pulsing Glow Effects */}
      <motion.div
        initial={{ opacity: 0, scale: 0.5 }}
        animate={isInView ? { opacity: [0, 0.6, 0.3], scale: [0.5, 1.2, 1] } : {}}
        transition={{ delay: 1.5, duration: 1.2 }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(151,125,255,0.2) 0%, transparent 70%)',
        }}
      />

      {/* Decorative Gradient Blurs */}
      <motion.div
        initial={{ opacity: 0, scale: 0, x: 50 }}
        animate={isInView ? { opacity: 0.5, scale: 1, x: 0 } : {}}
        transition={{ delay: 1.2, duration: 0.8 }}
        className="absolute -top-16 -right-16 w-40 h-40 bg-gradient-to-br from-[#FFCCF2] to-[#977DFF] rounded-full blur-3xl"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0, x: -50 }}
        animate={isInView ? { opacity: 0.4, scale: 1, x: 0 } : {}}
        transition={{ delay: 1.4, duration: 0.8 }}
        className="absolute -bottom-16 -left-16 w-48 h-48 bg-gradient-to-br from-[#977DFF] to-[#0033FF] rounded-full blur-3xl"
      />

      {/* Floating Mini Icons around edges */}
      {[
        { icon: Sparkles, x: -180, y: -20, delay: 1.6, color: 'text-[#FFCCF2]' },
        { icon: Zap, x: 180, y: 30, delay: 1.7, color: 'text-[#977DFF]' },
        { icon: Star, x: -160, y: 140, delay: 1.8, color: 'text-[#0033FF]' },
        { icon: Globe, x: 170, y: -120, delay: 1.9, color: 'text-[#977DFF]' },
      ].map((item, i) => (
        <motion.div
          key={`mini-icon-${i}`}
          initial={{ opacity: 0, scale: 0, x: 0, y: 0 }}
          animate={isInView ? { opacity: 0.7, scale: 1, x: item.x, y: item.y } : {}}
          transition={{ delay: item.delay, duration: 0.5, type: 'spring' }}
          className="absolute z-10"
        >
          <item.icon size={16} className={item.color} />
        </motion.div>
      ))}
    </div>
  );
}

// Hero Section with Fade Out on Scroll (Subtle luxury feel)
function HeroWithFade({ children }: { children: React.ReactNode }) {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"]
  });

  const opacity = useTransform(scrollYProgress, [0, 0.6], [1, 0]);
  const y = useTransform(scrollYProgress, [0, 0.6], [0, -30]);

  return (
    <motion.section
      ref={ref}
      style={{ opacity, y }}
      className="relative z-10 pt-28 pb-16 lg:pt-36 lg:pb-24 overflow-hidden min-h-screen flex items-center bg-white"
    >
      {children}
    </motion.section>
  );
}

// Reusable Fade Animations (Subtle 20-30px movement)
const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }
};

const fadeLeft = {
  initial: { opacity: 0, x: -24 },
  whileInView: { opacity: 1, x: 0 },
  viewport: { once: true },
  transition: { duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }
};

const fadeRight = {
  initial: { opacity: 0, x: 24 },
  whileInView: { opacity: 1, x: 0 },
  viewport: { once: true },
  transition: { duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }
};

const staggerContainer = {
  initial: {},
  whileInView: { transition: { staggerChildren: 0.1 } },
  viewport: { once: true }
};

const staggerItem = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }
};

// Text Reveal Animation Component (Luxury Trend)
function TextReveal({ text, className = '', delay = 0 }: { text: string; className?: string; delay?: number }) {
  const words = text.split(' ');

  return (
    <span className={className}>
      {words.map((word, i) => (
        <span key={i} className="inline-block overflow-hidden mr-[0.25em]">
          <motion.span
            initial={{ y: '100%', opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
            transition={{
              duration: 0.5,
              delay: delay + i * 0.08,
              ease: [0.25, 0.46, 0.45, 0.94]
            }}
            className="inline-block"
          >
            {word}
          </motion.span>
        </span>
      ))}
    </span>
  );
}

// Line by Line Text Reveal
function LineReveal({ children, className = '', delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  return (
    <div className="overflow-hidden">
      <motion.div
        initial={{ y: '100%', opacity: 0 }}
        whileInView={{ y: 0, opacity: 1 }}
        viewport={{ once: true }}
        transition={{
          duration: 0.6,
          delay,
          ease: [0.25, 0.46, 0.45, 0.94]
        }}
        className={className}
      >
        {children}
      </motion.div>
    </div>
  );
}

// ============================================
// CAROUSEL COMPONENTS - Like Meet Features
// ============================================

// Carousel Avatars for animations
const carouselAvatars = [
  { name: 'Alex', color: 'from-pink-400 to-rose-500', initials: 'A' },
  { name: 'Jordan', color: 'from-blue-400 to-indigo-500', initials: 'J' },
  { name: 'Sam', color: 'from-green-400 to-emerald-500', initials: 'S' },
  { name: 'Taylor', color: 'from-purple-400 to-violet-500', initials: 'T' },
  { name: 'Morgan', color: 'from-orange-400 to-amber-500', initials: 'M' },
];

// Animated Illustration for Carousels
function CarouselIllustration({ icon: Icon, color, isActive }: { icon: any; color: string; isActive: boolean }) {
  return (
    <div className="relative w-full h-64 lg:h-80 flex items-center justify-center overflow-hidden">
      {/* Background glow */}
      <motion.div
        className={`absolute w-48 h-48 lg:w-64 lg:h-64 rounded-full bg-gradient-to-br ${color} opacity-20 blur-3xl`}
        animate={isActive ? { scale: [1, 1.2, 1], rotate: [0, 180, 360] } : {}}
        transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
      />

      {/* Floating avatars */}
      {carouselAvatars.map((avatar, i) => {
        const angle = (i * 72) * (Math.PI / 180);
        const radius = 100;
        const x = Math.round(Math.cos(angle) * radius * 100) / 100;
        const y = Math.round(Math.sin(angle) * radius * 100) / 100;

        return (
          <motion.div
            key={avatar.name}
            className="absolute z-20"
            initial={{ opacity: 0, scale: 0 }}
            animate={isActive ? {
              opacity: 1, scale: 1,
              x: [x, x + (i % 2 === 0 ? 8 : -8), x],
              y: [y, y - 10, y],
            } : { opacity: 0, scale: 0 }}
            transition={{
              opacity: { duration: 0.5, delay: i * 0.1 },
              scale: { duration: 0.5, delay: i * 0.1 },
              x: { duration: 3, repeat: Infinity, ease: 'easeInOut', delay: i * 0.2 },
              y: { duration: 2, repeat: Infinity, ease: 'easeInOut', delay: i * 0.3 },
            }}
          >
            <motion.div
              className={`w-12 h-12 lg:w-14 lg:h-14 rounded-full bg-gradient-to-br ${avatar.color} flex items-center justify-center text-white font-bold shadow-lg border-2 border-white`}
              whileHover={{ scale: 1.2 }}
            >
              {avatar.initials}
            </motion.div>
            <motion.div
              className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-white"
              animate={isActive ? { scale: [1, 1.2, 1] } : {}}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
          </motion.div>
        );
      })}

      {/* Floating particles */}
      {[...Array(6)].map((_, i) => (
        <motion.div
          key={i}
          className={`absolute w-3 h-3 rounded-full bg-gradient-to-br ${color}`}
          animate={isActive ? {
            opacity: [0, 1, 0],
            x: [0, (i % 2 === 0 ? 1 : -1) * (40 + i * 10)],
            y: [0, -60 - i * 10],
            scale: [0, 1, 0],
          } : { opacity: 0 }}
          transition={{ duration: 2, delay: i * 0.3, repeat: Infinity, repeatDelay: 1 }}
          style={{ left: `${40 + i * 5}%`, top: '60%' }}
        />
      ))}

      {/* Main icon */}
      <motion.div
        className={`relative z-10 w-24 h-24 lg:w-32 lg:h-32 rounded-3xl bg-gradient-to-br ${color} flex items-center justify-center shadow-2xl`}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={isActive ? { scale: 1, opacity: 1, y: [0, -10, 0] } : { scale: 0.8, opacity: 0 }}
        transition={{ scale: { duration: 0.5 }, y: { duration: 3, repeat: Infinity, ease: 'easeInOut' } }}
      >
        <Icon size={48} className="text-white lg:w-16 lg:h-16" />
        <motion.div
          className="absolute inset-0 rounded-3xl bg-gradient-to-tr from-white/0 via-white/30 to-white/0"
          animate={isActive ? { x: ['-100%', '100%'] } : {}}
          transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
        />
      </motion.div>

      {/* Connection lines SVG */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 5 }}>
        {carouselAvatars.map((_, i) => {
          const angle = (i * 72) * (Math.PI / 180);
          const radius = 100;
          const x = Math.round((Math.cos(angle) * radius + 50) * 100) / 100;
          const y = Math.round((Math.sin(angle) * radius + 50) * 100) / 100;
          return (
            <motion.line
              key={`line-${i}`}
              x1="50%" y1="50%" x2={`${x}%`} y2={`${y}%`}
              stroke="url(#carousel-gradient)"
              strokeWidth="1"
              strokeDasharray="4 4"
              initial={{ opacity: 0 }}
              animate={isActive ? { opacity: [0.2, 0.5, 0.2], strokeDashoffset: [0, 8] } : { opacity: 0 }}
              transition={{ opacity: { duration: 2, repeat: Infinity }, strokeDashoffset: { duration: 1, repeat: Infinity, ease: 'linear' } }}
            />
          );
        })}
        <defs>
          <linearGradient id="carousel-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#977DFF" />
            <stop offset="100%" stopColor="#0033FF" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

// Features Showcase Carousel
function FeaturesShowcase() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0);

  const features = [
    { id: 1, title: 'Everything Connected', description: 'All your productivity tools work seamlessly together. No more switching between apps or losing context.', icon: Puzzle, color: 'from-[#FFCCF2] via-[#977DFF] to-[#0033FF]' },
    { id: 2, title: 'AI-Powered Automation', description: 'Let AI handle repetitive tasks while you focus on what matters. Smart suggestions and auto-completions everywhere.', icon: Bot, color: 'from-[#977DFF] to-[#0033FF]' },
    { id: 3, title: 'Real-time Sync', description: 'Changes sync instantly across all devices. Your team always has the latest version, no matter where they are.', icon: Zap, color: 'from-[#0033FF] to-[#977DFF]' },
    { id: 4, title: 'Enterprise Security', description: 'Bank-level encryption and compliance. Your data is protected with the highest security standards.', icon: Shield, color: 'from-[#977DFF] to-[#FFCCF2]' },
  ];

  const highlights = [
    { icon: Zap, text: 'Real-time sync across all apps' },
    { icon: Bot, text: 'AI-powered smart suggestions' },
    { icon: Globe, text: 'Access from any device' },
    { icon: Lock, text: 'Enterprise-grade security' },
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setDirection(1);
      setCurrentIndex((prev) => (prev + 1) % features.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [features.length]);

  const goToSlide = (index: number) => {
    setDirection(index > currentIndex ? 1 : -1);
    setCurrentIndex(index);
  };

  const slideVariants = {
    enter: (direction: number) => ({ x: direction > 0 ? 300 : -300, opacity: 0, scale: 0.9 }),
    center: { x: 0, opacity: 1, scale: 1 },
    exit: (direction: number) => ({ x: direction < 0 ? 300 : -300, opacity: 0, scale: 0.9 }),
  };

  const current = features[currentIndex];

  return (
    <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
      {/* Left Side - Static Content with Animations */}
      <div className="relative">
        {/* Floating decorative elements */}
        <motion.div
          animate={{ y: [0, -10, 0], rotate: [0, 5, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -top-8 -left-8 w-20 h-20 bg-gradient-to-br from-[#FFCCF2]/30 to-[#977DFF]/30 rounded-2xl blur-xl"
        />
        <motion.div
          animate={{ y: [0, 10, 0], rotate: [0, -5, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
          className="absolute -bottom-8 -right-8 w-24 h-24 bg-gradient-to-br from-[#977DFF]/30 to-[#0033FF]/30 rounded-2xl blur-xl"
        />

        <div className="relative">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-[#FFCCF2]/20 to-[#977DFF]/20 border border-[#977DFF]/20 text-[#977DFF] text-sm font-medium mb-6">
              <motion.span animate={{ rotate: [0, 360] }} transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}>
                <Sparkles size={16} />
              </motion.span>
              Integrated Ecosystem
            </span>
          </motion.div>

          {/* Main Heading */}
          <motion.h2
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-4xl lg:text-6xl font-bold text-gray-900 mb-6 leading-tight"
          >
            Everything{' '}
            <span className="relative inline-block">
              <span className="bg-gradient-to-r from-[#FFCCF2] via-[#977DFF] to-[#0033FF] bg-clip-text text-transparent">
                connected
              </span>
              <motion.svg
                className="absolute -bottom-2 left-0 w-full"
                viewBox="0 0 200 8"
                initial={{ pathLength: 0, opacity: 0 }}
                whileInView={{ pathLength: 1, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 1, delay: 0.5 }}
              >
                <motion.path
                  d="M0 4 Q50 0, 100 4 T200 4"
                  fill="none"
                  stroke="url(#ecosystem-underline)"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
                <defs>
                  <linearGradient id="ecosystem-underline" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#FFCCF2" />
                    <stop offset="50%" stopColor="#977DFF" />
                    <stop offset="100%" stopColor="#0033FF" />
                  </linearGradient>
                </defs>
              </motion.svg>
            </span>
          </motion.h2>

          {/* Description */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-lg lg:text-xl text-gray-600 mb-8 leading-relaxed"
          >
            All your productivity tools work seamlessly together. No more switching between apps or losing context. One platform, infinite possibilities.
          </motion.p>

          {/* Highlight Features */}
          <div className="grid grid-cols-2 gap-4 mb-10">
            {highlights.map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: 0.3 + i * 0.1 }}
                whileHover={{ x: 5, scale: 1.02 }}
                className="flex items-center gap-3 group cursor-pointer"
              >
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#FFCCF2]/20 to-[#977DFF]/20 flex items-center justify-center group-hover:from-[#FFCCF2]/40 group-hover:to-[#977DFF]/40 transition-all">
                  <item.icon size={18} className="text-[#977DFF]" />
                </div>
                <span className="text-gray-700 text-sm font-medium group-hover:text-gray-900 transition-colors">{item.text}</span>
              </motion.div>
            ))}
          </div>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="flex flex-wrap gap-4"
          >
            <Link
              href="/login?mode=signup"
              className="group inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#977DFF] to-[#0033FF] rounded-xl text-white font-semibold hover:shadow-xl hover:shadow-purple-500/25 hover:scale-[1.02] transition-all"
            >
              Get Started Free
              <motion.span animate={{ x: [0, 4, 0] }} transition={{ duration: 1.5, repeat: Infinity }}>
                <ArrowRight size={18} />
              </motion.span>
            </Link>
            <Link
              href="#demo"
              className="inline-flex items-center gap-2 px-6 py-3 bg-white border-2 border-gray-200 rounded-xl text-gray-700 font-semibold hover:border-[#977DFF] hover:bg-[#977DFF]/5 transition-all"
            >
              <Play size={18} className="text-[#977DFF]" />
              Watch Demo
            </Link>
          </motion.div>

          {/* Trust badges */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.6 }}
            className="flex items-center gap-6 mt-10 pt-8 border-t border-gray-100"
          >
            <div className="flex -space-x-3">
              {carouselAvatars.slice(0, 4).map((avatar, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.7 + i * 0.1 }}
                  className={`w-10 h-10 rounded-full bg-gradient-to-br ${avatar.color} flex items-center justify-center text-white text-sm font-bold border-2 border-white shadow-lg`}
                >
                  {avatar.initials}
                </motion.div>
              ))}
            </div>
            <div>
              <div className="flex items-center gap-1">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} size={14} className="text-amber-400 fill-current" />
                ))}
              </div>
              <p className="text-sm text-gray-500">Trusted by 50,000+ teams</p>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Right Side - Carousel */}
      <div className="relative">
        {/* Carousel Container */}
        <motion.div
          initial={{ opacity: 0, x: 40 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="relative bg-white/60 backdrop-blur-sm rounded-3xl p-6 lg:p-8 border border-gray-100 shadow-xl"
        >
          {/* Navigation */}
          <div className="flex items-center justify-between mb-6">
            <AnimatePresence mode="wait">
              <motion.span
                key={currentIndex}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="text-sm font-medium text-gray-500"
              >
                {String(currentIndex + 1).padStart(2, '0')} / {String(features.length).padStart(2, '0')}
              </motion.span>
            </AnimatePresence>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setDirection(-1); setCurrentIndex((prev) => (prev - 1 + features.length) % features.length); }}
                className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-900 transition-colors"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                onClick={() => { setDirection(1); setCurrentIndex((prev) => (prev + 1) % features.length); }}
                className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-900 transition-colors"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>

          {/* Carousel Illustration */}
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
              <CarouselIllustration icon={current.icon} color={current.color} isActive={true} />
            </motion.div>
          </AnimatePresence>

          {/* Feature Title & Description */}
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={currentIndex}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.5, ease: 'easeInOut' }}
              className="text-center mt-6"
            >
              <h3 className="text-xl lg:text-2xl font-bold text-gray-900 mb-2">{current.title}</h3>
              <p className="text-gray-600 text-sm lg:text-base">{current.description}</p>
            </motion.div>
          </AnimatePresence>

          {/* Progress indicators */}
          <div className="flex items-center justify-center gap-2 mt-6">
            {features.map((feature, index) => (
              <button
                key={index}
                onClick={() => goToSlide(index)}
                className="relative h-1.5 rounded-full overflow-hidden transition-all duration-300"
                style={{ width: index === currentIndex ? 32 : 8 }}
              >
                <div className="absolute inset-0 bg-gray-200" />
                {index === currentIndex && (
                  <motion.div
                    className={`absolute inset-0 bg-gradient-to-r ${feature.color}`}
                    initial={{ width: '0%' }}
                    animate={{ width: '100%' }}
                    transition={{ duration: 5, ease: 'linear' }}
                    key={`progress-${currentIndex}`}
                  />
                )}
                {index < currentIndex && (
                  <div className={`absolute inset-0 bg-gradient-to-r ${feature.color}`} />
                )}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Floating decorative cards */}
        <motion.div
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -top-6 -right-6 bg-white rounded-2xl p-4 shadow-xl border border-gray-100 hidden lg:block"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center">
              <Check size={20} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Synced!</p>
              <p className="text-xs text-gray-500">Just now</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
          className="absolute -bottom-6 -left-6 bg-white rounded-2xl p-4 shadow-xl border border-gray-100 hidden lg:block"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#977DFF] to-[#0033FF] flex items-center justify-center">
              <Bot size={20} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">AI Ready</p>
              <p className="text-xs text-gray-500">Always learning</p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

// Stats Carousel
// Animated Scene Components for Stats
function TeamCollaborationScene() {
  const avatars = [
    { initials: 'SC', x: 15, y: 25, delay: 0 },
    { initials: 'AK', x: 75, y: 20, delay: 0.2 },
    { initials: 'JL', x: 50, y: 65, delay: 0.4 },
    { initials: 'TS', x: 10, y: 65, delay: 0.6 },
    { initials: 'MD', x: 80, y: 60, delay: 0.8 },
  ];

  return (
    <div className="relative w-full h-full scale-[0.85] sm:scale-100">
      {/* Central Monitor */}
      <motion.div
        className="absolute left-1/2 top-[45%] -translate-x-1/2 -translate-y-1/2"
        initial={{ scale: 0, rotateY: -30 }}
        animate={{ scale: 1, rotateY: 0 }}
        transition={{ type: 'spring', delay: 0.2 }}
      >
        <div className="relative">
          <div className="w-32 sm:w-48 h-24 sm:h-32 bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg sm:rounded-xl shadow-2xl flex items-center justify-center border-2 sm:border-4 border-gray-700">
            <div className="w-28 sm:w-44 h-20 sm:h-28 bg-gradient-to-br from-[#FFCCF2]/20 via-[#977DFF]/20 to-[#0033FF]/20 rounded-md sm:rounded-lg flex items-center justify-center">
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <Users size={28} className="sm:w-10 sm:h-10 text-[#977DFF]" />
              </motion.div>
            </div>
          </div>
          <div className="w-12 sm:w-16 h-2 sm:h-3 bg-gray-700 mx-auto rounded-b-lg" />
          <div className="w-16 sm:w-24 h-1.5 sm:h-2 bg-gray-600 mx-auto rounded-full" />
        </div>
      </motion.div>

      {/* Floating Avatars */}
      {avatars.map((avatar, i) => (
        <motion.div
          key={i}
          className="absolute"
          style={{ left: `${avatar.x}%`, top: `${avatar.y}%` }}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: avatar.delay, type: 'spring' }}
        >
          <motion.div
            animate={{ y: [0, -6, 0], rotate: [0, 5, -5, 0] }}
            transition={{ duration: 3 + i * 0.5, repeat: Infinity, delay: i * 0.3 }}
            className="relative"
          >
            <div className="w-8 sm:w-12 h-8 sm:h-12 rounded-full bg-gradient-to-br from-[#FFCCF2] via-[#977DFF] to-[#0033FF] flex items-center justify-center text-white text-[10px] sm:text-sm font-bold shadow-lg border-2 border-white">
              {avatar.initials}
            </div>
            <motion.div
              className="absolute -bottom-0.5 -right-0.5 sm:-bottom-1 sm:-right-1 w-2.5 sm:w-4 h-2.5 sm:h-4 bg-green-500 rounded-full border sm:border-2 border-white"
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
          </motion.div>
        </motion.div>
      ))}

      {/* Connection Lines - Hidden on very small screens */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none hidden sm:block">
        <motion.line x1="25%" y1="30%" x2="45%" y2="45%" stroke="#977DFF" strokeWidth="2" strokeDasharray="5,5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1, delay: 0.5 }} />
        <motion.line x1="80%" y1="25%" x2="60%" y2="45%" stroke="#0033FF" strokeWidth="2" strokeDasharray="5,5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1, delay: 0.7 }} />
        <motion.line x1="55%" y1="70%" x2="55%" y2="55%" stroke="#FFCCF2" strokeWidth="2" strokeDasharray="5,5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1, delay: 0.9 }} />
      </svg>
    </div>
  );
}

function UptimeServerScene() {
  return (
    <div className="relative w-full h-full scale-[0.8] sm:scale-100">
      {/* Server Stack */}
      <motion.div
        className="absolute left-1/2 top-[45%] -translate-x-1/2 -translate-y-1/2"
        initial={{ scale: 0, rotateX: 20 }}
        animate={{ scale: 1, rotateX: 0 }}
        transition={{ type: 'spring' }}
        style={{ perspective: '1000px' }}
      >
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + i * 0.15 }}
            className="relative mb-1.5 sm:mb-2"
          >
            <div className="w-40 sm:w-52 h-10 sm:h-14 bg-gradient-to-r from-gray-800 to-gray-700 rounded-md sm:rounded-lg shadow-xl flex items-center px-2 sm:px-4 gap-2 sm:gap-3 border border-gray-600">
              <div className="flex gap-0.5 sm:gap-1">
                {[0, 1, 2].map((j) => (
                  <motion.div
                    key={j}
                    className="w-1.5 sm:w-2 h-1.5 sm:h-2 rounded-full bg-green-500"
                    animate={{ opacity: [1, 0.3, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity, delay: j * 0.2 + i * 0.3 }}
                    style={{ boxShadow: '0 0 8px #22c55e' }}
                  />
                ))}
              </div>
              <div className="flex-1 h-1.5 sm:h-2 bg-gray-600 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-[#FFCCF2] via-[#977DFF] to-[#0033FF]"
                  initial={{ width: '0%' }}
                  animate={{ width: '99.9%' }}
                  transition={{ duration: 2, delay: 0.5 + i * 0.2 }}
                />
              </div>
              <Server size={14} className="sm:w-[18px] sm:h-[18px] text-[#977DFF]" />
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Floating Status Indicators */}
      <motion.div
        className="absolute top-4 sm:top-8 right-4 sm:right-8 p-2 sm:p-3 bg-white rounded-lg sm:rounded-xl shadow-lg"
        animate={{ y: [0, -5, 0] }}
        transition={{ duration: 3, repeat: Infinity }}
      >
        <div className="flex items-center gap-1.5 sm:gap-2">
          <motion.div
            className="w-2 sm:w-3 h-2 sm:h-3 rounded-full bg-green-500"
            animate={{ scale: [1, 1.3, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
          />
          <span className="text-[10px] sm:text-xs font-semibold text-gray-700">All Systems Operational</span>
        </div>
      </motion.div>

      {/* Wifi Signals */}
      <motion.div
        className="absolute bottom-8 sm:bottom-12 left-4 sm:left-8"
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        <Wifi size={24} className="sm:w-8 sm:h-8 text-[#977DFF]" />
      </motion.div>

      {/* Activity Pulse */}
      <motion.div className="absolute top-12 sm:top-16 left-6 sm:left-12">
        <Activity size={20} className="sm:w-7 sm:h-7 text-[#0033FF]" />
      </motion.div>
    </div>
  );
}

function ProductivityScene() {
  return (
    <div className="relative w-full h-full scale-[0.8] sm:scale-100">
      {/* Main Laptop */}
      <motion.div
        className="absolute left-1/2 top-[45%] -translate-x-1/2 -translate-y-1/2"
        initial={{ scale: 0, rotateY: -20 }}
        animate={{ scale: 1, rotateY: 0 }}
        transition={{ type: 'spring' }}
      >
        <div className="relative">
          {/* Screen */}
          <div className="w-40 sm:w-56 h-28 sm:h-36 bg-gradient-to-br from-gray-800 to-gray-900 rounded-t-lg sm:rounded-t-xl shadow-2xl p-1.5 sm:p-2 border-2 sm:border-4 border-gray-700">
            <div className="w-full h-full bg-white rounded-md sm:rounded-lg overflow-hidden">
              {/* Chart Animation */}
              <div className="p-2 sm:p-3 h-full flex items-end gap-1 sm:gap-2">
                {[40, 65, 45, 80, 60, 90, 75].map((height, i) => (
                  <motion.div
                    key={i}
                    className="flex-1 bg-gradient-to-t from-[#0033FF] to-[#977DFF] rounded-t"
                    initial={{ height: 0 }}
                    animate={{ height: `${height}%` }}
                    transition={{ duration: 0.8, delay: 0.1 * i, ease: 'easeOut' }}
                  />
                ))}
              </div>
            </div>
          </div>
          {/* Keyboard */}
          <div className="w-44 sm:w-64 h-3 sm:h-4 bg-gradient-to-b from-gray-600 to-gray-700 rounded-b-lg sm:rounded-b-xl -mt-1 mx-auto" />
          <div className="w-48 sm:w-72 h-1.5 sm:h-2 bg-gray-500 rounded-full mx-auto" />
        </div>
      </motion.div>

      {/* Floating Growth Arrow */}
      <motion.div
        className="absolute top-4 sm:top-8 right-4 sm:right-12"
        animate={{ y: [0, -10, 0], rotate: [0, 10, 0] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        <div className="w-10 sm:w-16 h-10 sm:h-16 rounded-xl sm:rounded-2xl bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center shadow-xl">
          <TrendingUp size={20} className="sm:w-8 sm:h-8 text-white" />
        </div>
      </motion.div>

      {/* Percentage Badge */}
      <motion.div
        className="absolute bottom-10 sm:bottom-16 left-4 sm:left-8 p-2.5 sm:p-4 bg-white rounded-xl sm:rounded-2xl shadow-xl"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.5, type: 'spring' }}
      >
        <div className="text-xl sm:text-3xl font-bold bg-gradient-to-r from-[#977DFF] to-[#0033FF] bg-clip-text text-transparent">+47%</div>
        <div className="text-[10px] sm:text-xs text-gray-500">Productivity</div>
      </motion.div>

      {/* Floating Checkmarks */}
      {[{ x: 10, y: 15 }, { x: 85, y: 65 }].map((pos, i) => (
        <motion.div
          key={i}
          className="absolute w-7 sm:w-10 h-7 sm:h-10 rounded-full bg-gradient-to-br from-[#FFCCF2] to-[#977DFF] flex items-center justify-center shadow-lg"
          style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.8 + i * 0.2, type: 'spring' }}
        >
          <Check size={14} className="sm:w-5 sm:h-5 text-white" />
        </motion.div>
      ))}
    </div>
  );
}

function TimeSavedScene() {
  return (
    <div className="relative w-full h-full scale-[0.8] sm:scale-100">
      {/* Central Clock */}
      <motion.div
        className="absolute left-1/2 top-[45%] -translate-x-1/2 -translate-y-1/2"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', duration: 0.8 }}
      >
        <div className="relative w-28 sm:w-36 h-28 sm:h-36 rounded-full bg-gradient-to-br from-[#FFCCF2] via-[#977DFF] to-[#0033FF] p-1 shadow-2xl">
          <div className="w-full h-full rounded-full bg-white flex items-center justify-center relative">
            {/* Clock face markers */}
            {[...Array(12)].map((_, i) => {
              const angle = (i * 30 - 90) * (Math.PI / 180);
              const x = Math.round((50 + 42 * Math.cos(angle)) * 100) / 100;
              const y = Math.round((50 + 42 * Math.sin(angle)) * 100) / 100;
              return (
                <div
                  key={i}
                  className={`absolute w-1.5 rounded-full ${i % 3 === 0 ? 'h-3 bg-gray-600' : 'h-2 bg-gray-300'}`}
                  style={{
                    left: `${x}%`,
                    top: `${y}%`,
                    transform: `translate(-50%, -50%) rotate(${i * 30}deg)`,
                  }}
                />
              );
            })}

            {/* Hour hand */}
            <motion.div
              className="absolute w-1.5 h-8 bg-gray-800 rounded-full"
              style={{
                left: '50%',
                top: '50%',
                originX: '50%',
                originY: '100%',
                x: '-50%',
                y: '-100%',
              }}
              animate={{ rotate: 360 }}
              transition={{ duration: 43200, repeat: Infinity, ease: 'linear' }}
            />

            {/* Minute hand */}
            <motion.div
              className="absolute w-1 h-12 bg-[#977DFF] rounded-full"
              style={{
                left: '50%',
                top: '50%',
                originX: '50%',
                originY: '100%',
                x: '-50%',
                y: '-100%',
              }}
              animate={{ rotate: 360 }}
              transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
            />

            {/* Second hand */}
            <motion.div
              className="absolute w-0.5 h-14 bg-[#0033FF] rounded-full"
              style={{
                left: '50%',
                top: '50%',
                originX: '50%',
                originY: '85%',
                x: '-50%',
                y: '-85%',
              }}
              animate={{ rotate: 360 }}
              transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
            />

            {/* Center dot */}
            <div className="absolute left-1/2 top-1/2 w-4 h-4 bg-gradient-to-br from-[#977DFF] to-[#0033FF] rounded-full -translate-x-1/2 -translate-y-1/2 shadow-md" />
          </div>
        </div>

        {/* Glow effect */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[#FFCCF2] via-[#977DFF] to-[#0033FF] blur-xl opacity-30 -z-10 scale-110" />
      </motion.div>

      {/* Time Saved Badge */}
      <motion.div
        className="absolute top-4 right-4 p-3 bg-white rounded-2xl shadow-xl border border-gray-100"
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0, y: [0, -5, 0] }}
        transition={{ y: { duration: 2.5, repeat: Infinity }, opacity: { duration: 0.5 } }}
      >
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#FFCCF2] to-[#977DFF] flex items-center justify-center">
            <Clock size={20} className="text-white" />
          </div>
          <div>
            <div className="text-xl font-bold text-gray-900">12hrs</div>
            <div className="text-xs text-gray-500">Saved Weekly</div>
          </div>
        </div>
      </motion.div>

      {/* Floating Devices */}
      <motion.div
        className="absolute bottom-16 left-4"
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: 1, y: [0, 8, 0] }}
        transition={{ y: { duration: 3, repeat: Infinity }, scale: { delay: 0.3 } }}
      >
        <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center shadow-lg border border-gray-100">
          <Smartphone size={24} className="text-[#0033FF]" />
        </div>
      </motion.div>

      <motion.div
        className="absolute bottom-24 right-4"
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: 1, y: [0, -8, 0] }}
        transition={{ y: { duration: 2.5, repeat: Infinity, delay: 0.5 }, scale: { delay: 0.5 } }}
      >
        <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center shadow-lg border border-gray-100">
          <Laptop size={24} className="text-[#977DFF]" />
        </div>
      </motion.div>

      {/* Circular progress rings */}
      <svg className="absolute left-1/2 top-[45%] -translate-x-1/2 -translate-y-1/2 w-48 h-48">
        <motion.circle
          cx="96"
          cy="96"
          r="88"
          fill="none"
          stroke="#FFCCF2"
          strokeWidth="2"
          strokeDasharray="552"
          initial={{ strokeDashoffset: 552 }}
          animate={{ strokeDashoffset: 0 }}
          transition={{ duration: 2, ease: 'easeOut' }}
        />
      </svg>

      {/* Sparkle Effects */}
      {[{ x: 20, y: 25 }, { x: 75, y: 20 }, { x: 85, y: 75 }].map((pos, i) => (
        <motion.div
          key={i}
          className="absolute"
          style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
          animate={{ scale: [0, 1, 0], opacity: [0, 1, 0] }}
          transition={{ duration: 2, repeat: Infinity, delay: i * 0.7 }}
        >
          <Sparkles size={16} className="text-[#FFCCF2]" />
        </motion.div>
      ))}
    </div>
  );
}

function StatsCarousel() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const stats = [
    {
      value: '50K+',
      label: 'Active Teams',
      icon: Users,
      description: 'Teams worldwide trust Bheem for their daily operations',
      scene: TeamCollaborationScene
    },
    {
      value: '99.9%',
      label: 'Uptime SLA',
      icon: Award,
      description: 'Enterprise-grade reliability you can count on',
      scene: UptimeServerScene
    },
    {
      value: '47%',
      label: 'Productivity Boost',
      icon: TrendingUp,
      description: 'Average increase in team productivity',
      scene: ProductivityScene
    },
    {
      value: '12hrs',
      label: 'Saved Weekly',
      icon: Clock,
      description: 'Time saved per team member every week',
      scene: TimeSavedScene
    },
  ];

  useEffect(() => {
    if (isHovered) return;
    const interval = setInterval(() => setActiveIndex((prev) => (prev + 1) % stats.length), 4000);
    return () => clearInterval(interval);
  }, [stats.length, isHovered]);

  return (
    <div
      className="relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-[#FFCCF2]/20 to-transparent rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-tr from-[#0033FF]/20 to-transparent rounded-full blur-3xl" />
      </div>

      <div className="relative grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12 lg:gap-20 items-center">
        {/* Left Side - Content & Stats */}
        <div className="order-2 lg:order-1 text-center lg:text-left">
          <motion.span
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-gradient-to-r from-[#FFCCF2]/20 via-[#977DFF]/20 to-[#0033FF]/20 text-[#0033FF] text-xs sm:text-sm font-medium mb-4 sm:mb-6 border border-[#977DFF]/20"
          >
            <BarChart2 size={14} className="sm:w-4 sm:h-4" />
            By The Numbers
          </motion.span>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeIndex}
              initial={{ opacity: 0, x: -30, rotateY: -10 }}
              animate={{ opacity: 1, x: 0, rotateY: 0 }}
              exit={{ opacity: 0, x: 30, rotateY: 10 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              style={{ perspective: '1000px' }}
            >
              <h2 className="text-4xl sm:text-5xl lg:text-7xl font-bold text-gray-900 mb-2">
                {stats[activeIndex].value}
              </h2>
              <h3 className="text-xl sm:text-2xl lg:text-3xl font-semibold bg-gradient-to-r from-[#977DFF] to-[#0033FF] bg-clip-text text-transparent mb-3 sm:mb-4">
                {stats[activeIndex].label}
              </h3>
              <p className="text-base sm:text-lg text-gray-600 mb-6 sm:mb-8 leading-relaxed max-w-md mx-auto lg:mx-0">
                {stats[activeIndex].description}
              </p>
            </motion.div>
          </AnimatePresence>

          {/* Stats Navigation Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
            {stats.map((stat, i) => (
              <motion.button
                key={i}
                onClick={() => setActiveIndex(i)}
                className={`relative p-3 sm:p-4 rounded-xl sm:rounded-2xl cursor-pointer transition-all duration-300 overflow-hidden ${
                  activeIndex === i
                    ? 'bg-white shadow-xl shadow-gray-200/50'
                    : 'bg-gray-50/80 hover:bg-white hover:shadow-lg'
                }`}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.98 }}
              >
                {/* Progress indicator */}
                {activeIndex === i && !isHovered && (
                  <motion.div
                    className="absolute bottom-0 left-0 h-1 bg-gradient-to-r from-[#FFCCF2] via-[#977DFF] to-[#0033FF]"
                    initial={{ width: '0%' }}
                    animate={{ width: '100%' }}
                    transition={{ duration: 4, ease: 'linear' }}
                    key={`stat-progress-${i}`}
                  />
                )}

                <div className={`w-8 sm:w-10 h-8 sm:h-10 rounded-lg sm:rounded-xl mb-1.5 sm:mb-2 flex items-center justify-center transition-all mx-auto lg:mx-0 ${
                  activeIndex === i
                    ? `bg-gradient-to-br ${BRAND_GRADIENT}`
                    : 'bg-gray-100'
                }`}>
                  <stat.icon size={16} className={`sm:w-[18px] sm:h-[18px] ${activeIndex === i ? 'text-white' : 'text-gray-400'}`} />
                </div>
                <div className={`text-base sm:text-lg font-bold ${activeIndex === i ? 'text-gray-900' : 'text-gray-500'}`}>
                  {stat.value}
                </div>
                <div className="text-[10px] sm:text-xs text-gray-400 truncate">{stat.label}</div>
              </motion.button>
            ))}
          </div>

          {/* Trust Avatars */}
          <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row items-center gap-3 sm:gap-4 justify-center lg:justify-start">
            <div className="flex -space-x-3">
              {['SC', 'AK', 'JL', 'TS', 'MD'].map((initials, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="w-8 sm:w-10 h-8 sm:h-10 rounded-full bg-gradient-to-br from-[#FFCCF2] via-[#977DFF] to-[#0033FF] flex items-center justify-center text-white text-[10px] sm:text-xs font-semibold border-2 border-white shadow-lg"
                  style={{ zIndex: 5 - i }}
                >
                  {initials}
                </motion.div>
              ))}
            </div>
            <div className="text-xs sm:text-sm text-gray-500">
              <span className="font-semibold text-gray-900">+2,000</span> teams joined this month
            </div>
          </div>
        </div>

        {/* Right Side - Animated Scene Showcase */}
        <div className="order-1 lg:order-2 relative px-4 sm:px-8 lg:px-0" style={{ perspective: '1200px' }}>
          {/* Main Animated Card */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeIndex}
              initial={{ opacity: 0, rotateY: -15, scale: 0.95 }}
              animate={{ opacity: 1, rotateY: 0, scale: 1 }}
              exit={{ opacity: 0, rotateY: 15, scale: 0.95 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="relative"
              style={{ transformStyle: 'preserve-3d' }}
            >
              {/* Card Container */}
              <motion.div
                className="relative rounded-3xl overflow-hidden"
                whileHover={{ rotateY: 3, rotateX: -3, scale: 1.02 }}
                transition={{ type: 'spring', stiffness: 300 }}
                style={{ transformStyle: 'preserve-3d' }}
              >
                {/* Gradient border */}
                <div className={`absolute inset-0 bg-gradient-to-br ${BRAND_GRADIENT} rounded-3xl`} />

                {/* Inner content */}
                <div className="relative m-0.5 sm:m-1 rounded-[1.2rem] sm:rounded-[1.4rem] bg-gradient-to-br from-gray-50 to-white h-[280px] sm:h-[320px] lg:h-[400px] overflow-hidden">
                  {/* Animated Scene */}
                  {(() => {
                    const Scene = stats[activeIndex].scene;
                    return <Scene />;
                  })()}

                  {/* Bottom Stat Overlay */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-white via-white/95 to-transparent"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${BRAND_GRADIENT} flex items-center justify-center shadow-lg`}>
                        {(() => {
                          const Icon = stats[activeIndex].icon;
                          return <Icon size={24} className="text-white" />;
                        })()}
                      </div>
                      <div className="flex-1">
                        <div className="text-2xl font-bold text-gray-900">{stats[activeIndex].value}</div>
                        <div className="text-sm text-gray-500">{stats[activeIndex].label}</div>
                      </div>
                      <motion.div
                        animate={{ scale: [1, 1.1, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center"
                      >
                        <TrendingUp size={24} className="text-green-600" />
                      </motion.div>
                    </div>
                  </motion.div>
                </div>
              </motion.div>

              {/* 3D Floating Elements - Hidden on small screens */}
              <motion.div
                className="absolute -top-4 -right-4 sm:-top-6 sm:-right-6 w-14 h-14 sm:w-20 sm:h-20 rounded-xl sm:rounded-2xl bg-white shadow-xl flex items-center justify-center z-10 hidden sm:flex"
                initial={{ opacity: 0, scale: 0, rotate: -20 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                transition={{ delay: 0.4, type: 'spring' }}
              >
                <motion.div
                  animate={{ rotateY: [0, 360] }}
                  transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
                  style={{ transformStyle: 'preserve-3d' }}
                  className={`w-8 h-8 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-gradient-to-br ${BRAND_GRADIENT} flex items-center justify-center`}
                >
                  <Sparkles size={16} className="sm:w-5 sm:h-5 text-white" />
                </motion.div>
              </motion.div>

              <motion.div
                className="absolute -bottom-3 -left-3 sm:-bottom-4 sm:-left-4 w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-white shadow-xl flex items-center justify-center z-10 hidden sm:flex"
                initial={{ opacity: 0, scale: 0, rotate: 20 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                transition={{ delay: 0.5, type: 'spring' }}
              >
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center"
                >
                  <CheckCircle2 size={14} className="sm:w-[18px] sm:h-[18px] text-white" />
                </motion.div>
              </motion.div>

              {/* Floating mini cards - Hidden on mobile */}
              <motion.div
                className="absolute top-1/4 -left-6 lg:-left-8 p-2 sm:p-3 rounded-lg sm:rounded-xl bg-white shadow-lg z-10 hidden md:block"
                animate={{ y: [0, -10, 0], rotateZ: [0, 5, 0] }}
                transition={{ duration: 4, repeat: Infinity }}
              >
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-br from-[#FFCCF2] to-[#977DFF] flex items-center justify-center">
                    <Users size={12} className="sm:w-[14px] sm:h-[14px] text-white" />
                  </div>
                  <div className="text-xs">
                    <div className="font-bold text-gray-900">+128</div>
                    <div className="text-gray-400">Today</div>
                  </div>
                </div>
              </motion.div>

              <motion.div
                className="absolute bottom-1/3 -right-4 lg:-right-6 p-2 sm:p-3 rounded-lg sm:rounded-xl bg-white shadow-lg z-10 hidden md:block"
                animate={{ y: [0, 10, 0], rotateZ: [0, -5, 0] }}
                transition={{ duration: 3.5, repeat: Infinity, delay: 0.5 }}
              >
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-br from-[#977DFF] to-[#0033FF] flex items-center justify-center">
                    <TrendingUp size={12} className="sm:w-[14px] sm:h-[14px] text-white" />
                  </div>
                  <div className="text-xs">
                    <div className="font-bold text-green-500">+47%</div>
                    <div className="text-gray-400">Growth</div>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </AnimatePresence>

          {/* Animated Elements Around The Box - Simplified on mobile */}
          <div className="absolute inset-0 sm:inset-[-30px] lg:inset-[-60px] pointer-events-none overflow-visible hidden sm:block">
            {/* Orbiting Particles Around Card */}
            {[...Array(8)].map((_, i) => {
              const angle = (i * 45) * (Math.PI / 180);
              return (
                <motion.div
                  key={`orbit-particle-${i}`}
                  className="absolute left-1/2 top-1/2"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 15 + i * 2, repeat: Infinity, ease: 'linear' }}
                  style={{ transformOrigin: '0 0' }}
                >
                  <motion.div
                    className="absolute"
                    style={{
                      x: Math.round(Math.cos(angle) * 220 * 100) / 100,
                      y: Math.round(Math.sin(angle) * 180 * 100) / 100,
                    }}
                    animate={{
                      scale: [1, 1.5, 1],
                      opacity: [0.4, 1, 0.4],
                    }}
                    transition={{ duration: 2, repeat: Infinity, delay: i * 0.25 }}
                  >
                    <div
                      className="rounded-full"
                      style={{
                        width: 8 + (i % 3) * 4,
                        height: 8 + (i % 3) * 4,
                        background: i % 3 === 0 ? '#FFCCF2' : i % 3 === 1 ? '#977DFF' : '#0033FF',
                        boxShadow: `0 0 20px ${i % 3 === 0 ? '#FFCCF2' : i % 3 === 1 ? '#977DFF' : '#0033FF'}`,
                      }}
                    />
                  </motion.div>
                </motion.div>
              );
            })}

            {/* Floating Icons Around Card */}
            {[
              { icon: Users, x: -40, y: '20%', delay: 0 },
              { icon: TrendingUp, x: -50, y: '60%', delay: 0.5 },
              { icon: Award, x: 'calc(100% + 10px)', y: '30%', delay: 1 },
              { icon: Clock, x: 'calc(100% + 20px)', y: '70%', delay: 1.5 },
            ].map((item, i) => (
              <motion.div
                key={`float-icon-${i}`}
                className="absolute"
                style={{ left: item.x, top: item.y }}
                initial={{ opacity: 0, scale: 0 }}
                animate={{
                  opacity: 1,
                  scale: 1,
                  y: [0, -15, 0],
                  rotate: [0, 10, -10, 0],
                }}
                transition={{
                  y: { duration: 3, repeat: Infinity, delay: item.delay },
                  rotate: { duration: 4, repeat: Infinity, delay: item.delay },
                  opacity: { duration: 0.5, delay: item.delay },
                  scale: { duration: 0.5, delay: item.delay },
                }}
              >
                <div className="w-12 h-12 rounded-2xl bg-white shadow-xl border border-gray-100 flex items-center justify-center">
                  <item.icon size={20} className="text-[#977DFF]" />
                </div>
              </motion.div>
            ))}

            {/* Glowing Corner Accents */}
            <motion.div
              className="absolute -top-4 -left-4 w-24 h-24 rounded-full bg-gradient-to-br from-[#FFCCF2] to-transparent opacity-60 blur-2xl"
              animate={{ scale: [1, 1.3, 1], opacity: [0.4, 0.7, 0.4] }}
              transition={{ duration: 3, repeat: Infinity }}
            />
            <motion.div
              className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-gradient-to-bl from-[#977DFF] to-transparent opacity-60 blur-2xl"
              animate={{ scale: [1, 1.2, 1], opacity: [0.4, 0.6, 0.4] }}
              transition={{ duration: 4, repeat: Infinity, delay: 0.5 }}
            />
            <motion.div
              className="absolute -bottom-4 -left-4 w-20 h-20 rounded-full bg-gradient-to-tr from-[#0033FF] to-transparent opacity-50 blur-2xl"
              animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
              transition={{ duration: 3.5, repeat: Infinity, delay: 1 }}
            />
            <motion.div
              className="absolute -bottom-4 -right-4 w-24 h-24 rounded-full bg-gradient-to-tl from-[#FFCCF2] via-[#977DFF] to-transparent opacity-50 blur-2xl"
              animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.6, 0.3] }}
              transition={{ duration: 4, repeat: Infinity, delay: 1.5 }}
            />

            {/* Animated Border Lines */}
            <svg className="absolute inset-0 w-full h-full overflow-visible">
              <defs>
                <linearGradient id="borderGrad1" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#FFCCF2" stopOpacity="0" />
                  <stop offset="50%" stopColor="#977DFF" stopOpacity="1" />
                  <stop offset="100%" stopColor="#0033FF" stopOpacity="0" />
                </linearGradient>
                <linearGradient id="borderGrad2" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#0033FF" stopOpacity="0" />
                  <stop offset="50%" stopColor="#977DFF" stopOpacity="1" />
                  <stop offset="100%" stopColor="#FFCCF2" stopOpacity="0" />
                </linearGradient>
              </defs>
              {/* Top border */}
              <motion.line
                x1="20%"
                y1="0"
                x2="80%"
                y2="0"
                stroke="url(#borderGrad1)"
                strokeWidth="2"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: [0, 1, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              />
              {/* Bottom border */}
              <motion.line
                x1="20%"
                y1="100%"
                x2="80%"
                y2="100%"
                stroke="url(#borderGrad1)"
                strokeWidth="2"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: [0, 1, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }}
              />
              {/* Left border */}
              <motion.line
                x1="0"
                y1="20%"
                x2="0"
                y2="80%"
                stroke="url(#borderGrad2)"
                strokeWidth="2"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: [0, 1, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 0.75 }}
              />
              {/* Right border */}
              <motion.line
                x1="100%"
                y1="20%"
                x2="100%"
                y2="80%"
                stroke="url(#borderGrad2)"
                strokeWidth="2"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: [0, 1, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 2.25 }}
              />
            </svg>

            {/* Connecting Lines from Icons to Card */}
            <svg className="absolute inset-0 w-full h-full overflow-visible opacity-30">
              <motion.line
                x1="-20"
                y1="25%"
                x2="0"
                y2="30%"
                stroke="#977DFF"
                strokeWidth="1"
                strokeDasharray="4 4"
                animate={{ opacity: [0.3, 0.8, 0.3] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
              <motion.line
                x1="-30"
                y1="65%"
                x2="0"
                y2="60%"
                stroke="#0033FF"
                strokeWidth="1"
                strokeDasharray="4 4"
                animate={{ opacity: [0.3, 0.8, 0.3] }}
                transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
              />
              <motion.line
                x1="100%"
                y1="35%"
                x2="calc(100% + 30px)"
                y2="30%"
                stroke="#FFCCF2"
                strokeWidth="1"
                strokeDasharray="4 4"
                animate={{ opacity: [0.3, 0.8, 0.3] }}
                transition={{ duration: 2, repeat: Infinity, delay: 1 }}
              />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}

// Apps Showcase - Premium Two-Side Layout
// Bheem brand gradient: #FFCCF2 → #977DFF → #0033FF
const BRAND_GRADIENT = 'from-[#FFCCF2] via-[#977DFF] to-[#0033FF]';

// Galaxy Security Orbit Component
function SecurityOrbit() {
  return (
    <div className="absolute inset-0 pointer-events-none" style={{ perspective: '1000px' }}>
      {/* Outer orbit ring */}
      <motion.div
        className="absolute inset-[-40px] rounded-full border border-[#977DFF]/20"
        style={{ transformStyle: 'preserve-3d', rotateX: '70deg' }}
        animate={{ rotate: 360 }}
        transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
      >
        {/* Glowing particles on orbit */}
        {[0, 60, 120, 180, 240, 300].map((deg, i) => (
          <motion.div
            key={i}
            className="absolute w-3 h-3 rounded-full"
            style={{
              background: i % 2 === 0 ? '#FFCCF2' : '#977DFF',
              boxShadow: `0 0 20px ${i % 2 === 0 ? '#FFCCF2' : '#977DFF'}`,
              top: '50%',
              left: '50%',
              transform: `rotate(${deg}deg) translateX(calc(50% + 20px)) translateY(-50%)`,
            }}
            animate={{
              scale: [1, 1.5, 1],
              opacity: [0.6, 1, 0.6],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              delay: i * 0.3,
            }}
          />
        ))}
      </motion.div>

      {/* Middle orbit ring */}
      <motion.div
        className="absolute inset-[-20px] rounded-full border border-[#0033FF]/20"
        style={{ transformStyle: 'preserve-3d', rotateX: '75deg' }}
        animate={{ rotate: -360 }}
        transition={{ duration: 15, repeat: Infinity, ease: 'linear' }}
      >
        {/* Security shield particles */}
        {[0, 90, 180, 270].map((deg, i) => (
          <motion.div
            key={i}
            className="absolute flex items-center justify-center"
            style={{
              top: '50%',
              left: '50%',
              transform: `rotate(${deg}deg) translateX(calc(50% + 10px)) translateY(-50%)`,
            }}
          >
            <motion.div
              className="w-6 h-6 rounded-lg bg-gradient-to-br from-[#977DFF] to-[#0033FF] flex items-center justify-center shadow-lg"
              style={{ boxShadow: '0 0 15px rgba(151, 125, 255, 0.5)' }}
              animate={{
                scale: [1, 1.2, 1],
                rotateY: [0, 180, 360],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                delay: i * 0.5,
              }}
            >
              <Shield size={12} className="text-white" />
            </motion.div>
          </motion.div>
        ))}
      </motion.div>

      {/* Inner glow ring */}
      <motion.div
        className="absolute inset-[10px] rounded-[2.5rem] opacity-50"
        style={{
          background: 'linear-gradient(90deg, transparent, rgba(151, 125, 255, 0.3), transparent)',
          transformStyle: 'preserve-3d',
          rotateX: '80deg',
        }}
        animate={{ rotate: 360 }}
        transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
      />

      {/* Floating security badges */}
      <motion.div
        className="absolute -top-8 left-1/4 w-10 h-10 rounded-xl bg-white/90 backdrop-blur-sm shadow-xl flex items-center justify-center"
        animate={{
          y: [0, -10, 0],
          rotateY: [0, 15, 0],
        }}
        transition={{ duration: 4, repeat: Infinity }}
        style={{ transformStyle: 'preserve-3d' }}
      >
        <Lock size={18} className="text-[#0033FF]" />
      </motion.div>

      <motion.div
        className="absolute -bottom-6 right-1/4 w-10 h-10 rounded-xl bg-white/90 backdrop-blur-sm shadow-xl flex items-center justify-center"
        animate={{
          y: [0, 10, 0],
          rotateY: [0, -15, 0],
        }}
        transition={{ duration: 3.5, repeat: Infinity, delay: 0.5 }}
        style={{ transformStyle: 'preserve-3d' }}
      >
        <CheckCircle2 size={18} className="text-[#977DFF]" />
      </motion.div>

      {/* Animated gradient trail */}
      <svg className="absolute inset-0 w-full h-full" style={{ transform: 'rotateX(70deg)', transformStyle: 'preserve-3d' }}>
        <defs>
          <linearGradient id="orbitGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#FFCCF2" stopOpacity="0" />
            <stop offset="50%" stopColor="#977DFF" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#0033FF" stopOpacity="0" />
          </linearGradient>
        </defs>
        <motion.ellipse
          cx="50%"
          cy="50%"
          rx="48%"
          ry="48%"
          fill="none"
          stroke="url(#orbitGradient)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="100 200"
          animate={{ strokeDashoffset: [0, -300] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
        />
      </svg>

      {/* 3D perspective stars/particles */}
      {[...Array(8)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 rounded-full bg-[#977DFF]"
          style={{
            top: `${20 + Math.random() * 60}%`,
            left: `${10 + Math.random() * 80}%`,
            boxShadow: '0 0 6px #977DFF',
          }}
          animate={{
            opacity: [0, 1, 0],
            scale: [0, 1.5, 0],
          }}
          transition={{
            duration: 2 + Math.random() * 2,
            repeat: Infinity,
            delay: i * 0.4,
          }}
        />
      ))}
    </div>
  );
}

function AppsShowcase() {
  const [currentApp, setCurrentApp] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const apps = [
    { name: 'Mail', icon: Mail, description: 'AI-powered email with smart replies, auto-categorization, and priority inbox.', features: ['Smart replies', 'Auto-categorization', 'Priority inbox', 'Scheduling'] },
    { name: 'Meet', icon: Video, description: 'Crystal clear HD video meetings with transcription and AI summaries.', features: ['HD video', 'Transcription', 'AI summaries', 'Screen sharing'] },
    { name: 'Docs', icon: FileText, description: 'Collaborative documents with AI writing assistance and templates.', features: ['Real-time editing', 'AI writing', 'Templates', 'Export options'] },
    { name: 'Drive', icon: HardDrive, description: 'Secure cloud storage with advanced sharing and version control.', features: ['Unlimited storage', 'Version history', 'Smart search', 'Secure sharing'] },
    { name: 'Calendar', icon: Calendar, description: 'Smart scheduling that learns your preferences and finds the best times.', features: ['Smart scheduling', 'Time zones', 'Integrations', 'Reminders'] },
  ];

  useEffect(() => {
    if (isHovered) return;
    const interval = setInterval(() => setCurrentApp((prev) => (prev + 1) % apps.length), 4000);
    return () => clearInterval(interval);
  }, [apps.length, isHovered]);

  const current = apps[currentApp];

  return (
    <div
      className="relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-br from-[#977DFF]/10 to-transparent rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-gradient-to-tr from-[#0033FF]/10 to-transparent rounded-full blur-3xl" />
      </div>

      <div className="relative grid grid-cols-1 lg:grid-cols-[1fr,1.5fr] gap-8 lg:gap-16 items-start">
        {/* Left Side - Navigation & Header */}
        <div className="lg:sticky lg:top-24 text-center lg:text-left">
          <span className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-gradient-to-r from-[#977DFF]/10 to-[#0033FF]/10 text-[#0033FF] text-xs sm:text-sm font-medium mb-4 sm:mb-6 border border-[#0033FF]/10">
            <Zap size={14} className="sm:w-4 sm:h-4" />
            Powerful Apps
          </span>

          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-3 sm:mb-4 leading-tight">
            Everything you need,{' '}
            <span className="bg-gradient-to-r from-[#977DFF] to-[#0033FF] bg-clip-text text-transparent">one platform</span>
          </h2>

          <p className="text-base sm:text-lg text-gray-500 mb-6 sm:mb-10 leading-relaxed max-w-md mx-auto lg:mx-0">
            A complete suite of productivity tools designed to work seamlessly together.
          </p>

          {/* App Navigation - Horizontal scroll on mobile, vertical on desktop */}
          <div className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-visible pb-4 lg:pb-0 -mx-4 px-4 lg:mx-0 lg:px-0 scrollbar-hide">
            {apps.map((app, i) => (
              <motion.button
                key={app.name}
                onClick={() => setCurrentApp(i)}
                className={`flex-shrink-0 lg:w-full flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl sm:rounded-2xl transition-all duration-300 text-left group relative overflow-hidden ${
                  currentApp === i
                    ? 'bg-white shadow-xl shadow-gray-200/50 border border-gray-100'
                    : 'bg-gray-50/80 lg:bg-transparent hover:bg-white/60 hover:shadow-lg hover:shadow-gray-100/50'
                }`}
                whileTap={{ scale: 0.98 }}
              >
                {/* Progress bar for active item */}
                {currentApp === i && !isHovered && (
                  <motion.div
                    className={`absolute bottom-0 left-0 h-1 bg-gradient-to-r ${BRAND_GRADIENT}`}
                    initial={{ width: '0%' }}
                    animate={{ width: '100%' }}
                    transition={{ duration: 4, ease: 'linear' }}
                    key={`progress-${i}`}
                  />
                )}

                <div className={`flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl flex items-center justify-center transition-all duration-300 ${
                  currentApp === i
                    ? `bg-gradient-to-br ${BRAND_GRADIENT} shadow-lg`
                    : 'bg-gradient-to-br from-[#FFCCF2]/20 via-[#977DFF]/20 to-[#0033FF]/20 group-hover:scale-110'
                }`}>
                  <app.icon size={18} className={`sm:w-[22px] sm:h-[22px] ${currentApp === i ? 'text-white' : 'text-[#977DFF]'}`} />
                </div>

                <div className="flex-1 min-w-0 hidden sm:block">
                  <h3 className={`font-semibold transition-colors ${currentApp === i ? 'text-gray-900' : 'text-gray-600'}`}>
                    {app.name}
                  </h3>
                  <p className="text-sm text-gray-400 truncate hidden lg:block">
                    {app.features[0]} & more
                  </p>
                </div>

                {/* Show app name below icon on mobile */}
                <span className={`sm:hidden text-xs font-medium ${currentApp === i ? 'text-gray-900' : 'text-gray-500'}`}>
                  {app.name}
                </span>

                {currentApp === i && (
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className={`w-2 h-2 rounded-full bg-gradient-to-r ${BRAND_GRADIENT} hidden lg:block`}
                  />
                )}
              </motion.button>
            ))}
          </div>
        </div>

        {/* Right Side - App Showcase Card */}
        <div className="relative py-6 sm:py-12 px-2 sm:px-0">
          {/* Galaxy Security Orbit - Hidden on mobile */}
          <div className="absolute inset-0 items-center justify-center hidden md:flex">
            <div className="relative w-full h-full max-w-[600px] mx-auto">
              <SecurityOrbit />
            </div>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={currentApp}
              initial={{ opacity: 0, y: 30, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.98 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="relative z-10"
            >
              {/* Main Card */}
              <div className={`rounded-2xl sm:rounded-[2rem] bg-gradient-to-br ${BRAND_GRADIENT} p-0.5 sm:p-1 shadow-2xl shadow-gray-300/40`}>
                <div className="rounded-[1.4rem] sm:rounded-[1.85rem] bg-gradient-to-br from-white/20 to-white/5 backdrop-blur-xl p-5 sm:p-8 lg:p-10">
                  {/* Card Header */}
                  <div className="flex items-start justify-between mb-5 sm:mb-8">
                    <div>
                      <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.2 }}
                        className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3"
                      >
                        <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                          <current.icon size={20} className="sm:w-7 sm:h-7 text-white" />
                        </div>
                        <div>
                          <h3 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white">
                            Bheem {current.name}
                          </h3>
                          <p className="text-white/60 text-xs sm:text-sm">Productivity Suite</p>
                        </div>
                      </motion.div>
                    </div>

                    {/* Floating badge */}
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.3 }}
                      className="px-2.5 sm:px-4 py-1 sm:py-2 rounded-full bg-white/20 backdrop-blur-sm text-white text-xs sm:text-sm font-medium"
                    >
                      Premium
                    </motion.div>
                  </div>

                  {/* Description */}
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.25 }}
                    className="text-base sm:text-xl text-white/90 mb-5 sm:mb-8 leading-relaxed"
                  >
                    {current.description}
                  </motion.p>

                  {/* Features Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 mb-5 sm:mb-8">
                    {current.features.map((feature, i) => (
                      <motion.div
                        key={feature}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 + i * 0.1 }}
                        className="flex items-center gap-2 sm:gap-3 p-2.5 sm:p-4 rounded-xl sm:rounded-2xl bg-white/10 backdrop-blur-sm"
                      >
                        <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-md sm:rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
                          <Check size={12} className="sm:w-4 sm:h-4 text-white" />
                        </div>
                        <span className="text-white font-medium text-sm sm:text-base">{feature}</span>
                      </motion.div>
                    ))}
                  </div>

                  {/* CTA Button */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                  >
                    <Link
                      href={`/${current.name.toLowerCase()}`}
                      className="inline-flex items-center gap-2 sm:gap-3 px-5 sm:px-8 py-3 sm:py-4 bg-white text-gray-900 rounded-xl sm:rounded-2xl font-semibold text-sm sm:text-base hover:shadow-xl hover:shadow-black/20 transition-all duration-300 group"
                    >
                      <span>Get Started with {current.name}</span>
                      <ArrowRight size={16} className="sm:w-5 sm:h-5 group-hover:translate-x-1 transition-transform" />
                    </Link>
                  </motion.div>
                </div>
              </div>

              {/* Decorative floating elements - Hidden on mobile */}
              <motion.div
                className="absolute -top-4 -right-4 sm:-top-6 sm:-right-6 w-16 h-16 sm:w-24 sm:h-24 rounded-xl sm:rounded-2xl bg-white shadow-xl shadow-gray-200/50 items-center justify-center hidden sm:flex"
                initial={{ opacity: 0, scale: 0, rotate: -10 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                transition={{ delay: 0.4, type: 'spring' }}
              >
                <div className={`w-8 h-8 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-gradient-to-br ${BRAND_GRADIENT} flex items-center justify-center`}>
                  <Sparkles size={16} className="sm:w-6 sm:h-6 text-white" />
                </div>
              </motion.div>

              <motion.div
                className="absolute -bottom-3 -left-3 sm:-bottom-4 sm:-left-4 w-14 h-14 sm:w-20 sm:h-20 rounded-xl sm:rounded-2xl bg-white shadow-xl shadow-gray-200/50 items-center justify-center hidden sm:flex"
                initial={{ opacity: 0, scale: 0, rotate: 10 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                transition={{ delay: 0.5, type: 'spring' }}
              >
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#977DFF] to-[#0033FF] flex items-center justify-center">
                  <Shield size={20} className="text-white" />
                </div>
              </motion.div>
            </motion.div>
          </AnimatePresence>

          {/* Bottom stats bar */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="mt-5 sm:mt-8 grid grid-cols-3 gap-2 sm:gap-4 relative z-10"
          >
            {[
              { label: 'Active Users', value: '2M+' },
              { label: 'Uptime', value: '99.9%' },
              { label: 'Support', value: '24/7' },
            ].map((stat, i) => (
              <div key={stat.label} className="text-center p-2.5 sm:p-4 rounded-xl sm:rounded-2xl bg-white/80 backdrop-blur-sm border border-gray-100 shadow-lg shadow-gray-100/50">
                <div className="text-lg sm:text-2xl font-bold text-gray-900">{stat.value}</div>
                <div className="text-[10px] sm:text-sm text-gray-500">{stat.label}</div>
              </div>
            ))}
          </motion.div>

          {/* Security Badge - Stacked on mobile */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="mt-4 sm:mt-6 flex flex-wrap items-center justify-center gap-3 sm:gap-6 relative z-10"
          >
            <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-gray-500">
              <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-gradient-to-br from-[#FFCCF2] to-[#977DFF] flex items-center justify-center">
                <Shield size={10} className="sm:w-3 sm:h-3 text-white" />
              </div>
              <span>256-bit Encryption</span>
            </div>
            <div className="w-1 h-1 rounded-full bg-gray-300 hidden sm:block" />
            <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-gray-500">
              <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-gradient-to-br from-[#977DFF] to-[#0033FF] flex items-center justify-center">
                <Lock size={10} className="sm:w-3 sm:h-3 text-white" />
              </div>
              <span>SOC 2 Certified</span>
            </div>
            <div className="w-1 h-1 rounded-full bg-gray-300 hidden sm:block" />
            <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-gray-500">
              <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-gradient-to-br from-[#0033FF] to-[#977DFF] flex items-center justify-center">
                <Globe size={10} className="sm:w-3 sm:h-3 text-white" />
              </div>
              <span>GDPR Compliant</span>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

// How It Works Carousel
function HowItWorksCarousel() {
  const [activeStep, setActiveStep] = useState(0);
  const steps = [
    { step: '01', title: 'Sign Up Free', description: 'Create your workspace in under 2 minutes. No credit card required. Just enter your email and get started instantly.', icon: Rocket },
    { step: '02', title: 'Invite Your Team', description: 'Add team members with a single click. They get instant access to all apps and can start collaborating immediately.', icon: Users },
    { step: '03', title: 'Start Collaborating', description: 'Use AI-powered tools to communicate, create documents, schedule meetings, and get things done faster than ever.', icon: Sparkles },
  ];

  useEffect(() => {
    const interval = setInterval(() => setActiveStep((prev) => (prev + 1) % steps.length), 4000);
    return () => clearInterval(interval);
  }, [steps.length]);

  return (
    <div className="relative rounded-3xl bg-white/80 backdrop-blur-sm p-8 lg:p-12 border border-gray-100 shadow-xl overflow-hidden">
      <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
        {/* Left - Content */}
        <div>
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#FFCCF2]/20 text-[#977DFF] text-sm font-medium mb-6">
            <Target size={16} />
            How It Works
          </span>
          <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-6">
            Get started in{' '}
            <span className="bg-gradient-to-r from-[#977DFF] to-[#0033FF] bg-clip-text text-transparent">3 steps</span>
          </h2>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeStep}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="mb-8"
            >
              <p className="text-lg text-gray-600 leading-relaxed">{steps[activeStep].description}</p>
            </motion.div>
          </AnimatePresence>

          <Link href="/login?mode=signup" className="inline-flex items-center gap-2 px-6 py-3 bg-gray-900 rounded-xl text-white font-semibold hover:bg-gray-800 transition-colors">
            Start Free Now <ArrowRight size={18} />
          </Link>
        </div>

        {/* Right - Steps */}
        <div className="space-y-4">
          {steps.map((item, i) => (
            <motion.div
              key={i}
              onClick={() => setActiveStep(i)}
              className={`relative p-6 rounded-2xl cursor-pointer transition-all duration-300 ${activeStep === i ? 'bg-gradient-to-r from-[#FFCCF2]/20 to-[#977DFF]/20 shadow-lg' : 'bg-gray-50 hover:bg-gray-100'}`}
              whileHover={{ x: activeStep === i ? 0 : 8 }}
            >
              <div className="flex items-start gap-4">
                <div className={`flex-shrink-0 w-14 h-14 rounded-xl flex items-center justify-center transition-all ${activeStep === i ? 'bg-gradient-to-br from-[#FFCCF2] to-[#977DFF] shadow-lg' : 'bg-gray-200'}`}>
                  <span className={`font-bold text-lg ${activeStep === i ? 'text-white' : 'text-gray-500'}`}>{item.step}</span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <item.icon size={18} className={activeStep === i ? 'text-[#977DFF]' : 'text-gray-400'} />
                    <h3 className="text-lg font-bold text-gray-900">{item.title}</h3>
                  </div>
                  <div className={`h-1 rounded-full mt-2 overflow-hidden ${activeStep === i ? 'bg-gray-200' : 'bg-transparent'}`}>
                    {activeStep === i && (
                      <motion.div
                        className="h-full bg-gradient-to-r from-[#FFCCF2] to-[#977DFF]"
                        initial={{ width: '0%' }}
                        animate={{ width: '100%' }}
                        transition={{ duration: 4, ease: 'linear' }}
                        key={`step-progress-${activeStep}`}
                      />
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Testimonials Carousel
function TestimonialsCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const testimonials = [
    { quote: "Bheem has transformed how our team collaborates. The AI features save us hours every week. It's like having an extra team member.", author: "Sarah Chen", role: "CTO, TechStart Inc", color: 'from-pink-400 to-rose-500', rating: 5 },
    { quote: "Finally, a workspace that just works. No more switching between apps constantly. Everything is connected and seamless.", author: "Michael Roberts", role: "Product Lead, Innovate Labs", color: 'from-blue-400 to-indigo-500', rating: 5 },
    { quote: "The meeting transcription and AI summaries are game changers. Our remote team has never been more aligned.", author: "Emily Watson", role: "CEO, Growth Agency", color: 'from-green-400 to-emerald-500', rating: 5 },
    { quote: "Best investment we made this year. Our productivity metrics went through the roof within the first month.", author: "David Kim", role: "VP Operations, Scale Corp", color: 'from-purple-400 to-violet-500', rating: 5 },
  ];

  useEffect(() => {
    const interval = setInterval(() => setCurrentIndex((prev) => (prev + 1) % testimonials.length), 5000);
    return () => clearInterval(interval);
  }, [testimonials.length]);

  const current = testimonials[currentIndex];

  return (
    <div className="relative rounded-3xl bg-gradient-to-br from-[#977DFF]/5 via-white to-[#FFCCF2]/5 p-8 lg:p-12 border border-gray-100 overflow-hidden">
      <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
        {/* Left - Content */}
        <div>
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#977DFF]/10 text-[#977DFF] text-sm font-medium mb-6">
            <Star size={16} className="fill-current" />
            Testimonials
          </span>
          <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-6">
            Loved by{' '}
            <span className="bg-gradient-to-r from-[#977DFF] to-[#0033FF] bg-clip-text text-transparent">teams worldwide</span>
          </h2>
          <div className="flex items-center gap-2 mb-4">
            {[...Array(5)].map((_, i) => (
              <Star key={i} size={24} className="text-amber-400 fill-current" />
            ))}
            <span className="ml-2 text-gray-600 font-medium">4.9/5 from 2,000+ reviews</span>
          </div>
          <FloatingAvatars />
        </div>

        {/* Right - Testimonial Card */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.4 }}
            className="bg-white rounded-2xl p-8 shadow-xl border border-gray-100"
          >
            <Quote size={32} className="text-[#977DFF]/20 mb-4" />
            <p className="text-lg text-gray-700 mb-6 leading-relaxed">{current.quote}</p>
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 rounded-full bg-gradient-to-br ${current.color} flex items-center justify-center text-white font-bold text-lg shadow-lg`}>
                {current.author.split(' ').map(n => n[0]).join('')}
              </div>
              <div>
                <div className="font-semibold text-gray-900">{current.author}</div>
                <div className="text-sm text-gray-500">{current.role}</div>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Dots */}
      <div className="flex justify-center gap-2 mt-8">
        {testimonials.map((_, i) => (
          <button key={i} onClick={() => setCurrentIndex(i)} className={`w-2 h-2 rounded-full transition-all ${currentIndex === i ? 'w-8 bg-[#977DFF]' : 'bg-gray-300 hover:bg-gray-400'}`} />
        ))}
      </div>
    </div>
  );
}

// Pricing Showcase
function PricingShowcase() {
  const [selectedPlan, setSelectedPlan] = useState(1);
  const plans = [
    { name: 'Starter', price: '999', period: '/user/month', description: 'Perfect for small teams', features: ['All Bheem Apps', '50 AI actions/month', '10 GB storage', 'Email support'] },
    { name: 'Professional', price: '2,499', period: '/user/month', description: 'For growing businesses', features: ['Everything in Starter', 'Unlimited AI actions', '100 GB storage', 'Priority support', 'API access'], popular: true },
    { name: 'Enterprise', price: 'Custom', period: '', description: 'For large organizations', features: ['Everything in Pro', 'Unlimited storage', 'Self-hosted option', 'Dedicated support'] },
  ];

  return (
    <div className="relative">
      <div className="text-center mb-12">
        <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#0033FF]/10 text-[#0033FF] text-sm font-medium mb-6">
          <Zap size={16} />
          Pricing
        </span>
        <h2 className="text-4xl lg:text-6xl font-bold text-gray-900 mb-4">
          Simple,{' '}
          <span className="bg-gradient-to-r from-[#977DFF] to-[#0033FF] bg-clip-text text-transparent">transparent</span>
          {' '}pricing
        </h2>
        <p className="text-xl text-gray-600">AI included in every plan. No hidden fees, ever.</p>
      </div>

      <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
        {plans.map((plan, i) => (
          <motion.div
            key={plan.name}
            onClick={() => setSelectedPlan(i)}
            className={`relative bg-white rounded-3xl p-8 border-2 cursor-pointer transition-all ${selectedPlan === i ? 'border-[#977DFF] shadow-xl shadow-purple-500/20 scale-105' : 'border-gray-100 hover:border-gray-200 hover:shadow-lg'}`}
            whileHover={{ y: -5 }}
          >
            {plan.popular && (
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-[#977DFF] to-[#0033FF] text-white text-sm font-semibold px-4 py-1.5 rounded-full shadow-lg">
                Most Popular
              </div>
            )}
            <h3 className="text-2xl font-bold text-gray-900 mb-1">{plan.name}</h3>
            <p className="text-sm text-gray-500 mb-4">{plan.description}</p>
            <div className="mb-6">
              <span className="text-4xl font-bold text-gray-900">{plan.price === 'Custom' ? '' : '₹'}{plan.price}</span>
              <span className="text-gray-500">{plan.period}</span>
            </div>
            <ul className="space-y-3 mb-8">
              {plan.features.map((f, j) => (
                <li key={j} className="flex items-center gap-2">
                  <Check size={18} className="text-green-500" />
                  <span className="text-gray-600">{f}</span>
                </li>
              ))}
            </ul>
            <Link
              href={plan.price === 'Custom' ? 'mailto:sales@bheem.cloud' : '/login?mode=signup'}
              className={`block text-center py-3 rounded-xl font-semibold transition-colors ${selectedPlan === i ? 'bg-gradient-to-r from-[#977DFF] to-[#0033FF] text-white' : 'bg-gray-100 text-gray-900 hover:bg-gray-200'}`}
            >
              {plan.price === 'Custom' ? 'Contact Sales' : 'Get Started'}
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// CTA Section
function CTASection() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.8 }}
      className="relative bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-3xl p-12 lg:p-16 overflow-hidden"
    >
      {/* Background */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 50, repeat: Infinity, ease: 'linear' }} className="absolute -top-40 -right-40 w-80 h-80 bg-[#977DFF]/20 rounded-full blur-3xl" />
        <motion.div animate={{ rotate: -360 }} transition={{ duration: 60, repeat: Infinity, ease: 'linear' }} className="absolute -bottom-40 -left-40 w-80 h-80 bg-[#0033FF]/20 rounded-full blur-3xl" />
      </div>

      <div className="relative grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <h2 className="text-3xl lg:text-5xl font-bold text-white mb-6">Ready to transform your workflow?</h2>
          <p className="text-lg text-gray-300 mb-8">Join thousands of teams already using Bheem. Start your free trial today—no credit card required.</p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Link href="/login?mode=signup" className="inline-flex items-center justify-center gap-2 bg-white text-gray-900 px-8 py-4 rounded-xl font-semibold hover:bg-gray-100 transition-colors">
              Start free trial <ArrowRight size={18} />
            </Link>
            <a href="mailto:sales@bheem.cloud" className="inline-flex items-center justify-center gap-2 border border-gray-600 text-white px-8 py-4 rounded-xl font-semibold hover:bg-white/10 transition-colors">
              Talk to sales
            </a>
          </div>
        </div>

        <div className="hidden lg:flex flex-col items-center">
          <FloatingAvatars className="scale-125 mb-6" />
          <div className="flex gap-2">
            {[...Array(5)].map((_, i) => (
              <Star key={i} size={24} className="text-amber-400 fill-current" />
            ))}
          </div>
          <p className="text-gray-400 mt-2">Rated 4.9/5 by 2,000+ teams</p>
        </div>
      </div>
    </motion.div>
  );
}

// ============================================
// END CAROUSEL COMPONENTS
// ============================================

// Sticky Section with Content Transitions
function StickyFeatureSection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"]
  });

  const features = [
    {
      title: 'Smart Email',
      subtitle: 'AI-powered inbox',
      description: 'Automatically categorize, prioritize, and draft responses with AI that learns your style.',
      icon: Mail,
      color: 'from-red-500 to-rose-600',
      image: '/mail-preview.png'
    },
    {
      title: 'Video Meetings',
      subtitle: 'Crystal clear calls',
      description: 'HD video with real-time transcription, AI summaries, and automatic action items.',
      icon: Video,
      color: 'from-green-500 to-emerald-600',
      image: '/meet-preview.png'
    },
    {
      title: 'Cloud Storage',
      subtitle: 'Secure & unlimited',
      description: 'Enterprise-grade encryption with smart search and seamless file sharing.',
      icon: HardDrive,
      color: 'from-amber-500 to-orange-600',
      image: '/drive-preview.png'
    },
  ];

  // Calculate which feature should be active based on scroll
  const activeIndex = useTransform(scrollYProgress, [0, 0.33, 0.66, 1], [0, 0, 1, 2]);

  return (
    <section ref={containerRef} className="relative bg-white" style={{ height: `${(features.length + 1) * 100}vh` }}>
      {/* Sticky Container */}
      <div className="sticky top-0 h-screen flex items-center overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 w-full">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left - Sticky Text Content */}
            <div className="relative">
              <motion.span
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#977DFF]/10 text-[#977DFF] text-sm font-medium mb-6"
              >
                <Zap size={16} />
                Powerful Features
              </motion.span>

              {features.map((feature, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 40 }}
                  animate={{
                    opacity: Math.abs(i - Math.round(scrollYProgress.get() * 2)) < 0.5 ? 1 : 0.3,
                    y: 0,
                  }}
                  className="mb-8"
                  style={{
                    display: i === 0 ? 'block' : 'none',
                    position: i === 0 ? 'relative' : 'absolute',
                  }}
                >
                  <div className="overflow-hidden mb-4">
                    <motion.h2
                      initial={{ y: '100%' }}
                      whileInView={{ y: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.6, delay: 0.1, ease: [0.25, 0.46, 0.45, 0.94] }}
                      className="text-4xl lg:text-6xl font-bold text-gray-900"
                    >
                      {feature.title}
                    </motion.h2>
                  </div>
                  <div className="overflow-hidden mb-6">
                    <motion.p
                      initial={{ y: '100%' }}
                      whileInView={{ y: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.6, delay: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
                      className="text-xl text-[#977DFF] font-medium"
                    >
                      {feature.subtitle}
                    </motion.p>
                  </div>
                  <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: 0.3 }}
                    className="text-lg text-gray-600 leading-relaxed"
                  >
                    {feature.description}
                  </motion.p>
                </motion.div>
              ))}

              {/* Progress Indicators */}
              <div className="flex gap-2 mt-8">
                {features.map((_, i) => (
                  <motion.div
                    key={i}
                    className="h-1 rounded-full bg-gray-200 overflow-hidden"
                    style={{ width: 60 }}
                  >
                    <motion.div
                      className="h-full bg-gradient-to-r from-[#977DFF] to-[#0033FF] rounded-full"
                      style={{
                        scaleX: useTransform(
                          scrollYProgress,
                          [i * 0.33, (i + 1) * 0.33],
                          [0, 1]
                        ),
                        transformOrigin: 'left',
                      }}
                    />
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Right - Sliding Feature Cards */}
            <div className="relative h-[500px]">
              {features.map((feature, i) => {
                const yOffset = useTransform(
                  scrollYProgress,
                  [
                    Math.max(0, (i - 1) * 0.33),
                    i * 0.33,
                    (i + 1) * 0.33,
                    Math.min(1, (i + 2) * 0.33)
                  ],
                  ['100%', '0%', '0%', '-100%']
                );
                const opacity = useTransform(
                  scrollYProgress,
                  [
                    Math.max(0, (i - 0.5) * 0.33),
                    i * 0.33,
                    (i + 0.5) * 0.33,
                    (i + 1) * 0.33
                  ],
                  [0, 1, 1, 0]
                );

                return (
                  <motion.div
                    key={i}
                    style={{ y: yOffset, opacity }}
                    className="absolute inset-0 flex items-center justify-center"
                  >
                    <div className="relative w-full max-w-md">
                      {/* Card Background */}
                      <div className={`absolute inset-0 bg-gradient-to-br ${feature.color} rounded-3xl opacity-10 blur-2xl`} />

                      {/* Card */}
                      <div className="relative bg-white rounded-3xl border border-gray-100 shadow-2xl p-8 overflow-hidden">
                        {/* Icon */}
                        <div className={`w-16 h-16 bg-gradient-to-br ${feature.color} rounded-2xl flex items-center justify-center mb-6 shadow-lg`}>
                          <feature.icon size={32} className="text-white" />
                        </div>

                        {/* Mock UI */}
                        <div className="space-y-3">
                          <div className="h-3 bg-gray-100 rounded-full w-3/4" />
                          <div className="h-3 bg-gray-100 rounded-full w-full" />
                          <div className="h-3 bg-gray-100 rounded-full w-2/3" />
                        </div>

                        {/* Floating Badge */}
                        <motion.div
                          initial={{ scale: 0, rotate: -12 }}
                          whileInView={{ scale: 1, rotate: -6 }}
                          viewport={{ once: true }}
                          className="absolute -top-2 -right-2 bg-gradient-to-r from-[#FFCCF2] to-[#977DFF] text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg"
                        >
                          AI-Powered
                        </motion.div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default function LandingPage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const allApps = [
    { name: 'Mail', icon: Mail, color: 'from-red-400 to-rose-500' },
    { name: 'Docs', icon: FileText, color: 'from-blue-400 to-indigo-500' },
    { name: 'Meet', icon: Video, color: 'from-green-400 to-emerald-500' },
    { name: 'Calendar', icon: Calendar, color: 'from-purple-400 to-violet-500' },
    { name: 'Drive', icon: HardDrive, color: 'from-yellow-400 to-orange-500' },
    { name: 'Sheets', icon: Table, color: 'from-emerald-400 to-teal-500' },
    { name: 'Slides', icon: Presentation, color: 'from-amber-400 to-yellow-500' },
    { name: 'Chat', icon: MessageCircle, color: 'from-cyan-400 to-blue-500' },
  ];

  return (
    <>
      <Head>
        <title>Bheem Workspace | AI-Powered Productivity Suite</title>
        <meta name="description" content="Email, Docs, Meetings—all in one place with AI built-in. The modern workspace for productive teams." />
      </Head>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />

      <div className="min-h-screen bg-white overflow-x-hidden">
        {/* Static Background Gradients */}
        <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-[#FFCCF2]/5 via-white to-[#977DFF]/5" />
          <div className="absolute top-[-10%] right-[-5%] w-[600px] h-[600px] bg-[#977DFF]/10 rounded-full blur-[150px]" />
          <div className="absolute bottom-[-10%] left-[-5%] w-[500px] h-[500px] bg-[#FFCCF2]/15 rounded-full blur-[150px]" />
          <div className="absolute top-[40%] left-[50%] w-[400px] h-[400px] bg-[#0033FF]/5 rounded-full blur-[100px]" />
        </div>

        {/* Navigation */}
        <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-14 sm:h-16">
              <Link href="/" className="flex items-center gap-2 sm:gap-3">
                <motion.div
                  whileHover={{ rotate: 10, scale: 1.1 }}
                  className="w-8 sm:w-10 h-8 sm:h-10 bg-gradient-to-br from-[#FFCCF2] via-[#977DFF] to-[#0033FF] rounded-lg sm:rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/25"
                >
                  <span className="text-white font-black text-base sm:text-lg">B</span>
                </motion.div>
                <span className="text-lg sm:text-xl font-bold text-gray-900">Bheem</span>
              </Link>

              <div className="hidden md:flex items-center gap-1">
                {['Features', 'Apps', 'Pricing', 'Reviews'].map((item) => (
                  <a key={item} href={`#${item.toLowerCase()}`} className="text-sm text-gray-600 hover:text-gray-900 px-4 py-2 rounded-lg hover:bg-gray-100 transition-all">
                    {item}
                  </a>
                ))}
              </div>

              <div className="flex items-center gap-2 sm:gap-3">
                <Link href="/login" className="text-xs sm:text-sm text-gray-600 hover:text-gray-900 px-2 sm:px-4 py-2 transition-colors hidden sm:block">Sign in</Link>
                <Link href="/login?mode=signup" className="text-xs sm:text-sm bg-gradient-to-r from-[#977DFF] to-[#0033FF] text-white px-3 sm:px-5 py-2 sm:py-2.5 rounded-lg sm:rounded-xl font-medium hover:shadow-lg hover:shadow-purple-500/25 transition-all">
                  Get started
                </Link>
              </div>
            </div>
          </div>
        </nav>

        {/* Hero Section - Fades out on scroll */}
        <HeroWithFade>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 sm:gap-12 lg:gap-16 items-center">
              {/* Left Column - Content (subtle fade from left) */}
              <motion.div
                initial={{ opacity: 0, x: -24 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
                className="order-2 lg:order-1"
              >
                {/* Floating Avatars */}
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
                  className="flex mb-6"
                >
                  <FloatingAvatars />
                </motion.div>

                {/* Badge */}
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-[#FFCCF2]/20 to-[#977DFF]/20 border border-[#977DFF]/20 mb-6"
                >
                  <span className="w-2 h-2 bg-gradient-to-r from-[#FFCCF2] to-[#977DFF] rounded-full" />
                  <span className="text-sm font-medium text-[#977DFF]">Trusted by 50,000+ teams worldwide</span>
                </motion.div>

                {/* Headline */}
                <motion.h1
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4, duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
                  className="text-4xl lg:text-6xl font-bold leading-[1.1] mb-6 text-gray-900"
                >
                  Your complete{' '}
                  <span className="relative inline-block">
                    <span className="bg-gradient-to-r from-[#FFCCF2] via-[#977DFF] to-[#0033FF] bg-clip-text text-transparent">
                      workspace suite
                    </span>
                    <motion.svg
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ delay: 1, duration: 1 }}
                      className="absolute -bottom-2 left-0 w-full h-3"
                      viewBox="0 0 200 10"
                    >
                      <motion.path
                        d="M0 5 Q50 0, 100 5 T200 5"
                        fill="none"
                        stroke="url(#underline-gradient)"
                        strokeWidth="3"
                        strokeLinecap="round"
                      />
                      <defs>
                        <linearGradient id="underline-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#FFCCF2" />
                          <stop offset="50%" stopColor="#977DFF" />
                          <stop offset="100%" stopColor="#0033FF" />
                        </linearGradient>
                      </defs>
                    </motion.svg>
                  </span>
                </motion.h1>

                <motion.p
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
                  className="text-lg lg:text-xl text-gray-600 mb-8 leading-relaxed"
                >
                  Mail, Docs, Meet, Calendar, Drive, and more—all powered by AI.
                  One platform, one price, unlimited productivity.
                </motion.p>

                {/* CTAs */}
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
                  className="flex flex-col sm:flex-row gap-4 mb-8"
                >
                  <Link href="/login?mode=signup" className="group inline-flex items-center justify-center gap-2 bg-gradient-to-r from-[#977DFF] to-[#0033FF] text-white px-8 py-4 rounded-2xl font-semibold text-lg transition-all hover:shadow-xl hover:shadow-purple-500/25 hover:scale-[1.02]">
                    Start free trial
                    <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                  </Link>
                  <a href="#demo" className="inline-flex items-center justify-center gap-2 bg-white border-2 border-gray-200 text-gray-900 px-8 py-4 rounded-2xl font-semibold text-lg hover:border-[#977DFF] hover:bg-[#977DFF]/5 transition-all">
                    <Play size={20} className="text-[#977DFF]" />
                    Watch demo
                  </a>
                </motion.div>

                {/* Trust Badges - Staggered */}
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
                  className="flex flex-wrap items-center gap-6 text-sm text-gray-500"
                >
                  {['14-day free trial', 'No credit card required', 'Cancel anytime'].map((text, i) => (
                    <motion.span
                      key={i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.75 + i * 0.08, duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
                      className="flex items-center gap-2"
                    >
                      <Check size={16} className="text-green-500" />
                      {text}
                    </motion.span>
                  ))}
                </motion.div>

                {/* App Icons Row - Staggered Fade Up */}
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.85, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
                  className="flex flex-wrap gap-3 mt-8 pt-8 border-t border-gray-100"
                >
                  <span className="text-xs text-gray-400 w-full mb-2">All apps included:</span>
                  {allApps.slice(0, 6).map((app, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.9 + i * 0.06, duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
                      whileHover={{ y: -4 }}
                      className={`w-10 h-10 bg-gradient-to-br ${app.color} rounded-xl flex items-center justify-center shadow-md cursor-pointer transition-transform`}
                      title={app.name}
                    >
                      <app.icon size={20} className="text-white" />
                    </motion.div>
                  ))}
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 1.26, duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
                    className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center text-xs font-semibold text-gray-500"
                  >
                    +{allApps.length - 6}
                  </motion.div>
                </motion.div>
              </motion.div>

              {/* Right Column - Subtle fade from right */}
              <motion.div
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
                className="order-1 lg:order-2 relative"
              >
                <HeroVisualSection />
              </motion.div>
            </div>
          </div>
        </HeroWithFade>

        {/* Section 1: Features Carousel - Like Meet */}
        <section className="relative z-10 py-12 sm:py-20 lg:py-32 bg-white overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <FeaturesShowcase />
          </div>
        </section>

        {/* Section 2: Stats with Animated Illustration */}
        <section className="relative z-10 py-12 sm:py-20 lg:py-32 bg-gradient-to-br from-[#FFCCF2]/10 via-white to-[#977DFF]/10 overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <StatsCarousel />
          </div>
        </section>

        {/* Section 3: Apps Showcase Carousel */}
        <section id="features" className="relative z-10 py-12 sm:py-20 lg:py-32 bg-white overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <AppsShowcase />
          </div>
        </section>

        {/* Section 4: How It Works - Interactive Steps */}
        <section className="relative z-10 py-12 sm:py-20 lg:py-32 bg-gradient-to-br from-[#977DFF]/10 via-white to-[#0033FF]/10 overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <HowItWorksCarousel />
          </div>
        </section>

        {/* Section 5: Testimonials Carousel */}
        <section id="reviews" className="relative z-10 py-12 sm:py-20 lg:py-32 bg-white overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <TestimonialsCarousel />
          </div>
        </section>

        {/* Section 6: Pricing Showcase */}
        <section id="pricing" className="relative z-10 py-12 sm:py-20 lg:py-32 bg-gradient-to-br from-[#FFCCF2]/10 via-white to-[#977DFF]/10 overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <PricingShowcase />
          </div>
        </section>

        {/* Section 7: Final CTA with Animation */}
        <section className="relative z-10 py-12 sm:py-20 lg:py-32 bg-white overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <CTASection />
          </div>
        </section>

        {/* Footer */}
        <footer className="relative z-10 border-t border-gray-100 py-10 sm:py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
              <div className="col-span-2">
                <Link href="/" className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-gradient-to-br from-[#FFCCF2] via-[#977DFF] to-[#0033FF] rounded-xl flex items-center justify-center">
                    <span className="text-white font-black">B</span>
                  </div>
                  <span className="text-xl font-bold text-gray-900">Bheem</span>
                </Link>
                <p className="text-gray-500 text-sm max-w-xs mb-6">
                  The all-in-one workspace for modern teams. Email, docs, meetings, and AI—together at last.
                </p>
                <FloatingAvatars />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-4">Apps</h4>
                <ul className="space-y-2 text-sm text-gray-500">
                  {['Mail', 'Docs', 'Meet', 'Calendar', 'Drive'].map(app => (
                    <li key={app}><a href={`/${app.toLowerCase()}`} className="hover:text-[#977DFF] transition-colors">{app}</a></li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-4">Resources</h4>
                <ul className="space-y-2 text-sm text-gray-500">
                  {['Documentation', 'API Reference', 'Blog', 'Help Center'].map(item => (
                    <li key={item}><a href="#" className="hover:text-[#977DFF] transition-colors">{item}</a></li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-4">Company</h4>
                <ul className="space-y-2 text-sm text-gray-500">
                  {['About', 'Contact', 'Privacy', 'Terms'].map(item => (
                    <li key={item}><a href="#" className="hover:text-[#977DFF] transition-colors">{item}</a></li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="pt-8 border-t border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
              <p className="text-gray-500 text-sm">© 2024 Bheem Cloud. All rights reserved.</p>
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-lg text-xs text-gray-600">
                  <Shield size={12} />SOC 2
                </span>
                <span className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-lg text-xs text-gray-600">
                  <Lock size={12} />GDPR
                </span>
                <span className="flex items-center gap-2 text-sm text-gray-500">
                  Made with <Heart size={14} className="text-red-500 fill-red-500" /> in India
                </span>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
