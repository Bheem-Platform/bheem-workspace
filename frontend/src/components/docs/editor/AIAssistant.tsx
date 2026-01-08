/**
 * Bheem Docs - AI Assistant Panel
 * AI-powered writing assistance
 */
import { useState } from 'react';
import {
  Sparkles,
  X,
  FileText,
  Wand2,
  Languages,
  Search,
  Tag,
  Lightbulb,
  Copy,
  Check,
  ChevronDown,
  Loader2,
  RefreshCw,
} from 'lucide-react';

interface AIAssistantProps {
  documentId: string;
  selectedText?: string;
  onInsertText: (text: string) => void;
  onReplaceSelection: (text: string) => void;
  onClose: () => void;
}

type AIAction =
  | 'summarize'
  | 'improve'
  | 'simplify'
  | 'expand'
  | 'translate'
  | 'keywords'
  | 'suggest_tags'
  | 'generate';

interface AIResult {
  type: AIAction;
  content: string;
  loading: boolean;
  error?: string;
}

const WRITING_STYLES = [
  { value: 'professional', label: 'Professional' },
  { value: 'casual', label: 'Casual' },
  { value: 'academic', label: 'Academic' },
  { value: 'concise', label: 'Concise' },
  { value: 'creative', label: 'Creative' },
];

const LANGUAGES = [
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'it', label: 'Italian' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'zh', label: 'Chinese' },
  { value: 'ja', label: 'Japanese' },
  { value: 'ko', label: 'Korean' },
  { value: 'ar', label: 'Arabic' },
  { value: 'hi', label: 'Hindi' },
];

