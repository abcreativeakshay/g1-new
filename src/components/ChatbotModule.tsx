import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Loader2, Bot, User as UserIcon, Sparkles, Mic, MicOff, Volume2, VolumeX, Globe, ChevronDown } from 'lucide-react';
import { generateChatResponse } from '../lib/genai';
import { VOICE_LANGUAGES } from '../lib/voice';
import { useVoice } from '../contexts/VoiceContext';
import { motion, AnimatePresence } from 'framer-motion';

interface Message {
  role: 'user' | 'assistant';
  parts: string;
  timestamp: Date;
}

export const ChatbotModule = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      parts: `Hello! I'm your AI Farming Assistant. I can help you with:

🌾 Crop cultivation advice and fertilizer recommendations
🐛 Pest management and disease control
📊 Market prices and selling strategies
🌱 General farming questions
🎤 Use voice input in your preferred language!

How can I assist you today?`,
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Voice states
  const [isListening, setIsListening] = useState(false);
  const { ttsEnabled, setTtsEnabled, selectedLanguage, setSelectedLanguage, speechSupported } = useVoice();
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const languageDropdownRef = useRef<HTMLDivElement>(null);

  // Close language dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (languageDropdownRef.current && !languageDropdownRef.current.contains(e.target as Node)) {
        setShowLanguageDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Text-to-Speech
  const speakText = useCallback((text: string) => {
    if (!ttsEnabled || !('speechSynthesis' in window)) return;

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = selectedLanguage.code;
    utterance.rate = 0.95;
    utterance.pitch = 1;

    // Try to find a voice matching the selected language
    const voices = window.speechSynthesis.getVoices();
    const langPrefix = selectedLanguage.code.split('-')[0];
    const matchingVoice = voices.find(v => v.lang.startsWith(langPrefix));
    if (matchingVoice) {
      utterance.voice = matchingVoice;
    }

    window.speechSynthesis.speak(utterance);
  }, [ttsEnabled, selectedLanguage]);

  // Speech Recognition
  const startListening = useCallback(() => {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) return;

    // Stop any existing recognition
    if (recognitionRef.current) {
      recognitionRef.current.abort();
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = selectedLanguage.code;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = '';
      let interim = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interim += transcript;
        }
      }

      if (finalTranscript) {
        setInput(prev => prev + finalTranscript);
        setInterimTranscript('');
      } else {
        setInterimTranscript(interim);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
      setInterimTranscript('');
    };

    recognition.onend = () => {
      setIsListening(false);
      setInterimTranscript('');
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [selectedLanguage]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
    setInterimTranscript('');
  }, []);

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  // Cleanup recognition on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
      window.speechSynthesis?.cancel();
    };
  }, []);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    // Stop listening when sending
    if (isListening) {
      stopListening();
    }

    const userMessage: Message = {
      role: 'user',
      parts: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const systemPrompt = `You are AgriVision, a smart AI farming assistant. Help farmers with crop advice, pest management, fertilizers, market prices, and weather guidance.

Rules:
- Detect user language (English/Hindi/Marathi) and respond in the same language
- Keep responses short, practical, and farmer-friendly
- Use simple language, avoid jargon
- Format: Problem → Solution (numbered steps) → Extra Tips
- Suggest low-cost, practical solutions
- If unsure, recommend consulting a local agriculture expert`;

      const chatHistory = [
        { role: 'user', parts: systemPrompt },
        ...messages.map(m => ({ role: m.role === 'user' ? 'user' : 'model', parts: m.parts })),
        { role: 'user', parts: input }
      ];

      const response = await generateChatResponse(chatHistory);

      const assistantMessage: Message = {
        role: 'assistant',
        parts: response,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Speak the response if TTS is enabled
      speakText(response);
    } catch (error) {
      console.error('Error sending message:', error);
      const friendlyMsg =
        error instanceof Error
          ? error.message
          : '❌ Something went wrong. Please try again.';
      const errorMessage: Message = {
        role: 'assistant',
        parts: friendlyMsg,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };


  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="glass-card rounded-[2rem] flex flex-col h-[70vh] relative overflow-hidden">
      {/* Module Header */}
      <div className="p-6 md:p-8 border-b border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-purple-100 rounded-2xl">
            <Bot className="w-8 h-8 text-purple-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              Agri Intelligence
              <Sparkles className="w-4 h-4 text-emerald-500" />
            </h2>
            <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-widest font-semibold flex items-center gap-1.5">
              <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
              AgriVision Online • Voice Enabled
            </p>
          </div>
        </div>

        {/* Voice Controls */}
        <div className="flex items-center gap-2">
          {/* Language Selector */}
          {speechSupported && (
            <div className="relative" ref={languageDropdownRef}>
              <button
                onClick={() => setShowLanguageDropdown(!showLanguageDropdown)}
                className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl transition-all text-sm font-medium text-slate-700"
                title="Select voice language"
              >
                <Globe className="w-4 h-4 text-emerald-600" />
                <span className="hidden sm:inline">{selectedLanguage.flag} {selectedLanguage.code.split('-')[0].toUpperCase()}</span>
                <span className="sm:hidden">{selectedLanguage.flag}</span>
                <ChevronDown className={`w-3 h-3 transition-transform ${showLanguageDropdown ? 'rotate-180' : ''}`} />
              </button>

              <AnimatePresence>
                {showLanguageDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-full mt-2 w-64 max-h-72 overflow-y-auto bg-white border border-slate-200 rounded-2xl shadow-xl shadow-slate-200/50 z-50 scrollbar-hide"
                  >
                    <div className="p-2">
                      <p className="px-3 py-2 text-[10px] text-slate-400 uppercase tracking-widest font-bold">Voice Language</p>
                      {VOICE_LANGUAGES.map((lang) => (
                        <button
                          key={lang.code}
                          onClick={() => {
                            setSelectedLanguage(lang);
                            setShowLanguageDropdown(false);
                            // Restart recognition with new language if currently listening
                            if (isListening) {
                              stopListening();
                              setTimeout(() => startListening(), 100);
                            }
                          }}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all text-sm ${
                            selectedLanguage.code === lang.code
                              ? 'bg-emerald-50 text-emerald-800 font-semibold border border-emerald-200'
                              : 'hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          <span className="text-lg">{lang.flag}</span>
                          <span className="flex-1">{lang.label}</span>
                          {selectedLanguage.code === lang.code && (
                            <span className="flex h-2 w-2 rounded-full bg-emerald-500" />
                          )}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* TTS Toggle */}
          <button
            onClick={() => {
              setTtsEnabled(!ttsEnabled);
              if (ttsEnabled) window.speechSynthesis?.cancel();
            }}
            className={`p-2.5 rounded-xl transition-all duration-300 border ${
              ttsEnabled
                ? 'bg-emerald-50 text-emerald-600 border-emerald-200 shadow-sm shadow-emerald-100'
                : 'bg-slate-100 text-slate-400 border-slate-200 hover:text-slate-600'
            }`}
            title={ttsEnabled ? 'Disable text-to-speech' : 'Enable text-to-speech'}
          >
            {ttsEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-8 space-y-6 scrollbar-hide">
        <AnimatePresence initial={false}>
          {messages.map((message, index) => {
            const isUser = message.role === 'user';
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className={`flex ${isUser ? 'justify-end' : 'justify-start'} items-end gap-3`}
              >
                {!isUser && (
                  <div className="mb-2 p-2 bg-slate-100 border border-slate-200 rounded-xl">
                    <Bot className="w-4 h-4 text-emerald-600" />
                  </div>
                )}

                <div
                  className={`max-w-[75%] rounded-3xl p-5 shadow-lg transition-all ${isUser
                    ? 'bg-gradient-to-br from-emerald-600 to-green-700 text-white rounded-br-none shadow-emerald-200/50'
                    : 'bg-white border border-slate-200 text-slate-900 rounded-bl-none'
                    }`}
                >
                  <p className="text-sm leading-relaxed whitespace-pre-wrap font-medium">{message.parts}</p>
                  <div className={`mt-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-tighter ${isUser ? 'text-emerald-50/70' : 'text-slate-400'
                    }`}>
                    {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {isUser && <span className="opacity-50">• Sent</span>}
                    {/* Speak button for assistant messages */}
                    {!isUser && 'speechSynthesis' in window && (
                      <button
                        onClick={() => speakText(message.parts)}
                        className="ml-2 p-1 hover:bg-slate-100 rounded-lg transition-colors"
                        title="Read aloud"
                      >
                        <Volume2 className="w-3 h-3 text-slate-400 hover:text-emerald-600" />
                      </button>
                    )}
                  </div>
                </div>

                {isUser && (
                  <div className="mb-2 p-2 bg-emerald-500/20 rounded-xl">
                    <UserIcon className="w-4 h-4 text-emerald-400" />
                  </div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>

        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-start items-center gap-3"
          >
            <div className="p-2 bg-slate-100 border border-slate-200 rounded-xl">
              <Bot className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="bg-slate-100 border border-slate-200 rounded-3xl p-4 flex gap-1.5">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce" />
            </div>
          </motion.div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Voice listening indicator */}
      <AnimatePresence>
        {isListening && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="px-6 py-3 bg-gradient-to-r from-emerald-50 to-teal-50 border-t border-emerald-100 flex items-center gap-3"
          >
            <div className="voice-pulse-ring relative flex items-center justify-center">
              <Mic className="w-4 h-4 text-emerald-600 relative z-10" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider">
                Listening in {selectedLanguage.label}...
              </p>
              {interimTranscript && (
                <p className="text-sm text-emerald-600/80 font-medium truncate mt-0.5 italic">
                  "{interimTranscript}"
                </p>
              )}
            </div>
            <button
              onClick={stopListening}
              className="text-xs font-semibold text-emerald-600 hover:text-emerald-800 px-3 py-1.5 bg-emerald-100 hover:bg-emerald-200 rounded-lg transition-all"
            >
              Stop
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input Area */}
      <div className="p-6 bg-slate-50 border-t border-slate-200">
        <div className="relative group">
          <textarea
            value={input + (interimTranscript ? interimTranscript : '')}
            onChange={(e) => {
              setInput(e.target.value);
              setInterimTranscript('');
            }}
            onKeyPress={handleKeyPress}
            placeholder={isListening ? `Speak now in ${selectedLanguage.label}...` : 'Type or use voice input...'}
            className="w-full bg-white border border-slate-200 rounded-[1.5rem] px-6 py-5 pr-32 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all shadow-sm"
            rows={2}
            disabled={loading}
          />

          <div className="absolute right-3 bottom-3 flex items-center gap-2">
            {/* Mic Button */}
            {speechSupported && (
              <button
                onClick={toggleListening}
                disabled={loading}
                className={`p-3.5 rounded-2xl transition-all duration-300 ${
                  isListening
                    ? 'bg-red-500 text-white shadow-lg shadow-red-200 voice-pulse hover:bg-red-600'
                    : loading
                      ? 'bg-slate-200 text-slate-400'
                      : 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200 hover:scale-105 active:scale-95'
                }`}
                title={isListening ? 'Stop listening' : `Start voice input (${selectedLanguage.label})`}
              >
                {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>
            )}

            {/* Send Button */}
            <button
              onClick={sendMessage}
              disabled={!input.trim() || loading}
              className={`p-3.5 rounded-2xl transition-all duration-300 ${!input.trim() || loading
                ? 'bg-slate-200 text-slate-400'
                : 'bg-emerald-600 text-white shadow-lg shadow-emerald-200 hover:scale-105 active:scale-95'
                }`}
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
        <p className="text-[10px] text-slate-500 mt-3 text-center uppercase tracking-widest font-bold">
          Powered by AgriVision Neural Engine • Voice Input in {selectedLanguage.label} {selectedLanguage.flag}
        </p>
      </div>
    </div>
  );
};
