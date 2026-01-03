import { useState, useRef, useEffect } from 'react';
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
} from 'lucide-react';
import { useMailStore } from '@/stores/mailStore';
import { useCredentialsStore } from '@/stores/credentialsStore';
import type { ComposeEmail } from '@/types/mail';

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
  const [toInput, setToInput] = useState('');
  const [ccInput, setCcInput] = useState('');
  const [bccInput, setBccInput] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);

  const bodyRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize with prefill data
  useEffect(() => {
    if (composeData.to) {
      setToInput(composeData.to.join(', '));
    }
    if (composeData.cc && composeData.cc.length > 0) {
      setCcInput(composeData.cc.join(', '));
      setShowCc(true);
    }
    if (composeData.bcc && composeData.bcc.length > 0) {
      setBccInput(composeData.bcc.join(', '));
      setShowBcc(true);
    }
  }, [composeData]);

  const handleSend = async () => {
    const toAddresses = toInput.split(',').map((e) => e.trim()).filter(Boolean);
    const ccAddresses = ccInput.split(',').map((e) => e.trim()).filter(Boolean);
    const bccAddresses = bccInput.split(',').map((e) => e.trim()).filter(Boolean);

    if (toAddresses.length === 0) {
      alert('Please enter at least one recipient');
      return;
    }

    const email: ComposeEmail = {
      to: toAddresses,
      cc: ccAddresses.length > 0 ? ccAddresses : undefined,
      bcc: bccAddresses.length > 0 ? bccAddresses : undefined,
      subject: composeData.subject || '',
      body: bodyRef.current?.innerHTML || '',
      isHtml: true,
      attachments: attachments.length > 0 ? attachments : undefined,
      inReplyTo: composeData.inReplyTo,
      references: composeData.references,
    };

    const success = await sendEmail(email);
    if (success) {
      onClose();
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

  const credentials = getMailCredentials();

  // Modal size classes
  const sizeClasses = isMaximized
    ? 'fixed inset-4 m-0'
    : isMinimized
    ? 'fixed bottom-4 right-4 w-80 h-12'
    : 'fixed bottom-4 right-4 w-[600px] h-[500px]';

  return (
    <div className={`${sizeClasses} bg-white rounded-t-xl shadow-2xl border border-gray-200 flex flex-col z-50 transition-all duration-200`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 text-white rounded-t-xl cursor-move">
        <span className="font-medium text-sm truncate">
          {composeData.subject || 'New Message'}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1.5 hover:bg-gray-700 rounded"
          >
            <Minus size={16} />
          </button>
          <button
            onClick={() => setIsMaximized(!isMaximized)}
            className="p-1.5 hover:bg-gray-700 rounded"
          >
            {isMaximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-red-600 rounded"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Content - hidden when minimized */}
      {!isMinimized && (
        <>
          {/* Recipients */}
          <div className="flex-shrink-0 border-b border-gray-200">
            {/* To */}
            <div className="flex items-center px-4 py-2 border-b border-gray-100">
              <span className="text-sm text-gray-500 w-12">To</span>
              <input
                type="text"
                value={toInput}
                onChange={(e) => setToInput(e.target.value)}
                placeholder="Recipients"
                className="flex-1 px-2 py-1 text-sm border-0 focus:ring-0 focus:outline-none"
              />
              <div className="flex items-center gap-2 text-sm text-gray-500">
                {!showCc && (
                  <button
                    onClick={() => setShowCc(true)}
                    className="hover:text-gray-700"
                  >
                    Cc
                  </button>
                )}
                {!showBcc && (
                  <button
                    onClick={() => setShowBcc(true)}
                    className="hover:text-gray-700"
                  >
                    Bcc
                  </button>
                )}
              </div>
            </div>

            {/* Cc */}
            {showCc && (
              <div className="flex items-center px-4 py-2 border-b border-gray-100">
                <span className="text-sm text-gray-500 w-12">Cc</span>
                <input
                  type="text"
                  value={ccInput}
                  onChange={(e) => setCcInput(e.target.value)}
                  placeholder="Cc recipients"
                  className="flex-1 px-2 py-1 text-sm border-0 focus:ring-0 focus:outline-none"
                />
              </div>
            )}

            {/* Bcc */}
            {showBcc && (
              <div className="flex items-center px-4 py-2 border-b border-gray-100">
                <span className="text-sm text-gray-500 w-12">Bcc</span>
                <input
                  type="text"
                  value={bccInput}
                  onChange={(e) => setBccInput(e.target.value)}
                  placeholder="Bcc recipients"
                  className="flex-1 px-2 py-1 text-sm border-0 focus:ring-0 focus:outline-none"
                />
              </div>
            )}

            {/* Subject */}
            <div className="flex items-center px-4 py-2">
              <span className="text-sm text-gray-500 w-12">Subject</span>
              <input
                type="text"
                value={composeData.subject || ''}
                onChange={(e) => updateComposeData({ subject: e.target.value })}
                placeholder="Subject"
                className="flex-1 px-2 py-1 text-sm border-0 focus:ring-0 focus:outline-none"
              />
            </div>
          </div>

          {/* Formatting Toolbar */}
          <div className="flex-shrink-0 flex items-center gap-1 px-4 py-2 border-b border-gray-100">
            <button
              onClick={() => formatText('bold')}
              className="p-1.5 hover:bg-gray-100 rounded"
              title="Bold"
            >
              <Bold size={16} className="text-gray-600" />
            </button>
            <button
              onClick={() => formatText('italic')}
              className="p-1.5 hover:bg-gray-100 rounded"
              title="Italic"
            >
              <Italic size={16} className="text-gray-600" />
            </button>
            <button
              onClick={() => formatText('underline')}
              className="p-1.5 hover:bg-gray-100 rounded"
              title="Underline"
            >
              <Underline size={16} className="text-gray-600" />
            </button>
            <div className="w-px h-5 bg-gray-300 mx-1" />
            <button
              onClick={() => formatText('insertUnorderedList')}
              className="p-1.5 hover:bg-gray-100 rounded"
              title="Bullet list"
            >
              <List size={16} className="text-gray-600" />
            </button>
            <button
              onClick={() => formatText('insertOrderedList')}
              className="p-1.5 hover:bg-gray-100 rounded"
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
              className="p-1.5 hover:bg-gray-100 rounded"
              title="Insert link"
            >
              <Link size={16} className="text-gray-600" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-4">
            <div
              ref={bodyRef}
              contentEditable
              className="min-h-full text-sm focus:outline-none"
              dangerouslySetInnerHTML={{
                __html: composeData.body || (composeData.originalEmail
                  ? `<br><br><div style="border-left: 2px solid #ccc; padding-left: 12px; margin-left: 0;">
                      <p style="color: #666; font-size: 12px;">On ${new Date(composeData.originalEmail.date).toLocaleString()}, ${composeData.originalEmail.from.name || composeData.originalEmail.from.email} wrote:</p>
                      ${composeData.originalEmail.bodyHtml || composeData.originalEmail.body}
                    </div>`
                  : ''
                ),
              }}
              onInput={(e) => updateComposeData({ body: e.currentTarget.innerHTML })}
            />
          </div>

          {/* Attachments */}
          {attachments.length > 0 && (
            <div className="flex-shrink-0 px-4 py-2 border-t border-gray-100">
              <div className="flex flex-wrap gap-2">
                {attachments.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 px-2 py-1 bg-gray-100 rounded text-sm"
                  >
                    <Paperclip size={14} className="text-gray-500" />
                    <span className="max-w-32 truncate">{file.name}</span>
                    <button
                      onClick={() => removeAttachment(index)}
                      className="text-gray-400 hover:text-red-500"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
            <div className="flex items-center gap-2">
              <button
                onClick={handleSend}
                disabled={loading.send}
                className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white font-medium rounded-lg hover:bg-orange-600 disabled:opacity-50 transition-colors"
              >
                <Send size={16} />
                <span>{loading.send ? 'Sending...' : 'Send'}</span>
              </button>

              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                onClick={handleAttachment}
                className="p-2 text-gray-600 hover:bg-gray-200 rounded-lg"
                title="Attach file"
              >
                <Paperclip size={18} />
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-red-500 hover:bg-gray-200 rounded-lg"
              title="Discard"
            >
              <Trash2 size={18} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