export default function AIAssistant({
  documentId,
  selectedText,
  onInsertText,
  onReplaceSelection,
  onClose,
}: AIAssistantProps) {
  const [activeTab, setActiveTab] = useState<'assist' | 'generate'>('assist');
  const [result, setResult] = useState<AIResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [generatePrompt, setGeneratePrompt] = useState('');
  const [selectedStyle, setSelectedStyle] = useState('professional');
  const [selectedLanguage, setSelectedLanguage] = useState('es');
  const [showStyleMenu, setShowStyleMenu] = useState(false);
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);

  const executeAIAction = async (action: AIAction, options?: any) => {
    setResult({ type: action, content: '', loading: true });

    try {
      // API call to backend
      const response = await fetch(`/api/v1/docs/ai/${action}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
        },
        body: JSON.stringify({
          document_id: documentId,
          text: selectedText,
          ...options,
        }),
      });

      if (!response.ok) throw new Error('AI request failed');

      const data = await response.json();
      setResult({
        type: action,
        content: data.result || data.summary || data.improved_text || data.content || '',
        loading: false,
      });
    } catch (error) {
      setResult({
        type: action,
        content: '',
        loading: false,
        error: 'Failed to process. Please try again.',
      });
    }
  };

  const handleCopy = () => {
    if (result?.content) {
      navigator.clipboard.writeText(result.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleInsert = () => {
    if (result?.content) {
      onInsertText(result.content);
    }
  };

  const handleReplace = () => {
    if (result?.content && selectedText) {
      onReplaceSelection(result.content);
    }
  };

  const ActionButton = ({
    icon: Icon,
    label,
    action,
    options,
    disabled,
  }: {
    icon: any;
    label: string;
    action: AIAction;
    options?: any;
    disabled?: boolean;
  }) => (
    <button
      onClick={() => executeAIAction(action, options)}
      disabled={disabled || result?.loading}
      className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed w-full"
    >
      <Icon size={16} className="text-purple-500" />
      {label}
    </button>
  );

  return (
    <div className="w-80 bg-white border-l flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-gradient-to-r from-purple-500 to-pink-500">
        <div className="flex items-center gap-2 text-white">
          <Sparkles size={20} />
          <h2 className="font-semibold">AI Assistant</h2>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-white/20 rounded text-white">
          <X size={18} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b">
        <button
          onClick={() => setActiveTab('assist')}
          className={`flex-1 py-2 text-sm font-medium ${
            activeTab === 'assist'
              ? 'text-purple-600 border-b-2 border-purple-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <div className="flex items-center justify-center gap-1">
            <Wand2 size={14} />
            Assist
          </div>
        </button>
        <button
          onClick={() => setActiveTab('generate')}
          className={`flex-1 py-2 text-sm font-medium ${
            activeTab === 'generate'
              ? 'text-purple-600 border-b-2 border-purple-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <div className="flex items-center justify-center gap-1">
            <Lightbulb size={14} />
            Generate
          </div>
        </button>
      </div>

      {/* Selected text indicator */}
      {selectedText && (
        <div className="px-4 py-3 bg-purple-50 border-b">
          <p className="text-xs text-purple-600 mb-1">Selected text:</p>
          <p className="text-sm text-gray-700 line-clamp-2 italic">"{selectedText}"</p>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'assist' ? (
          <div className="p-4 space-y-4">
            {/* Writing assistance */}
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">
                Improve Writing
              </p>
              <div className="space-y-1">
                <ActionButton
                  icon={FileText}
                  label="Summarize"
                  action="summarize"
                  disabled={!selectedText}
                />
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => executeAIAction('improve', { style: selectedStyle })}
                    disabled={!selectedText || result?.loading}
                    className="flex-1 flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg disabled:opacity-50"
                  >
                    <Wand2 size={16} className="text-purple-500" />
                    Improve Writing
                  </button>
                  <div className="relative">
                    <button
                      onClick={() => setShowStyleMenu(!showStyleMenu)}
                      className="p-2 hover:bg-gray-100 rounded"
                    >
                      <ChevronDown size={14} />
                    </button>
                    {showStyleMenu && (
                      <div className="absolute right-0 top-full mt-1 bg-white border rounded-lg shadow-lg py-1 z-10 min-w-[120px]">
                        {WRITING_STYLES.map((style) => (
                          <button
                            key={style.value}
                            onClick={() => {
                              setSelectedStyle(style.value);
                              setShowStyleMenu(false);
                            }}
                            className={`w-full px-3 py-1.5 text-left text-sm hover:bg-gray-100 ${
                              selectedStyle === style.value ? 'bg-purple-50 text-purple-600' : ''
                            }`}
                          >
                            {style.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <ActionButton
                  icon={FileText}
                  label="Simplify"
                  action="simplify"
                  disabled={!selectedText}
                />
                <ActionButton
                  icon={FileText}
                  label="Expand"
                  action="expand"
                  disabled={!selectedText}
                />
              </div>
            </div>

            {/* Translation */}
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">
                Translate
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => executeAIAction('translate', { target_language: selectedLanguage })}
                  disabled={!selectedText || result?.loading}
                  className="flex-1 flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg disabled:opacity-50"
                >
                  <Languages size={16} className="text-purple-500" />
                  Translate to {LANGUAGES.find((l) => l.value === selectedLanguage)?.label}
                </button>
                <div className="relative">
                  <button
                    onClick={() => setShowLanguageMenu(!showLanguageMenu)}
                    className="p-2 hover:bg-gray-100 rounded"
                  >
                    <ChevronDown size={14} />
                  </button>
                  {showLanguageMenu && (
                    <div className="absolute right-0 top-full mt-1 bg-white border rounded-lg shadow-lg py-1 z-10 min-w-[120px] max-h-48 overflow-y-auto">
                      {LANGUAGES.map((lang) => (
                        <button
                          key={lang.value}
                          onClick={() => {
                            setSelectedLanguage(lang.value);
                            setShowLanguageMenu(false);
                          }}
                          className={`w-full px-3 py-1.5 text-left text-sm hover:bg-gray-100 ${
                            selectedLanguage === lang.value ? 'bg-purple-50 text-purple-600' : ''
                          }`}
                        >
                          {lang.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Analysis */}
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">
                Analysis
              </p>
              <div className="space-y-1">
                <ActionButton icon={Search} label="Extract Keywords" action="keywords" />
                <ActionButton icon={Tag} label="Suggest Tags" action="suggest_tags" />
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                What would you like to write?
              </label>
              <textarea
                value={generatePrompt}
                onChange={(e) => setGeneratePrompt(e.target.value)}
                placeholder="E.g., Write an introduction paragraph about climate change..."
                className="w-full px-3 py-2 border rounded-lg text-sm resize-none focus:ring-2 focus:ring-purple-500 h-32"
              />
            </div>
            <button
              onClick={() => executeAIAction('generate', { prompt: generatePrompt, style: selectedStyle })}
              disabled={!generatePrompt.trim() || result?.loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:opacity-90 disabled:opacity-50"
            >
              {result?.loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  Generate
                </>
              )}
            </button>
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="border-t">
            <div className="px-4 py-3 bg-gray-50 border-b flex items-center justify-between">
              <p className="text-sm font-medium text-gray-700">Result</p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => executeAIAction(result.type)}
                  className="p-1.5 hover:bg-gray-200 rounded"
                  title="Regenerate"
                >
                  <RefreshCw size={14} className="text-gray-500" />
                </button>
              </div>
            </div>
            <div className="p-4">
              {result.loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 size={24} className="animate-spin text-purple-500" />
                </div>
              ) : result.error ? (
                <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">
                  {result.error}
                </div>
              ) : (
                <>
                  <div className="text-sm text-gray-700 whitespace-pre-wrap bg-white border rounded-lg p-3 max-h-60 overflow-y-auto">
                    {result.content}
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={handleCopy}
                      className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg"
                    >
                      {copied ? <Check size={14} /> : <Copy size={14} />}
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                    <button
                      onClick={handleInsert}
                      className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm text-white bg-purple-600 hover:bg-purple-700 rounded-lg"
                    >
                      Insert
                    </button>
                    {selectedText && (
                      <button
                        onClick={handleReplace}
                        className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm text-purple-600 bg-purple-100 hover:bg-purple-200 rounded-lg"
                      >
                        Replace
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
