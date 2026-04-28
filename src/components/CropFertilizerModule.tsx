import { useState, useRef, useEffect, useCallback } from 'react';
import { Sprout, Calendar, TrendingUp, Sparkles, AlertCircle, Mic, MicOff, Volume2, VolumeX, Globe, ChevronDown, Table, List } from 'lucide-react';
import { generateContent } from '../lib/genai';
import { VOICE_LANGUAGES } from '../lib/voice';
import { useVoice } from '../contexts/VoiceContext';
import { motion, AnimatePresence } from 'framer-motion';

interface RecommendationRow {
  category: string;
  details: string;
}

const parseRecommendationsToTable = (text: string): RecommendationRow[] => {
  const rows: RecommendationRow[] = [];
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
    } else if (/^[A-Z][a-zA-Z\s]+:$/.test(trimmed) || trimmed.match(/^(recommended|optimal|application|soil|expected|nearby|compare)/i)) {
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
    const sections = text.split(/(?=\d+\.|Recommended|Optimal|Application|Soil|Expected|Yield|Compare|Fertilizer|Planting)/i);
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

export const CropFertilizerModule = () => {
  const [cropName, setCropName] = useState('');
  const [location, setLocation] = useState('');
  const [season, setSeason] = useState('');
  const [recommendations, setRecommendations] = useState<string>('');
  const [recommendationRows, setRecommendationRows] = useState<RecommendationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'text' | 'table'>('table');

  // Voice states
  const [isListening, setIsListening] = useState(false);
  const { ttsEnabled, setTtsEnabled, selectedLanguage, setSelectedLanguage, speechSupported } = useVoice();
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);
  const [activeInput, setActiveInput] = useState<'cropName' | 'location' | null>(null);

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
  const startListening = useCallback((inputField: 'cropName' | 'location') => {
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
      } else if (inputField === 'location') {
        setLocation(prev => (prev ? prev + ' ' : '') + transcript);
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

  const toggleListening = (inputField: 'cropName' | 'location') => {
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

  const getRecommendations = async () => {
    if (!cropName || !location) return;

    setLoading(true);
    setRecommendations('');
    setRecommendationRows([]);
    try {
      const prompt = `As an agricultural expert, provide concise recommendations for growing ${cropName} in ${location} during ${season || 'current season'}.

Provide exactly these 8 sections with brief answers (1-2 sentences each):
1. Planting Time: When and how to plant
2. Soil Preparation: Key soil requirements
3. NPK Ratio: Specific nitrogen, phosphorus, potassium numbers
4. Fertilizer Type: Organic vs chemical recommendations
5. Application Schedule: When and how much to apply
6. Water Needs: Irrigation requirements
7. Expected Yield: Harvest timeline and yield
8. Pest Prevention: Common pests and prevention

Respond in the same language as the user (${selectedLanguage.label}). Keep answers very brief and factual.`;

      const response = await generateContent(prompt);
      setRecommendations(response);
      const rows = parseRecommendationsToTable(response);
      setRecommendationRows(rows);
      speakText(response);
    } catch (error) {
      console.error('Error getting recommendations:', error);
      const friendlyMsg =
        error instanceof Error ? error.message : '❌ Something went wrong. Please try again.';
      setRecommendations(friendlyMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 pb-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card rounded-[2.5rem] p-8 lg:p-12"
      >
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
          <div>
            <h2 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
              <Sprout className="w-9 h-9 text-emerald-600" />
              Crop Intelligence
            </h2>
            <p className="text-slate-600 mt-2 font-medium">Precision fertilizer & cultivation strategies</p>
          </div>
          
          <div className="flex items-center gap-4 flex-wrap">
            <div className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-2 text-emerald-600 text-sm font-bold uppercase tracking-widest hidden sm:flex">
              <Sparkles className="w-4 h-4" />
              AI Analysis
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
                                if (isListening) stopListening();
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
        </div>

        <div className="grid lg:grid-cols-5 gap-10">
          <div className="lg:col-span-3 space-y-8">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Target Crop</label>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    value={cropName}
                    onChange={(e) => setCropName(e.target.value)}
                    placeholder="e.g., Wheat, Tomato"
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 pr-12 text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all outline-none"
                  />
                  {speechSupported && (
                    <button
                      onClick={() => toggleListening('cropName')}
                      className={`absolute right-3 p-2 rounded-xl transition-all ${
                        isListening && activeInput === 'cropName'
                          ? 'bg-red-500 text-white voice-pulse'
                          : 'text-slate-400 hover:bg-emerald-100 hover:text-emerald-600'
                      }`}
                      title="Voice Input"
                    >
                      {isListening && activeInput === 'cropName' ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Cultivation Zone</label>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g., Punjab, IN"
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 pr-12 text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all outline-none"
                  />
                  {speechSupported && (
                    <button
                      onClick={() => toggleListening('location')}
                      className={`absolute right-3 p-2 rounded-xl transition-all ${
                        isListening && activeInput === 'location'
                          ? 'bg-red-500 text-white voice-pulse'
                          : 'text-slate-400 hover:bg-emerald-100 hover:text-emerald-600'
                      }`}
                      title="Voice Input"
                    >
                      {isListening && activeInput === 'location' ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Growth Season</label>
              <div className="relative">
                <select
                  value={season}
                  onChange={(e) => setSeason(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-slate-900 focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all outline-none appearance-none"
                >
                  <option value="" className="bg-white">Current Season</option>
                  <option value="spring" className="bg-white">Spring</option>
                  <option value="summer" className="bg-white">Summer</option>
                  <option value="monsoon" className="bg-white">Monsoon</option>
                  <option value="autumn" className="bg-white">Autumn</option>
                  <option value="winter" className="bg-white">Winter</option>
                </select>
                <Calendar className="absolute right-4 top-4 w-5 h-5 text-slate-600 pointer-events-none" />
              </div>
            </div>

            <button
              onClick={getRecommendations}
              disabled={!cropName || !location || loading}
              className={`w-full py-5 rounded-[1.5rem] font-bold text-lg flex items-center justify-center gap-3 transition-all duration-300 ${!cropName || !location || loading
                ? 'bg-slate-100 text-slate-400 italic'
                : 'bg-gradient-to-r from-emerald-600 to-green-600 text-white shadow-xl shadow-emerald-200 hover:scale-[1.02] active:scale-95'
                }`}
            >
              {loading ? (
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                  Processing Soil Data...
                </div>
              ) : (
                <>
                  <TrendingUp className="w-6 h-6" />
                  Generate Protocol
                </>
              )}
            </button>
          </div>

          <div className="lg:col-span-2">
            <div className="bg-emerald-50 border border-emerald-100 rounded-[2rem] p-8 h-full">
              <h3 className="text-xl font-bold text-emerald-700 mb-6 flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                Intelligence Specs
              </h3>
              <ul className="space-y-5">
                {[
                  "Optimized NPK nutrient ratios",
                  "Soil enrichment protocols",
                  "Precision application schedules",
                  "Yield velocity projections",
                  "Local chemical supply nodes"
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-4 text-slate-700 font-medium">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.3)]" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </motion.div>

      <AnimatePresence>
        {recommendations && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="glass-card rounded-[2.5rem] p-8 lg:p-12 overflow-hidden relative"
          >
            <div className="absolute top-0 right-0 p-8 opacity-5">
              <TrendingUp className="w-32 h-32 text-white" />
            </div>
            
            <div className="flex items-center justify-between border-b border-slate-200 pb-4 mb-8">
              <h3 className="text-2xl font-bold text-slate-900">
                Cultivation Protocol
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setViewMode('table')}
                  className={`p-2.5 rounded-xl transition-all ${
                    viewMode === 'table' 
                      ? 'bg-emerald-100 text-emerald-600' 
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
                      ? 'bg-emerald-100 text-emerald-600' 
                      : 'text-slate-400 hover:bg-slate-100'
                  }`}
                  title="Text View"
                >
                  <List className="w-5 h-5" />
                </button>
                {'speechSynthesis' in window && (
                  <button
                    onClick={() => speakText(recommendations)}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-xl transition-colors font-semibold text-sm ml-2"
                    title="Read aloud"
                  >
                    <Volume2 className="w-4 h-4" />
                    Read Aloud
                  </button>
                )}
              </div>
            </div>

            {viewMode === 'table' && recommendationRows.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2 border-emerald-200">
                      <th className="text-left py-3 px-4 text-sm font-bold text-emerald-700 uppercase tracking-wider">Category</th>
                      <th className="text-left py-3 px-4 text-sm font-bold text-emerald-700 uppercase tracking-wider">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recommendationRows.map((row, i) => (
                      <tr key={i} className="border-b border-slate-100 hover:bg-emerald-50/50 transition-colors">
                        <td className="py-3 px-4 text-sm font-bold text-slate-800">{row.category}</td>
                        <td className="py-3 px-4 text-sm text-slate-600">{row.details}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="prose prose-invert max-w-none prose-emerald">
                <div className="text-slate-800 whitespace-pre-wrap leading-relaxed space-y-4">
                  {recommendations}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
