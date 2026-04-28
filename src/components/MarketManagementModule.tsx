import { useState, useRef, useEffect, useCallback } from 'react';
import { Store, TrendingUp, MapPin, DollarSign, Sparkles, Globe, Mic, MicOff, Volume2, VolumeX, ChevronDown, Loader2, Table, List } from 'lucide-react';
import { generateContent } from '../lib/genai';
import { VOICE_LANGUAGES } from '../lib/voice';
import { useVoice } from '../contexts/VoiceContext';
import { motion, AnimatePresence } from 'framer-motion';

interface MarketRow {
  category: string;
  details: string;
}

const parseMarketInfoToTable = (text: string): MarketRow[] => {
  const rows: MarketRow[] = [];
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
    } else if (/^[A-Z][a-zA-Z\s]+:$/.test(trimmed) || trimmed.match(/^(nearby|current|best|price|market|transportation|seasonal)/i)) {
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
    const sections = text.split(/(?=\d+\.|Nearby|Current|Best|Price|Market|Transportation|Seasonal)/i);
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

export const MarketManagementModule = () => {
  const [location, setLocation] = useState('');
  const [cropName, setCropName] = useState('');
  const [marketInfo, setMarketInfo] = useState<string>('');
  const [marketRows, setMarketRows] = useState<MarketRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'text' | 'table'>('table');

  // New states for Live Prices and GPS
  const [livePrices, setLivePrices] = useState<string>('');
  const [loadingPrices, setLoadingPrices] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  // Voice states
  const [isListening, setIsListening] = useState(false);
  const { ttsEnabled, setTtsEnabled, selectedLanguage, setSelectedLanguage, speechSupported } = useVoice();
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);
  const [activeInput, setActiveInput] = useState<'location' | 'cropName' | null>(null);

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
  const startListening = useCallback((inputField: 'location' | 'cropName') => {
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
      if (inputField === 'location') {
        setLocation(prev => (prev ? prev + ' ' : '') + transcript);
      } else if (inputField === 'cropName') {
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

  const toggleListening = (inputField: 'location' | 'cropName') => {
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

  const detectLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(async (position) => {
      try {
        const { latitude, longitude } = position.coords;
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
        const data = await res.json();
        const city = data.address?.city || data.address?.town || data.address?.village || data.address?.state_district;
        if (city) {
          setLocation(city);
        } else {
          setLocation(`${latitude.toFixed(2)}, ${longitude.toFixed(2)}`);
        }
      } catch (err) {
        console.error("Error getting location details:", err);
      } finally {
        setIsLocating(false);
      }
    }, (error) => {
      console.error(error);
      alert("Failed to detect location. Please ensure location services are enabled.");
      setIsLocating(false);
    });
  };

  const getLatestPrices = async () => {
    if (!location) return;
    setLoadingPrices(true);
    try {
      const prompt = `Provide the current estimated wholesale prices for 4-5 common agricultural crops/vegetables (like Tomatoes, Onions, Potatoes, Wheat) in or around ${location}. 
Include a short bullet list of prices. 
Listen to the farmer's voice and convert it into text. Detect the language and translate it into English if needed.
Give response in the same language as the user (${selectedLanguage.label}). Keep it simple and farmer-friendly. Keep it brief and structured.`;
      const response = await generateContent(prompt);
      setLivePrices(response);
    } catch (error) {
      console.error('Error getting prices:', error);
      setLivePrices('Failed to load prices. Overloaded feed.');
    } finally {
      setLoadingPrices(false);
    }
  };

  const getMarketInformation = async () => {
    if (!location || !cropName) return;

    setLoading(true);
    setMarketInfo('');
    setMarketRows([]);
    try {
      const prompt = `As an agricultural market analyst, provide concise market information for ${cropName} in ${location}.

Provide exactly these 8 sections with brief answers (1-2 sentences each):
1. Nearby Markets: List major mandis in/near ${location}
2. Current Price: Estimated price range for ${cropName}
3. Best Sell Markets: Where to get best rates
4. Price Comparison: Price differences if any
5. Market Days: When markets operate
6. Transport Tips: How to transport produce
7. Storage Tips: How to store before selling
8. Seasonal Trend: Price changes by season

Respond in the same language as the user (${selectedLanguage.label}). Keep answers very brief and factual.`;

      const response = await generateContent(prompt);
      setMarketInfo(response);
      const rows = parseMarketInfoToTable(response);
      setMarketRows(rows);
      speakText(response);
    } catch (error) {
      console.error('Error getting market information:', error);
      setMarketInfo('Failed to get market information. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 pb-12">
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass-card rounded-[2.5rem] p-8 lg:p-12 border-blue-200"
      >
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
          <div>
            <h2 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
              <Store className="w-9 h-9 text-blue-600" />
              Market Nexus
            </h2>
            <p className="text-slate-600 mt-2 font-medium">Real-time agricultural trade intelligence</p>
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            <div className="px-4 py-2 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center gap-2 text-blue-600 text-sm font-bold uppercase tracking-widest hidden sm:flex">
              <Globe className="w-4 h-4" />
              Live Feed
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
                    <Globe className="w-4 h-4 text-blue-600" />
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
                              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all text-sm ${selectedLanguage.code === lang.code
                                  ? 'bg-blue-50 text-blue-800 font-semibold border border-blue-200'
                                  : 'hover:bg-slate-50 text-slate-700'
                                }`}
                            >
                              <span className="text-lg">{lang.flag}</span>
                              <span className="flex-1">{lang.label}</span>
                              {selectedLanguage.code === lang.code && (
                                <span className="flex h-2 w-2 rounded-full bg-blue-500" />
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
                className={`p-2.5 rounded-xl transition-all duration-300 border ${ttsEnabled
                    ? 'bg-blue-50 text-blue-600 border-blue-200 shadow-sm shadow-blue-100'
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
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Trade Location</label>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g., Amritsar, IN"
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 pr-24 text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all outline-none"
                  />
                  <div className="absolute right-2 flex items-center gap-1">
                    <button
                      onClick={detectLocation}
                      disabled={isLocating}
                      className="p-2.5 text-slate-400 hover:text-blue-600 rounded-xl hover:bg-blue-50 transition-all disabled:opacity-50"
                      title="Detect My Location"
                    >
                      {isLocating ? <Loader2 className="w-5 h-5 animate-spin" /> : <MapPin className="w-5 h-5" />}
                    </button>
                    {speechSupported && (
                      <button
                        onClick={() => toggleListening('location')}
                        className={`p-2.5 rounded-xl transition-all ${
                          isListening && activeInput === 'location'
                            ? 'bg-red-500 text-white voice-pulse'
                            : 'text-slate-400 hover:bg-blue-50 hover:text-blue-600'
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
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Consignment Type</label>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    value={cropName}
                    onChange={(e) => setCropName(e.target.value)}
                    placeholder="e.g., Basmati Rice"
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 pr-12 text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all outline-none"
                  />
                  {speechSupported && (
                    <button
                      onClick={() => toggleListening('cropName')}
                      className={`absolute right-3 p-2.5 rounded-xl transition-all ${
                        isListening && activeInput === 'cropName'
                          ? 'bg-red-500 text-white voice-pulse'
                          : 'text-slate-400 hover:bg-blue-50 hover:text-blue-600'
                      }`}
                      title="Voice Input"
                    >
                      {isListening && activeInput === 'cropName' ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Google Maps Embed */}
            <AnimatePresence>
              {location && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="rounded-[1.5rem] overflow-hidden border border-slate-200 bg-slate-100 relative shadow-inner aspect-video md:aspect-[21/9]"
                >
                  <iframe
                    width="100%"
                    height="100%"
                    src={`https://maps.google.com/maps?q=${encodeURIComponent('Agricultural Market near ' + location)}&t=&z=12&ie=UTF8&iwloc=&output=embed`}
                    frameBorder="0"
                    scrolling="no"
                    marginHeight={0}
                    marginWidth={0}
                    className="absolute inset-0 grayscale-[20%] contrast-[1.05]"
                  ></iframe>
                </motion.div>
              )}
            </AnimatePresence>

            <button
              onClick={getMarketInformation}
              disabled={!location || !cropName || loading}
              className={`w-full py-5 rounded-[1.5rem] font-bold text-lg flex items-center justify-center gap-3 transition-all duration-300 ${!location || !cropName || loading
                ? 'bg-slate-100 text-slate-400 italic'
                : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-xl shadow-blue-200 hover:scale-[1.02] active:scale-95'
                }`}
            >
              {loading ? (
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                  Analyzing Global Trends...
                </div>
              ) : (
                <>
                  <TrendingUp className="w-6 h-6" />
                  Optimize Trade Velocity
                </>
              )}
            </button>
          </div>

          <div className="lg:col-span-2 flex flex-col gap-6">
            <div className="bg-blue-50 border border-blue-100 rounded-[2rem] p-6 flex-1 flex flex-col justify-center">
              <h3 className="text-lg font-bold text-blue-700 mb-6 flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                Profit Strategy
              </h3>
              <ul className="space-y-4">
                {[
                  "Inter-mandi price arbitrage",
                  "Demand-curve optimization",
                  "Logistics yield protection",
                  "Direct-to-consumer routes"
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm text-slate-700 font-medium">
                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full shadow-[0_0_8px_#3b82f6]" />
                    {item}
                  </li>
                ))}
              </ul>
              <div className="mt-8 pt-6 border-t border-white/5">
                <p className="text-[10px] text-slate-600 uppercase tracking-widest font-bold flex items-center gap-2">
                  <Sparkles className="w-3 h-3 text-amber-500" />
                  AI Market Insights Active
                </p>
              </div>
            </div>

            {/* Live Price Estimates Card */}
            <div className="bg-white border border-slate-200 rounded-[2rem] p-6 shadow-sm flex flex-col">
              <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-600" />
                Live Price Estimates
              </h3>
              {livePrices ? (
                <div className="prose prose-sm text-slate-600 max-h-48 overflow-y-auto pr-2 scrollbar-hide flex-1 font-medium pb-2">
                  <div className="whitespace-pre-wrap">{livePrices}</div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col justify-end">
                  <p className="text-sm text-slate-500 font-medium mb-4">
                    Fetch real-time estimated wholesale prices for common crops in your selected region.
                  </p>
                  <button 
                    onClick={getLatestPrices}
                    disabled={!location || loadingPrices}
                    className="w-full py-3.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-[1rem] text-sm font-bold transition-all flex items-center justify-center gap-2 border border-emerald-200 disabled:opacity-50 disabled:hover:bg-emerald-50"
                  >
                    {loadingPrices ? <Loader2 className="w-5 h-5 animate-spin" /> : "Fetch Latest Prices"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      <AnimatePresence>
        {marketInfo && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="glass-card rounded-[2.5rem] p-8 lg:p-12 overflow-hidden relative border-blue-200"
          >
            <div className="absolute top-0 right-0 p-8 opacity-5">
              <DollarSign className="w-32 h-32 text-blue-400" />
            </div>

            <div className="flex items-center justify-between border-b border-slate-200 pb-4 mb-8">
              <h3 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
                <TrendingUp className="w-6 h-6 text-blue-600" />
                Market Analysis Report
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setViewMode('table')}
                  className={`p-2.5 rounded-xl transition-all ${
                    viewMode === 'table' 
                      ? 'bg-blue-100 text-blue-600' 
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
                      ? 'bg-blue-100 text-blue-600' 
                      : 'text-slate-400 hover:bg-slate-100'
                  }`}
                  title="Text View"
                >
                  <List className="w-5 h-5" />
                </button>
                {'speechSynthesis' in window && (
                  <button
                    onClick={() => speakText(marketInfo)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl transition-colors font-semibold text-sm ml-2"
                    title="Read aloud"
                  >
                    <Volume2 className="w-4 h-4" />
                    Read Aloud
                  </button>
                )}
              </div>
            </div>

            {viewMode === 'table' && marketRows.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2 border-blue-200">
                      <th className="text-left py-3 px-4 text-sm font-bold text-blue-700 uppercase tracking-wider">Category</th>
                      <th className="text-left py-3 px-4 text-sm font-bold text-blue-700 uppercase tracking-wider">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {marketRows.map((row, i) => (
                      <tr key={i} className="border-b border-slate-100 hover:bg-blue-50/50 transition-colors">
                        <td className="py-3 px-4 text-sm font-bold text-slate-800">{row.category}</td>
                        <td className="py-3 px-4 text-sm text-slate-600">{row.details}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="prose prose-invert max-w-none prose-blue">
                <div className="text-slate-800 whitespace-pre-wrap leading-relaxed space-y-4 font-medium">
                  {marketInfo}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
