import { useState, useRef, KeyboardEvent } from 'react';
import { motion } from 'framer-motion';
import { Video, ArrowRight, Keyboard } from 'lucide-react';

interface QuickJoinInputProps {
  onJoin: (code: string) => void;
  isLoading?: boolean;
}

export default function QuickJoinInput({ onJoin, isLoading }: QuickJoinInputProps) {
  const [code, setCode] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = () => {
    const trimmedCode = code.trim();
    if (trimmedCode) {
      onJoin(trimmedCode);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  // Format code with dashes (like Google Meet)
  const formatCode = (value: string) => {
    // Remove all non-alphanumeric characters
    const clean = value.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

    // Add dashes every 4 characters for readability
    if (clean.length <= 4) return clean;
    if (clean.length <= 8) return `${clean.slice(0, 4)}-${clean.slice(4)}`;
    return `${clean.slice(0, 4)}-${clean.slice(4, 8)}-${clean.slice(8, 12)}`;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    // Allow pasting full URLs
    if (rawValue.includes('meet/room/')) {
      const match = rawValue.match(/meet\/room\/([a-zA-Z0-9-]+)/);
      if (match) {
        setCode(match[1]);
        return;
      }
    }
    setCode(formatCode(rawValue));
  };

  return (
    <div className="w-full">
      <div
        className={`
          relative flex items-center
          bg-gray-800/60 backdrop-blur-sm
          border rounded-2xl
          transition-all duration-200
          ${isFocused
            ? 'border-emerald-500/50 ring-4 ring-emerald-500/10'
            : 'border-gray-700/50 hover:border-gray-600/50'
          }
        `}
      >
        {/* Icon */}
        <div className="pl-5 pr-2">
          <Keyboard
            size={20}
            className={`transition-colors ${isFocused ? 'text-emerald-400' : 'text-gray-500'}`}
          />
        </div>

        {/* Input */}
        <input
          ref={inputRef}
          type="text"
          value={code}
          onChange={handleChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onKeyDown={handleKeyDown}
          placeholder="Enter meeting code or link"
          className="
            flex-1 py-4 px-2
            bg-transparent
            text-white text-base
            placeholder-gray-500
            focus:outline-none
            font-mono tracking-wide
          "
        />

        {/* Join Button */}
        <div className="pr-2">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleSubmit}
            disabled={!code.trim() || isLoading}
            className={`
              flex items-center gap-2
              px-5 py-2.5 rounded-xl
              font-medium text-sm
              transition-all duration-150
              ${code.trim()
                ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                : 'bg-gray-700 text-gray-500 cursor-not-allowed'
              }
            `}
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <span>Join</span>
                <ArrowRight size={16} />
              </>
            )}
          </motion.button>
        </div>
      </div>

      {/* Hint */}
      <p className="mt-3 text-sm text-gray-500 text-center">
        Paste a meeting link or enter a code like{' '}
        <span className="font-mono text-gray-400">abc-defg-hijk</span>
      </p>
    </div>
  );
}
