import { useState, useRef, useEffect, useCallback } from 'react';
import { Bug, Shield as ShieldIcon, AlertTriangle, Leaf, Calendar as CalendarIcon, Mic, MicOff, Volume2, VolumeX, Globe, ChevronDown, Table, List } from 'lucide-react';
import { generateContent } from '../lib/genai';
import { VOICE_LANGUAGES } from '../lib/voice';
import { useVoice } from '../contexts/VoiceContext';
import { motion, AnimatePresence } from 'framer-motion';

interface PestRow {
  category: string;
  details: string;
}

const parsePestInfoToTable = (text: string): PestRow[] => {
  const rows: PestRow[] = [];
  const lines = text.split('\n');
  let currentCategory = '';
  let currentDetails = '';
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    if (/^\d+[.)]\s*/.test(trimmed) || /^[-•]\s*/.test(trimmed)) {
      if (currentCategory && currentDetails) {
        rows.push({ category: currentCategory, details: currentDetails.trim() });
      }
      currentCategory = trimmed.replace(/^[\d.-\u2022 )]+/, '').replace(/^[^a-zA-Z]+/, '');
      currentDetails = '';
    } else if (/^[A-Z][a-zA-Z\s]+:$/.test(trimmed) || trimmed.match(/^(common|seasonal|symptoms|prevention|control|recommended|integrated)/i)) {
      if (currentCategory && currentDetails) {
        rows.push({ category: currentCategory, details: currentDetails.trim() });
      }
      currentCategory = trimmed.replace(/:$/, '');
      currentDetails = '';
    } else {
      currentDetails += ' ' + trimmed;
    }
  }
  
  if (currentCategory && currentDetails) {
    rows.push({ category: currentCategory, details: currentDetails.trim() });
  }
  
  if (rows.length === 0) {
    const sections = text.split(/(?=\d+\.|Common|Seasonal|Symptoms|Prevention|Control|Recommended|Integrated)/i);
    for (const section of sections) {
      if (section.trim().length > 10) {
        const firstLine = section.split('\n')[0].trim();
        const rest = section.split('\n').slice(1).join(' ').trim();
        if (firstLine && rest) {
          rows.push({ category: firstLine.replace(/^[\d.\s]+/, ''), details: rest });
        }
      }
    }
  }
  
  return rows.slice(0, 12);
};

