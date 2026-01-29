/**
 * Bheem Mail Compose Modal
 * Enhanced with Contact Autocomplete, Schedule Send, and Templates
 * Updated with brand colors and modern design
 */
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Minus,
  Maximize2,
  Minimize2,
  Paperclip,
  Image,
  Link,
  Smile,
  Send,
  Trash2,
  ChevronDown,
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  AlignLeft,
  Code,
  Clock,
  FileText,
  MoreHorizontal,
  Sparkles,
  Wand2,
  CheckCircle,
  Lightbulb,
  Loader2,
  Lock,
  Shield,
  Ban,
  Download,
  Copy,
  Forward,
  Printer,
  Timer,
  Key,
} from 'lucide-react';
import { useMailStore } from '@/stores/mailStore';
import { useCredentialsStore } from '@/stores/credentialsStore';
import ContactAutocomplete from './ContactAutocomplete';
import ScheduleSendModal from './ScheduleSendModal';
import * as mailApi from '@/lib/mailApi';
import type { ComposeEmail } from '@/types/mail';

// Brand Colors
const BRAND = {
  pink: '#FFCCF2',
  purple: '#977DFF',
  blue: '#0033FF',
  gradient: 'from-[#FFCCF2] via-[#977DFF] to-[#0033FF]',
};

interface ComposeModalProps {
  onClose: () => void;
}

