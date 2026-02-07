import { useState, useRef, useEffect, useCallback } from 'react';
import { sendChatMessage, resetChatSession } from '../lib/api';

const SUGGESTIONS = [
  'Should I open my window right now?',
  'What\'s my mold risk looking like?',
  'How much CO₂ have I saved?',
  'When is the cheapest time to heat?',
  'How does Goldilocks help Kingston?',
];

/* ── helpers ─────────────────────────────────────────── */

/** Strip markdown / emoji so TTS reads cleanly */
function cleanForSpeech(text) {
  return text
    .replace(/[#*_~`>]/g, '')           // markdown symbols
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // [link](url) → link
    .replace(/\p{Emoji_Presentation}/gu, '') // emoji
    .replace(/\s{2,}/g, ' ')            // collapse whitespace
    .trim();
}

/** Check browser support for SpeechRecognition */
function getSpeechRecognition() {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

export default function ChatPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'Hey! I\'m Goldilocks 🐻 — your smart home assistant. Ask me anything about your indoor climate, energy costs, or environmental impact!' },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  /* ── voice state ──────────────────────────────────── */
  const [isListening, setIsListening] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const recognitionRef = useRef(null);

  /* ── detect browser speech support on mount ───────── */
  useEffect(() => {
    setSpeechSupported(!!getSpeechRecognition() && typeof window !== 'undefined' && !!window.speechSynthesis);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  /* ── TTS: speak assistant replies ─────────────────── */
  const speak = useCallback((text) => {
    if (!voiceEnabled || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();          // stop any in-progress speech
    const clean = cleanForSpeech(text);
    if (!clean) return;
    const utter = new SpeechSynthesisUtterance(clean);
    utter.rate = 1.05;
    utter.pitch = 1.0;
    utter.onstart = () => setIsSpeaking(true);
    utter.onend   = () => setIsSpeaking(false);
    utter.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utter);
  }, [voiceEnabled]);

  /* ── stop TTS when voice disabled or panel closed ── */
  useEffect(() => {
    if (!voiceEnabled || !isOpen) {
      window.speechSynthesis?.cancel();
      setIsSpeaking(false);
    }
  }, [voiceEnabled, isOpen]);

  const handleSend = async (text) => {
    const msg = text || input.trim();
    if (!msg || loading) return;

    setMessages(prev => [...prev, { role: 'user', text: msg }]);
    setInput('');
    setLoading(true);

    try {
      const res = await sendChatMessage(msg);
      const reply = res.reply || 'Sorry, I couldn\'t generate a response.';
      setMessages(prev => [...prev, {
        role: 'assistant',
        text: reply,
        model: res.model,
        tokens: res.tokens_used,
      }]);
      speak(reply);                           // 🔊 auto-speak
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        text: 'Oops, something went wrong. Please try again!',
        error: true,
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    window.speechSynthesis?.cancel();
    setIsSpeaking(false);
    await resetChatSession();
    setMessages([
      { role: 'assistant', text: 'Chat reset! 🐻 What would you like to know?' },
    ]);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  /* ── Speech Recognition ───────────────────────────── */
  const startListening = useCallback(() => {
    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-CA';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setInput('');                       // clear any leftover text
      handleSend(transcript);             // send immediately
    };

    recognition.onerror = (event) => {
      console.warn('Speech recognition error:', event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, []);   // handleSend is stable enough via closure

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.abort();
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  const toggleListening = useCallback(() => {
    if (isListening) stopListening();
    else startListening();
  }, [isListening, startListening, stopListening]);

  /* ── cleanup on unmount ───────────────────────────── */
  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
      window.speechSynthesis?.cancel();
    };
  }, []);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-amber-500 hover:bg-amber-600 text-white rounded-full shadow-lg flex items-center justify-center text-2xl transition-all hover:scale-110 z-50"
        title="Chat with Goldilocks"
      >
        🐻
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 w-96 h-[32rem] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col z-50 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">🐻</span>
          <div>
            <h3 className="text-white font-semibold text-sm">Goldilocks</h3>
            <p className="text-amber-100 text-xs">
              Powered by Google Gemini
              {isSpeaking && <span className="ml-1 animate-pulse">🔊</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {/* Voice toggle */}
          {speechSupported && (
            <button
              onClick={() => setVoiceEnabled(v => !v)}
              className={`text-xs px-2 py-1 rounded transition-colors ${
                voiceEnabled
                  ? 'text-white bg-amber-600/50 hover:bg-amber-600/70'
                  : 'text-amber-200 hover:text-white hover:bg-amber-600/50'
              }`}
              title={voiceEnabled ? 'Disable voice replies' : 'Enable voice replies'}
            >
              {voiceEnabled ? '🔊' : '🔇'}
            </button>
          )}
          <button
            onClick={handleReset}
            className="text-amber-100 hover:text-white text-xs px-2 py-1 rounded hover:bg-amber-600/50 transition-colors"
            title="Reset conversation"
          >
            ↺ Reset
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="text-amber-100 hover:text-white w-7 h-7 flex items-center justify-center rounded hover:bg-amber-600/50 transition-colors"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
              msg.role === 'user'
                ? 'bg-amber-500 text-white rounded-br-sm'
                : msg.error
                  ? 'bg-red-50 text-red-700 border border-red-200 rounded-bl-sm'
                  : 'bg-gray-100 text-gray-800 rounded-bl-sm'
            }`}>
              <p className="whitespace-pre-wrap">{msg.text}</p>
              {msg.model && (
                <p className="text-[10px] mt-1 opacity-50">{msg.model} · {msg.tokens} tokens</p>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-xl rounded-bl-sm px-3 py-2 text-sm text-gray-500">
              <span className="inline-flex gap-1">
                <span className="animate-bounce" style={{ animationDelay: '0ms' }}>·</span>
                <span className="animate-bounce" style={{ animationDelay: '150ms' }}>·</span>
                <span className="animate-bounce" style={{ animationDelay: '300ms' }}>·</span>
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick suggestions (only show at start) */}
      {messages.length <= 2 && !loading && (
        <div className="px-3 pb-2">
          <div className="flex flex-wrap gap-1">
            {SUGGESTIONS.map((s, i) => (
              <button
                key={i}
                onClick={() => handleSend(s)}
                className="text-xs bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-2.5 py-1 hover:bg-amber-100 transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="border-t border-gray-200 p-3">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isListening ? '🎙️ Listening...' : 'Ask Goldilocks anything...'}
            className={`flex-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition-colors ${
              isListening ? 'border-red-400 bg-red-50' : 'border-gray-300'
            }`}
            disabled={loading || isListening}
          />
          {/* Mic button */}
          {speechSupported && (
            <button
              onClick={toggleListening}
              disabled={loading}
              className={`w-10 h-10 flex items-center justify-center rounded-lg text-sm transition-all ${
                isListening
                  ? 'bg-red-500 text-white animate-pulse shadow-lg shadow-red-300'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-800'
              } disabled:opacity-40 disabled:cursor-not-allowed`}
              title={isListening ? 'Stop listening' : 'Voice input'}
            >
              🎤
            </button>
          )}
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || loading}
            className="px-3 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