export const PestManagementModule = () => {
  const [cropName, setCropName] = useState('');
  const [season, setSeason] = useState('');
  const [pestInfo, setPestInfo] = useState<string>('');
  const [pestRows, setPestRows] = useState<PestRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'text' | 'table'>('table');

  // Voice states
  const [isListening, setIsListening] = useState(false);
  const { ttsEnabled, setTtsEnabled, selectedLanguage, setSelectedLanguage, speechSupported } = useVoice();
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);
  const [activeInput, setActiveInput] = useState<'cropName' | null>(null);

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

  // Text-to-Speech
  const speakText = useCallback((text: string) => {
    if (!ttsEnabled || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = selectedLanguage.code;
    utterance.rate = 0.95;
    utterance.pitch = 1;

    const voices = window.speechSynthesis.getVoices();
    const langPrefix = selectedLanguage.code.split('-')[0];
    const matchingVoice = voices.find(v => v.lang.startsWith(langPrefix));
    if (matchingVoice) {
      utterance.voice = matchingVoice;
    }

    window.speechSynthesis.speak(utterance);
  }, [ttsEnabled, selectedLanguage]);

  // Speech Recognition
  const startListening = useCallback((inputField: 'cropName') => {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) return;

    if (recognitionRef.current) {
      recognitionRef.current.abort();
    }

    setActiveInput(inputField);
    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = selectedLanguage.code;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0][0].transcript;
      if (inputField === 'cropName') {
        setCropName(prev => (prev ? prev + ' ' : '') + transcript);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
      setActiveInput(null);
    };

    recognition.onend = () => {
      setIsListening(false);
      setActiveInput(null);
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
    setActiveInput(null);
  }, []);

  const toggleListening = (inputField: 'cropName') => {
    if (isListening && activeInput === inputField) {
      stopListening();
    } else {
      startListening(inputField);
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

  const getPestInformation = async () => {
    if (!cropName) return;

    setLoading(true);
    setPestInfo('');
    setPestRows([]);
    try {
      const prompt = `As a pest management expert, provide concise information about common pests affecting ${cropName} during ${season || 'all seasons'}.

Provide exactly these 8 sections with brief answers (1-2 sentences each):
1. Common Pests: List main insects and diseases
2. Seasonal Pattern: When pests are most active
3. Symptoms: How to identify infestations
4. Prevention: Best prevention practices
5. Control Methods: Organic options first
6. Chemical Treatment: Recommended products
7. IPM Approach: Integrated pest management
8. Emergency Response: What to do if severe

Respond in the same language as the user (${selectedLanguage.label}). Keep answers very brief and factual.`;

      const response = await generateContent(prompt);
      setPestInfo(response);
      const rows = parsePestInfoToTable(response);
      setPestRows(rows);
      speakText(response);
    } catch (error) {
      console.error('Error getting pest information:', error);
      const friendlyMsg =
        error instanceof Error ? error.message : '❌ Something went wrong. Please try again.';
      setPestInfo(friendlyMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 pb-12">
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass-card rounded-[2.5rem] p-8 lg:p-12 border-orange-200"
      >
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
          <div>
            <h2 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
              <Bug className="w-9 h-9 text-orange-600" />
              Pest Sentinel
            </h2>
            <p className="text-slate-600 mt-2 font-medium">Advanced diagnostic & protection protocols</p>
          </div>
          
          <div className="flex items-center gap-4 flex-wrap">
            <div className="px-4 py-2 bg-orange-500/10 border border-orange-500/20 rounded-xl flex items-center gap-2 text-orange-600 text-sm font-bold uppercase tracking-widest hidden sm:flex">
              <ShieldIcon className="w-4 h-4" />
              Shield Active
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
                    <Globe className="w-4 h-4 text-orange-600" />
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
                                if (isListening) stopListening();
                              }}
                              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all text-sm ${
                                selectedLanguage.code === lang.code
                                  ? 'bg-orange-50 text-orange-800 font-semibold border border-orange-200'
                                  : 'hover:bg-slate-50 text-slate-700'
                              }`}
                            >
                              <span className="text-lg">{lang.flag}</span>
                              <span className="flex-1">{lang.label}</span>
                              {selectedLanguage.code === lang.code && (
                                <span className="flex h-2 w-2 rounded-full bg-orange-500" />
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
                    ? 'bg-orange-50 text-orange-600 border-orange-200 shadow-sm shadow-orange-100'
                    : 'bg-slate-100 text-slate-400 border-slate-200 hover:text-slate-600'
                }`}
                title={ttsEnabled ? 'Disable text-to-speech' : 'Enable text-to-speech'}
              >
                {ttsEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-5 gap-10">
          <div className="lg:col-span-3 space-y-8">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Affected Crop</label>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    value={cropName}
                    onChange={(e) => setCropName(e.target.value)}
                    placeholder="e.g., Rice, Cotton"
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 pr-12 text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 transition-all outline-none"
                  />
                  {speechSupported && (
                    <button
                      onClick={() => toggleListening('cropName')}
                      className={`absolute right-3 p-2 rounded-xl transition-all ${
                        isListening && activeInput === 'cropName'
                          ? 'bg-red-500 text-white voice-pulse'
                          : 'text-slate-400 hover:bg-orange-100 hover:text-orange-600'
                      }`}
                      title="Voice Input"
                    >
                      {isListening && activeInput === 'cropName' ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Threat Season</label>
                <div className="relative">
                  <select
                    value={season}
                    onChange={(e) => setSeason(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-slate-900 focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 transition-all outline-none appearance-none"
                  >
                    <option value="" className="bg-white">All Seasons</option>
                    <option value="spring" className="bg-white">Spring</option>
                    <option value="summer" className="bg-white">Summer</option>
                    <option value="monsoon" className="bg-white">Monsoon</option>
                    <option value="autumn" className="bg-white">Autumn</option>
                    <option value="winter" className="bg-white">Winter</option>
                  </select>
                  <CalendarIcon className="absolute right-4 top-4 w-5 h-5 text-slate-600 pointer-events-none" />
                </div>
              </div>
            </div>

            <button
              onClick={getPestInformation}
              disabled={!cropName || loading}
              className={`w-full py-5 rounded-[1.5rem] font-bold text-lg flex items-center justify-center gap-3 transition-all duration-300 ${!cropName || loading
                ? 'bg-slate-100 text-slate-400 italic'
                : 'bg-gradient-to-r from-orange-600 to-red-600 text-white shadow-xl shadow-orange-200 hover:scale-[1.02] active:scale-95'
                }`}
            >
              {loading ? (
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                  Scanning Bio-Hazards...
                </div>
              ) : (
                <>
                  <ShieldIcon className="w-6 h-6" />
                  Initiate Diagnosis
                </>
              )}
            </button>
          </div>

          <div className="lg:col-span-2 space-y-4">
            <div className="bg-orange-50 border border-orange-100 rounded-[2rem] p-6">
              <h3 className="text-lg font-bold text-orange-700 mb-4 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                Threat Intelligence
              </h3>
              <ul className="space-y-3">
                {[
                  "Early mutation detection",
                  "IPM integrated strategy",
                  "Organic override options",
                  "Beneficial insect safe-lists"
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm text-slate-700 font-medium">
                    <span className="w-1.5 h-1.5 bg-orange-500 rounded-full" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-emerald-50 border border-emerald-100 rounded-[2rem] p-6">
              <h3 className="text-lg font-bold text-emerald-700 mb-4 flex items-center gap-2">
                <Leaf className="w-5 h-5" />
                Eco-Pulse
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                AgriVision prioritizes sustainable biomes. Whenever possible, our AI suggests biological controls over harsh synthetics to maintain field health.
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      <AnimatePresence>
        {pestInfo && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="glass-card rounded-[2.5rem] p-8 lg:p-12 overflow-hidden relative border-red-200"
          >
            <div className="absolute top-0 right-0 p-8 opacity-5">
              <Bug className="w-32 h-32 text-orange-400" />
            </div>
            
            <div className="flex items-center justify-between border-b border-slate-200 pb-4 mb-8">
              <h3 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
                <ShieldIcon className="w-6 h-6 text-orange-600" />
                Defense Strategy
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setViewMode('table')}
                  className={`p-2.5 rounded-xl transition-all ${
                    viewMode === 'table' 
                      ? 'bg-orange-100 text-orange-600' 
                      : 'text-slate-400 hover:bg-slate-100'
                  }`}
                  title="Table View"
                >
                  <Table className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setViewMode('text')}
                  className={`p-2.5 rounded-xl transition-all ${
                    viewMode === 'text' 
                      ? 'bg-orange-100 text-orange-600' 
                      : 'text-slate-400 hover:bg-slate-100'
                  }`}
                  title="Text View"
                >
                  <List className="w-5 h-5" />
                </button>
                {'speechSynthesis' in window && (
                  <button
                    onClick={() => speakText(pestInfo)}
                    className="flex items-center gap-2 px-4 py-2 bg-orange-50 text-orange-600 hover:bg-orange-100 rounded-xl transition-colors font-semibold text-sm ml-2"
                    title="Read aloud"
                  >
                    <Volume2 className="w-4 h-4" />
                    Read Aloud
                  </button>
                )}
              </div>
            </div>

            {viewMode === 'table' && pestRows.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2 border-orange-200">
                      <th className="text-left py-3 px-4 text-sm font-bold text-orange-700 uppercase tracking-wider">Category</th>
                      <th className="text-left py-3 px-4 text-sm font-bold text-orange-700 uppercase tracking-wider">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pestRows.map((row, i) => (
                      <tr key={i} className="border-b border-slate-100 hover:bg-orange-50/50 transition-colors">
                        <td className="py-3 px-4 text-sm font-bold text-slate-800">{row.category}</td>
                        <td className="py-3 px-4 text-sm text-slate-600">{row.details}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="prose prose-invert max-w-none prose-orange">
                <div className="text-slate-800 whitespace-pre-wrap leading-relaxed space-y-4 font-medium">
                  {pestInfo}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
