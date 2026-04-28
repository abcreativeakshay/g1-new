export interface VoiceLanguage {
  code: string;
  label: string;
  flag: string;
}

export const VOICE_LANGUAGES: VoiceLanguage[] = [
  { code: 'en-US', label: 'English (US)', flag: '🇺🇸' },
  { code: 'en-GB', label: 'English (UK)', flag: '🇬🇧' },
  { code: 'en-IN', label: 'English (India)', flag: '🇮🇳' },
  { code: 'hi-IN', label: 'हिन्दी (Hindi)', flag: '🇮🇳' },
  { code: 'mr-IN', label: 'मराठी (Marathi)', flag: '🇮🇳' },
  { code: 'ta-IN', label: 'தமிழ் (Tamil)', flag: '🇮🇳' },
  { code: 'te-IN', label: 'తెలుగు (Telugu)', flag: '🇮🇳' },
  { code: 'kn-IN', label: 'ಕನ್ನಡ (Kannada)', flag: '🇮🇳' },
  { code: 'bn-IN', label: 'বাংলা (Bengali)', flag: '🇮🇳' },
  { code: 'gu-IN', label: 'ગુજરાતી (Gujarati)', flag: '🇮🇳' },
  { code: 'pa-IN', label: 'ਪੰਜਾਬੀ (Punjabi)', flag: '🇮🇳' },
  { code: 'ml-IN', label: 'മലയാളം (Malayalam)', flag: '🇮🇳' },
  { code: 'ur-IN', label: 'اردو (Urdu)', flag: '🇮🇳' },
  { code: 'es-ES', label: 'Español (Spanish)', flag: '🇪🇸' },
  { code: 'fr-FR', label: 'Français (French)', flag: '🇫🇷' },
  { code: 'de-DE', label: 'Deutsch (German)', flag: '🇩🇪' },
  { code: 'pt-BR', label: 'Português (Brazil)', flag: '🇧🇷' },
  { code: 'zh-CN', label: '中文 (Chinese)', flag: '🇨🇳' },
  { code: 'ja-JP', label: '日本語 (Japanese)', flag: '🇯🇵' },
  { code: 'ko-KR', label: '한국어 (Korean)', flag: '🇰🇷' },
  { code: 'ar-SA', label: 'العربية (Arabic)', flag: '🇸🇦' },
  { code: 'ru-RU', label: 'Русский (Russian)', flag: '🇷🇺' },
  { code: 'it-IT', label: 'Italiano (Italian)', flag: '🇮🇹' },
  { code: 'th-TH', label: 'ไทย (Thai)', flag: '🇹🇭' },
  { code: 'vi-VN', label: 'Tiếng Việt (Vietnamese)', flag: '🇻🇳' },
  { code: 'id-ID', label: 'Bahasa Indonesia', flag: '🇮🇩' },
  { code: 'ms-MY', label: 'Bahasa Melayu (Malay)', flag: '🇲🇾' },
  { code: 'sw-KE', label: 'Kiswahili (Swahili)', flag: '🇰🇪' },
  { code: 'tr-TR', label: 'Türkçe (Turkish)', flag: '🇹🇷' },
  { code: 'nl-NL', label: 'Nederlands (Dutch)', flag: '🇳🇱' },
  { code: 'pl-PL', label: 'Polski (Polish)', flag: '🇵🇱' },
];
