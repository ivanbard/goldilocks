import { useState, useRef, useEffect } from 'react';
import { sendChatMessage, resetChatSession } from '../lib/api';

const SUGGESTIONS = [
  'Should I open my window right now?',
  'What\'s my mold risk looking like?',
  'How much CO₂ have I saved?',
  'When is the cheapest time to heat?',
  'How does Goldilocks help Kingston?',
];

export default function ChatPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'Hey! I\'m Goldilocks 🐻 — your smart home assistant. Ask me anything about your indoor climate, energy costs, or environmental impact!' },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  const handleSend = async (text) => {
    const msg = text || input.trim();
    if (!msg || loading) return;

    setMessages(prev => [...prev, { role: 'user', text: msg }]);
    setInput('');
    setLoading(true);

    try {
      const res = await sendChatMessage(msg);
      setMessages(prev => [...prev, {
        role: 'assistant',
        text: res.reply || 'Sorry, I couldn\'t generate a response.',
        model: res.model,
        tokens: res.tokens_used,
      }]);
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
            <p className="text-amber-100 text-xs">Powered by Google Gemini</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
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
            placeholder="Ask Goldilocks anything..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none"
            disabled={loading}
          />
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
