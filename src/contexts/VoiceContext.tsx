import React, { createContext, useContext, useState, useEffect } from 'react';
import { VOICE_LANGUAGES, VoiceLanguage } from '../lib/voice';

interface VoiceContextType {
  ttsEnabled: boolean;
  setTtsEnabled: (enabled: boolean) => void;
  selectedLanguage: VoiceLanguage;
  setSelectedLanguage: (lang: VoiceLanguage) => void;
  speechSupported: boolean;
}

const VoiceContext = createContext<VoiceContextType | undefined>(undefined);

export const VoiceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<VoiceLanguage>(VOICE_LANGUAGES[0]);
  const [speechSupported, setSpeechSupported] = useState(false);

  useEffect(() => {
    // Check Speech API support
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    setSpeechSupported(!!SpeechRecognitionAPI);
  }, []);

  return (
    <VoiceContext.Provider
      value={{
        ttsEnabled,
        setTtsEnabled,
        selectedLanguage,
        setSelectedLanguage,
        speechSupported,
      }}
    >
      {children}
    </VoiceContext.Provider>
  );
};

export const useVoice = () => {
  const context = useContext(VoiceContext);
  if (context === undefined) {
    throw new Error('useVoice must be used within a VoiceProvider');
  }
  return context;
};