export default function ComposeModal({ onClose }: ComposeModalProps) {
  const { composeData, updateComposeData, sendEmail, loading } = useMailStore();
  const { getMailCredentials } = useCredentialsStore();

  const [isMinimized, setIsMinimized] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [toEmails, setToEmails] = useState<string[]>([]);
  const [ccEmails, setCcEmails] = useState<string[]>([]);
  const [bccEmails, setBccEmails] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [showSchedule, setShowSchedule] = useState(false);
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);
  const [signatures, setSignatures] = useState<any[]>([]);
  const [selectedSignature, setSelectedSignature] = useState<string | null>(null);
  const [sendWithUndo, setSendWithUndo] = useState(true);
  const [undoDelay, setUndoDelay] = useState(5);

  // AI Features state
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiTone, setAiTone] = useState('professional');
  const [showToneMenu, setShowToneMenu] = useState(false);
  const [showSubjectSuggestions, setShowSubjectSuggestions] = useState(false);
  const [subjectSuggestions, setSubjectSuggestions] = useState<string[]>([]);

  // Confidential Mode state
  const [showConfidentialPanel, setShowConfidentialPanel] = useState(false);
  const [confidentialEnabled, setConfidentialEnabled] = useState(false);
  const [confidentialSettings, setConfidentialSettings] = useState({
    expiresInHours: 168, // 1 week default
    passcodeType: 'none' as 'sms' | 'email' | 'none',
    passcode: '',
    noForward: true,
    noCopy: false,
    noPrint: false,
    noDownload: false,
  });

  const bodyRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [bodyContent, setBodyContent] = useState('');
  const [bodyInitialized, setBodyInitialized] = useState(false);

  // Initialize with prefill data
  useEffect(() => {
    if (composeData.to) {
      setToEmails(composeData.to);
    }
    if (composeData.cc && composeData.cc.length > 0) {
      setCcEmails(composeData.cc);
      setShowCc(true);
    }
    if (composeData.bcc && composeData.bcc.length > 0) {
      setBccEmails(composeData.bcc);
      setShowBcc(true);
    }

    // Initialize body content only once
    if (!bodyInitialized) {
      let initialBody = composeData.body || '';
      if (!initialBody && composeData.originalEmail) {
        initialBody = `<br><br><div style="border-left: 2px solid #977DFF; padding-left: 12px; margin-left: 0;">
          <p style="color: #666; font-size: 12px;">On ${new Date(composeData.originalEmail.date).toLocaleString()}, ${composeData.originalEmail.from.name || composeData.originalEmail.from.email} wrote:</p>
          ${composeData.originalEmail.bodyHtml || composeData.originalEmail.body}
        </div>`;
      }
      setBodyContent(initialBody);
      setBodyInitialized(true);

      // Set initial content to the contentEditable div
      if (bodyRef.current) {
        bodyRef.current.innerHTML = initialBody;
      }
    }
  }, [composeData, bodyInitialized]);

  // Set initial body content when ref becomes available
  useEffect(() => {
    if (bodyRef.current && bodyContent && !bodyRef.current.innerHTML) {
      bodyRef.current.innerHTML = bodyContent;
    }
  }, [bodyContent]);

  // Fetch templates and signatures
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [templatesRes, signaturesRes] = await Promise.all([
          mailApi.listTemplates(),
          mailApi.listSignatures(),
        ]);
        setTemplates(templatesRes.templates || []);
        setSignatures(signaturesRes.signatures || []);

        // Set default signature
        const defaultSig = signaturesRes.signatures?.find((s: any) => s.is_default);
        if (defaultSig && !composeData.originalEmail) {
          setSelectedSignature(defaultSig.id);
          // Append signature to body
          if (bodyRef.current && defaultSig.content) {
            bodyRef.current.innerHTML += `<br><br>${defaultSig.content}`;
          }
        }
      } catch (error) {
        console.error('Failed to fetch templates/signatures:', error);
      }
    };
    fetchData();
  }, []);

  const handleSend = async () => {
    if (toEmails.length === 0) {
      alert('Please enter at least one recipient');
      return;
    }

    // Get the latest body content from the ref
    const currentBody = bodyRef.current?.innerHTML || bodyContent || '';

    const email: ComposeEmail = {
      to: toEmails,
      cc: ccEmails.length > 0 ? ccEmails : undefined,
      bcc: bccEmails.length > 0 ? bccEmails : undefined,
      subject: composeData.subject || '',
      body: currentBody,
      isHtml: true,
      attachments: attachments.length > 0 ? attachments : undefined,
      inReplyTo: composeData.inReplyTo,
      references: composeData.references,
      // Confidential mode settings
      confidential: confidentialEnabled ? {
        enabled: true,
        expiresInHours: confidentialSettings.expiresInHours,
        passcode: confidentialSettings.passcode || undefined,
        passcodeType: confidentialSettings.passcodeType,
        noForward: confidentialSettings.noForward,
        noCopy: confidentialSettings.noCopy,
        noPrint: confidentialSettings.noPrint,
        noDownload: confidentialSettings.noDownload,
      } : undefined,
    };

    if (sendWithUndo) {
      // Send with undo capability
      try {
        const result = await mailApi.sendEmailWithUndo({
          to: email.to,
          cc: email.cc,
          bcc: email.bcc,
          subject: email.subject,
          body: email.body,
          is_html: email.isHtml,
          delay_seconds: undoDelay,
          attachments: attachments.length > 0 ? attachments : undefined,
        });
        // Show undo toast
        if ((window as any).showUndoSendToast) {
          (window as any).showUndoSendToast(
            result.queue_id,
            toEmails[0],
            undoDelay
          );
        }
        onClose();
      } catch (error) {
        console.error('Failed to send email:', error);
        alert('Failed to send email');
      }
    } else {
      const success = await sendEmail(email);
      if (success) {
        onClose();
      }
    }
  };

  const handleScheduleSend = async (scheduledTime: Date) => {
    if (toEmails.length === 0) {
      alert('Please enter at least one recipient');
      return;
    }

    const currentBody = bodyRef.current?.innerHTML || bodyContent || '';

    try {
      await mailApi.scheduleEmail({
        to: toEmails,
        cc: ccEmails.length > 0 ? ccEmails : undefined,
        bcc: bccEmails.length > 0 ? bccEmails : undefined,
        subject: composeData.subject || '',
        body: currentBody,
        is_html: true,
        scheduled_at: scheduledTime.toISOString(),
      });
      setShowSchedule(false);
      onClose();
    } catch (error) {
      console.error('Failed to schedule email:', error);
      alert('Failed to schedule email');
    }
  };

  const handleAttachment = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setAttachments((prev) => [...prev, ...files]);
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const formatText = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    bodyRef.current?.focus();
  };

  const applyTemplate = (template: any) => {
    updateComposeData({ subject: template.subject });
    if (bodyRef.current) {
      bodyRef.current.innerHTML = template.body;
    }
    setShowTemplates(false);
  };

  // AI Functions
  const handleAICompose = async () => {
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    try {
      const result = await mailApi.aiComposeEmail(aiPrompt, aiTone);
      updateComposeData({ subject: result.subject });
      if (bodyRef.current) {
        bodyRef.current.innerHTML = result.body;
        setBodyContent(result.body);
      }
      setShowAIPanel(false);
      setAiPrompt('');
    } catch (error) {
      console.error('AI compose failed:', error);
      alert('Failed to generate email. Please try again.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleAIRewrite = async (tone: string) => {
    const currentBody = bodyRef.current?.innerHTML || bodyContent;
    if (!currentBody.trim()) {
      alert('Please write some content first');
      return;
    }
    setAiLoading(true);
    setShowToneMenu(false);
    try {
      const result = await mailApi.aiRewriteEmail(currentBody, tone);
      if (bodyRef.current) {
        bodyRef.current.innerHTML = result.body;
        setBodyContent(result.body);
      }
    } catch (error) {
      console.error('AI rewrite failed:', error);
      alert('Failed to rewrite email. Please try again.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleGenerateSubjects = async () => {
    const currentBody = bodyRef.current?.innerHTML || bodyContent;
    if (!currentBody.trim()) {
      alert('Please write some content first');
      return;
    }
    setAiLoading(true);
    try {
      const result = await mailApi.aiGenerateSubjects(currentBody, 3);
      setSubjectSuggestions(result.subjects || []);
      setShowSubjectSuggestions(true);
    } catch (error) {
      console.error('Failed to generate subjects:', error);
      alert('Failed to generate subject suggestions.');
    } finally {
      setAiLoading(false);
    }
  };

  const credentials = getMailCredentials();

  // Modal size classes
  const sizeClasses = isMaximized
    ? 'fixed inset-4 m-0'
    : isMinimized
    ? 'fixed bottom-4 right-4 w-80 h-12'
    : 'fixed bottom-4 right-4 w-full max-w-[650px] h-[550px] mx-4 sm:mx-0';

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        className={`${sizeClasses} bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col z-50 overflow-hidden`}
      >
        {/* Header */}
        <div className={`flex items-center justify-between px-4 py-3 bg-gradient-to-r ${BRAND.gradient} text-white cursor-move`}>
          <span className="font-medium text-sm truncate">
            {composeData.subject || 'New Message'}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
            >
              <Minus size={16} />
            </button>
            <button
              onClick={() => setIsMaximized(!isMaximized)}
              className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
            >
              {isMaximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-red-500/50 rounded-lg transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Content - hidden when minimized */}
        <AnimatePresence>
          {!isMinimized && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="flex-1 flex flex-col overflow-hidden"
            >
              {/* Recipients */}
              <div className="flex-shrink-0 border-b border-gray-200">
                {/* To */}
                <div className="flex items-center px-4 py-2.5 border-b border-gray-100">
                  <span className="text-sm text-gray-500 w-12">To</span>
                  <div className="flex-1">
                    <ContactAutocomplete
                      value={toEmails}
                      onChange={setToEmails}
                      placeholder="Recipients"
                    />
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-500 ml-2">
                    {!showCc && (
                      <button
                        onClick={() => setShowCc(true)}
                        className="hover:text-[#977DFF] transition-colors"
                      >
                        Cc
                      </button>
                    )}
                    {!showBcc && (
                      <button
                        onClick={() => setShowBcc(true)}
                        className="hover:text-[#977DFF] transition-colors"
                      >
                        Bcc
                      </button>
                    )}
                  </div>
                </div>

                {/* Cc */}
                <AnimatePresence>
                  {showCc && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="flex items-center px-4 py-2.5 border-b border-gray-100 overflow-hidden"
                    >
                      <span className="text-sm text-gray-500 w-12">Cc</span>
                      <div className="flex-1">
                        <ContactAutocomplete
                          value={ccEmails}
                          onChange={setCcEmails}
                          placeholder="Cc recipients"
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Bcc */}
                <AnimatePresence>
                  {showBcc && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="flex items-center px-4 py-2.5 border-b border-gray-100 overflow-hidden"
                    >
                      <span className="text-sm text-gray-500 w-12">Bcc</span>
                      <div className="flex-1">
                        <ContactAutocomplete
                          value={bccEmails}
                          onChange={setBccEmails}
                          placeholder="Bcc recipients"
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Subject */}
                <div className="flex items-center px-4 py-2.5">
                  <span className="text-sm text-gray-500 w-12">Subject</span>
                  <input
                    type="text"
                    value={composeData.subject || ''}
                    onChange={(e) => updateComposeData({ subject: e.target.value })}
                    placeholder="Subject"
                    className="flex-1 px-2 py-1 text-sm border-0 focus:ring-0 focus:outline-none bg-transparent"
                  />
                </div>
              </div>

              {/* Formatting Toolbar */}
              <div className="flex-shrink-0 flex items-center gap-1 px-4 py-2 border-b border-gray-100 bg-gray-50/50">
                <button
                  onClick={() => formatText('bold')}
                  className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors"
                  title="Bold (Ctrl+B)"
                >
                  <Bold size={16} className="text-gray-600" />
                </button>
                <button
                  onClick={() => formatText('italic')}
                  className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors"
                  title="Italic (Ctrl+I)"
                >
                  <Italic size={16} className="text-gray-600" />
                </button>
                <button
                  onClick={() => formatText('underline')}
                  className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors"
                  title="Underline (Ctrl+U)"
                >
                  <Underline size={16} className="text-gray-600" />
                </button>
                <div className="w-px h-5 bg-gray-300 mx-1" />
                <button
                  onClick={() => formatText('insertUnorderedList')}
                  className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors"
                  title="Bullet list"
                >
                  <List size={16} className="text-gray-600" />
                </button>
                <button
                  onClick={() => formatText('insertOrderedList')}
                  className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors"
                  title="Numbered list"
                >
                  <ListOrdered size={16} className="text-gray-600" />
                </button>
                <div className="w-px h-5 bg-gray-300 mx-1" />
                <button
                  onClick={() => {
                    const url = prompt('Enter URL:');
                    if (url) formatText('createLink', url);
                  }}
                  className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors"
                  title="Insert link"
                >
                  <Link size={16} className="text-gray-600" />
                </button>
                <div className="flex-1" />

                {/* AI Features */}
                <div className="flex items-center gap-1 mr-2">
                  {/* AI Compose */}
                  <button
                    onClick={() => setShowAIPanel(!showAIPanel)}
                    className={`flex items-center gap-1 px-2.5 py-1.5 text-sm rounded-lg transition-colors ${
                      showAIPanel ? 'bg-[#977DFF]/20 text-[#977DFF]' : 'text-gray-600 hover:bg-gray-200'
                    }`}
                    title="AI Compose"
                  >
                    <Sparkles size={16} />
                    <span className="hidden sm:inline">AI</span>
                  </button>

                  {/* AI Rewrite/Tone */}
                  <div className="relative">
                    <button
                      onClick={() => setShowToneMenu(!showToneMenu)}
                      disabled={aiLoading}
                      className="flex items-center gap-1 px-2 py-1.5 text-sm text-gray-600 hover:bg-gray-200 rounded-lg disabled:opacity-50 transition-colors"
                      title="Rewrite with different tone"
                    >
                      {aiLoading ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
                    </button>
                    <AnimatePresence>
                      {showToneMenu && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setShowToneMenu(false)} />
                          <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="absolute right-0 top-full mt-1 w-40 bg-white rounded-xl shadow-xl border border-gray-200 z-20 py-1 overflow-hidden"
                          >
                            <p className="px-3 py-1.5 text-xs font-medium text-gray-500 uppercase">Rewrite as</p>
                            {['professional', 'friendly', 'formal', 'casual', 'shorter', 'longer'].map((tone) => (
                              <button
                                key={tone}
                                onClick={() => handleAIRewrite(tone)}
                                className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-[#977DFF]/10 hover:text-[#977DFF] capitalize transition-colors"
                              >
                                {tone}
                              </button>
                            ))}
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Subject Suggestions */}
                  <div className="relative">
                    <button
                      onClick={handleGenerateSubjects}
                      disabled={aiLoading}
                      className="flex items-center gap-1 px-2 py-1.5 text-sm text-gray-600 hover:bg-gray-200 rounded-lg disabled:opacity-50 transition-colors"
                      title="Suggest subject lines"
                    >
                      <Lightbulb size={16} />
                    </button>
                    <AnimatePresence>
                      {showSubjectSuggestions && subjectSuggestions.length > 0 && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setShowSubjectSuggestions(false)} />
                          <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="absolute right-0 top-full mt-1 w-72 bg-white rounded-xl shadow-xl border border-gray-200 z-20 py-1 overflow-hidden"
                          >
                            <p className="px-3 py-1.5 text-xs font-medium text-gray-500 uppercase">Subject Suggestions</p>
                            {subjectSuggestions.map((subject, idx) => (
                              <button
                                key={idx}
                                onClick={() => {
                                  updateComposeData({ subject });
                                  setShowSubjectSuggestions(false);
                                }}
                                className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-[#977DFF]/10 hover:text-[#977DFF] truncate transition-colors"
                              >
                                {subject}
                              </button>
                            ))}
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* Templates dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setShowTemplates(!showTemplates)}
                    className="flex items-center gap-1 px-2 py-1.5 text-sm text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                    title="Use template"
                  >
                    <FileText size={16} />
                    <ChevronDown size={14} />
                  </button>
                  <AnimatePresence>
                    {showTemplates && templates.length > 0 && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setShowTemplates(false)} />
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="absolute right-0 top-full mt-1 w-64 bg-white rounded-xl shadow-xl border border-gray-200 z-20 max-h-64 overflow-y-auto"
                        >
                          <div className="p-2 border-b border-gray-100">
                            <p className="text-xs font-medium text-gray-500 uppercase">Templates</p>
                          </div>
                          {templates.map((template) => (
                            <button
                              key={template.id}
                              onClick={() => applyTemplate(template)}
                              className="w-full text-left px-3 py-2 hover:bg-[#977DFF]/10 transition-colors"
                            >
                              <p className="text-sm font-medium text-gray-900">{template.name}</p>
                              <p className="text-xs text-gray-500 truncate">{template.subject}</p>
                            </button>
                          ))}
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>

                {/* Confidential Mode */}
                <button
                  onClick={() => setShowConfidentialPanel(!showConfidentialPanel)}
                  className={`flex items-center gap-1 px-2 py-1.5 text-sm rounded-lg transition-colors ${
                    confidentialEnabled
                      ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                      : showConfidentialPanel
                        ? 'bg-gray-200 text-gray-700'
                        : 'text-gray-600 hover:bg-gray-200'
                  }`}
                  title="Confidential mode"
                >
                  <Lock size={16} />
                  {confidentialEnabled && <span className="hidden sm:inline text-xs">On</span>}
                </button>
              </div>

              {/* AI Compose Panel */}
              <AnimatePresence>
                {showAIPanel && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="flex-shrink-0 p-4 bg-gradient-to-r from-[#FFCCF2]/20 via-[#977DFF]/10 to-[#0033FF]/10 border-b border-[#977DFF]/20 overflow-hidden"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles size={16} className="text-[#977DFF]" />
                      <span className="text-sm font-medium text-gray-800">AI Compose</span>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={aiPrompt}
                        onChange={(e) => setAiPrompt(e.target.value)}
                        placeholder="Describe the email you want to write... (e.g., 'Thank John for the meeting yesterday')"
                        className="flex-1 px-3 py-2.5 text-sm border border-[#977DFF]/30 rounded-xl focus:ring-2 focus:ring-[#977DFF]/50 focus:border-[#977DFF] bg-white transition-all"
                        onKeyDown={(e) => e.key === 'Enter' && handleAICompose()}
                      />
                      <select
                        value={aiTone}
                        onChange={(e) => setAiTone(e.target.value)}
                        className="px-3 py-2.5 text-sm border border-[#977DFF]/30 rounded-xl focus:ring-2 focus:ring-[#977DFF]/50 bg-white"
                      >
                        <option value="professional">Professional</option>
                        <option value="friendly">Friendly</option>
                        <option value="formal">Formal</option>
                        <option value="casual">Casual</option>
                      </select>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleAICompose}
                        disabled={aiLoading || !aiPrompt.trim()}
                        className={`flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r ${BRAND.gradient} text-white rounded-xl hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all`}
                      >
                        {aiLoading ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <Sparkles size={16} />
                        )}
                        Generate
                      </motion.button>
                    </div>
                    <p className="mt-2 text-xs text-[#977DFF]">
                      Tip: Be specific about the recipient, purpose, and key points you want to include.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Confidential Mode Panel */}
              <AnimatePresence>
                {showConfidentialPanel && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="flex-shrink-0 p-4 bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-200 overflow-hidden"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Shield size={16} className="text-amber-600" />
                        <span className="text-sm font-medium text-gray-800">Confidential Mode</span>
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <span className="text-xs text-gray-600">Enable</span>
                        <div
                          onClick={() => setConfidentialEnabled(!confidentialEnabled)}
                          className={`relative w-10 h-5 rounded-full transition-colors ${
                            confidentialEnabled ? 'bg-amber-500' : 'bg-gray-300'
                          }`}
                        >
                          <div
                            className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                              confidentialEnabled ? 'translate-x-5' : 'translate-x-0.5'
                            }`}
                          />
                        </div>
                      </label>
                    </div>

                    {confidentialEnabled && (
                      <div className="space-y-3">
                        {/* Expiration */}
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2 text-gray-600">
                            <Timer size={14} />
                            <span className="text-xs">Expires in:</span>
                          </div>
                          <select
                            value={confidentialSettings.expiresInHours}
                            onChange={(e) => setConfidentialSettings({
                              ...confidentialSettings,
                              expiresInHours: Number(e.target.value)
                            })}
                            className="px-2 py-1 text-xs border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500/50 bg-white"
                          >
                            <option value={24}>1 day</option>
                            <option value={72}>3 days</option>
                            <option value={168}>1 week</option>
                            <option value={336}>2 weeks</option>
                            <option value={720}>1 month</option>
                            <option value={0}>Never</option>
                          </select>
                        </div>

                        {/* Passcode */}
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2 text-gray-600">
                            <Key size={14} />
                            <span className="text-xs">Passcode:</span>
                          </div>
                          <select
                            value={confidentialSettings.passcodeType}
                            onChange={(e) => setConfidentialSettings({
                              ...confidentialSettings,
                              passcodeType: e.target.value as 'sms' | 'email' | 'none'
                            })}
                            className="px-2 py-1 text-xs border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500/50 bg-white"
                          >
                            <option value="none">No passcode</option>
                            <option value="email">Send via email</option>
                            <option value="sms">Send via SMS</option>
                          </select>
                          {confidentialSettings.passcodeType !== 'none' && (
                            <input
                              type="text"
                              value={confidentialSettings.passcode}
                              onChange={(e) => setConfidentialSettings({
                                ...confidentialSettings,
                                passcode: e.target.value
                              })}
                              placeholder="Custom passcode (optional)"
                              className="flex-1 px-2 py-1 text-xs border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500/50 bg-white"
                            />
                          )}
                        </div>

                        {/* Restrictions */}
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="text-xs text-gray-600">Restrict:</span>
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={confidentialSettings.noForward}
                              onChange={(e) => setConfidentialSettings({
                                ...confidentialSettings,
                                noForward: e.target.checked
                              })}
                              className="w-3.5 h-3.5 rounded border-amber-400 text-amber-600 focus:ring-amber-500"
                            />
                            <Forward size={12} className="text-gray-500" />
                            <span className="text-xs text-gray-700">Forward</span>
                          </label>
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={confidentialSettings.noCopy}
                              onChange={(e) => setConfidentialSettings({
                                ...confidentialSettings,
                                noCopy: e.target.checked
                              })}
                              className="w-3.5 h-3.5 rounded border-amber-400 text-amber-600 focus:ring-amber-500"
                            />
                            <Copy size={12} className="text-gray-500" />
                            <span className="text-xs text-gray-700">Copy</span>
                          </label>
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={confidentialSettings.noPrint}
                              onChange={(e) => setConfidentialSettings({
                                ...confidentialSettings,
                                noPrint: e.target.checked
                              })}
                              className="w-3.5 h-3.5 rounded border-amber-400 text-amber-600 focus:ring-amber-500"
                            />
                            <Printer size={12} className="text-gray-500" />
                            <span className="text-xs text-gray-700">Print</span>
                          </label>
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={confidentialSettings.noDownload}
                              onChange={(e) => setConfidentialSettings({
                                ...confidentialSettings,
                                noDownload: e.target.checked
                              })}
                              className="w-3.5 h-3.5 rounded border-amber-400 text-amber-600 focus:ring-amber-500"
                            />
                            <Download size={12} className="text-gray-500" />
                            <span className="text-xs text-gray-700">Download</span>
                          </label>
                        </div>

                        <p className="text-xs text-amber-700 bg-amber-100 px-2 py-1.5 rounded-lg">
                          Recipients can view this email until it expires. They cannot {confidentialSettings.noForward && 'forward, '}{confidentialSettings.noCopy && 'copy, '}{confidentialSettings.noPrint && 'print, '}{confidentialSettings.noDownload && 'download attachments from '}this email.
                        </p>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-4">
                <div
                  ref={bodyRef}
                  contentEditable
                  suppressContentEditableWarning
                  className="min-h-full text-sm focus:outline-none prose prose-sm max-w-none"
                  style={{ minHeight: '200px' }}
                  onInput={(e) => {
                    setBodyContent(e.currentTarget.innerHTML);
                  }}
                />
              </div>

              {/* Attachments */}
              <AnimatePresence>
                {attachments.length > 0 && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="flex-shrink-0 px-4 py-2 border-t border-gray-100 overflow-hidden"
                  >
                    <div className="flex flex-wrap gap-2">
                      {attachments.map((file, index) => (
                        <motion.div
                          key={index}
                          initial={{ scale: 0.8, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0.8, opacity: 0 }}
                          className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-lg text-sm"
                        >
                          <Paperclip size={14} className="text-gray-500" />
                          <span className="max-w-32 truncate">{file.name}</span>
                          <button
                            onClick={() => removeAttachment(index)}
                            className="text-gray-400 hover:text-red-500 transition-colors"
                          >
                            <X size={14} />
                          </button>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Footer */}
              <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
                <div className="flex items-center gap-2">
                  {/* Confidential indicator */}
                  {confidentialEnabled && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-100 text-amber-700 rounded-lg text-xs font-medium">
                      <Lock size={12} />
                      <span>Confidential</span>
                    </div>
                  )}
                  {/* Send button with dropdown */}
                  <div className="flex">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleSend}
                      disabled={loading.send}
                      className={`flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r ${BRAND.gradient} text-white font-medium rounded-l-xl hover:shadow-lg disabled:opacity-50 transition-all`}
                      style={{ boxShadow: `0 4px 15px ${BRAND.purple}30` }}
                    >
                      <Send size={16} />
                      <span>{loading.send ? 'Sending...' : 'Send'}</span>
                    </motion.button>
                    <button
                      onClick={() => setShowSchedule(true)}
                      className={`px-3 py-2.5 bg-[#0033FF] text-white rounded-r-xl hover:bg-[#0033FF]/90 border-l border-white/20 transition-colors`}
                      title="Schedule send"
                    >
                      <Clock size={16} />
                    </button>
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <button
                    onClick={handleAttachment}
                    className="p-2.5 text-gray-600 hover:bg-gray-200 rounded-xl transition-colors"
                    title="Attach file"
                  >
                    <Paperclip size={18} />
                  </button>

                  {/* More options */}
                  <div className="relative">
                    <button
                      onClick={() => setShowMoreOptions(!showMoreOptions)}
                      className="p-2.5 text-gray-600 hover:bg-gray-200 rounded-xl transition-colors"
                      title="More options"
                    >
                      <MoreHorizontal size={18} />
                    </button>
                    <AnimatePresence>
                      {showMoreOptions && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setShowMoreOptions(false)} />
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 10 }}
                            className="absolute left-0 bottom-full mb-2 w-56 bg-white rounded-xl shadow-xl border border-gray-200 z-20 overflow-hidden"
                          >
                            <label className="flex items-center gap-2 px-3 py-2.5 hover:bg-gray-50 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={sendWithUndo}
                                onChange={(e) => setSendWithUndo(e.target.checked)}
                                className="rounded border-gray-300 text-[#977DFF] focus:ring-[#977DFF]"
                              />
                              <span className="text-sm text-gray-700">Enable undo send</span>
                            </label>
                            {sendWithUndo && (
                              <div className="px-3 py-2.5 border-t border-gray-100">
                                <label className="text-xs text-gray-500">Undo delay (seconds)</label>
                                <input
                                  type="number"
                                  min={5}
                                  max={120}
                                  value={undoDelay}
                                  onChange={(e) => setUndoDelay(Number(e.target.value))}
                                  className="w-full mt-1 px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#977DFF]/50 focus:border-[#977DFF]"
                                />
                              </div>
                            )}
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                <button
                  onClick={onClose}
                  className="p-2.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                  title="Discard"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Schedule Send Modal */}
      <ScheduleSendModal
        isOpen={showSchedule}
        onClose={() => setShowSchedule(false)}
        onSchedule={handleScheduleSend}
      />
    </>
  );
}
