/**
 * UGNAY AI Engine & Voice Synthesis Service.
 * Powered by EXPO_PUBLIC_OPENAI_KEY for real-time speech analysis & voice interaction.
 */

import { IncidentType, Priority } from '@/types/incident';

const OPENAI_KEY = process.env.EXPO_PUBLIC_OPENAI_KEY || '';

export interface AIAnalysisResult {
  incident_type: IncidentType | 'UNMATCHED';
  is_emergency: boolean;
  matched_responder: 'FIRE_DEPT' | 'EMS_AMBULANCE' | 'POLICE_DEPT' | 'FLOOD_DRRMO' | 'NONE';
  category_tags: string[];
  confidence?: number;
  priority: Priority;
  person?: string;
  situation?: string;
  floor?: string;
  location?: string;
  landmark?: string;
  known_facts: string[];
  missing_information: string[];
  summary: string;
}

function cleanMissingInformation(missingItems: string[], speechText: string): string[] {
  const textLower = speechText.toLowerCase();

  return missingItems.filter((item) => {
    const itemLower = item.toLowerCase();

    // Check if suspect description is already given in speech
    if (itemLower.includes('suspect') || itemLower.includes('armed') || itemLower.includes('robber')) {
      if (
        textLower.includes('hoodie') ||
        textLower.includes('suspect') ||
        textLower.includes('male') ||
        textLower.includes('female') ||
        textLower.includes('wearing') ||
        textLower.includes('handgun') ||
        textLower.includes('gun') ||
        textLower.includes('weapon') ||
        textLower.includes('jeans') ||
        textLower.includes('mask')
      ) {
        return false; // Suspect described!
      }
    }

    // Check if bystander / victim status is already given in speech
    if (
      itemLower.includes('bystander') ||
      itemLower.includes('victim') ||
      itemLower.includes('affected') ||
      itemLower.includes('people') ||
      itemLower.includes('status')
    ) {
      if (
        textLower.includes('uninjured') ||
        textLower.includes('safe') ||
        textLower.includes('quiet') ||
        textLower.includes('hiding') ||
        textLower.includes('injured') ||
        textLower.includes('bystanders') ||
        textLower.includes('trapped')
      ) {
        return false; // Bystander status stated!
      }
    }

    // Check if location is already given in speech
    if (itemLower.includes('location') || itemLower.includes('address') || itemLower.includes('pinpoint')) {
      if (
        textLower.includes('street') ||
        textLower.includes('corner') ||
        textLower.includes('store') ||
        textLower.includes('road') ||
        textLower.includes('ave') ||
        textLower.includes('brgy') ||
        textLower.includes('barangay') ||
        textLower.includes('hall') ||
        textLower.includes('purok') ||
        textLower.includes('st.')
      ) {
        return false; // Location already given!
      }
    }

    return true;
  });
}

export function isValidEmergencyDetail(text: string): { isValid: boolean; reason?: string } {
  if (!text || typeof text !== 'string') {
    return { isValid: false, reason: 'Empty detail. Please provide actual emergency details.' };
  }

  const cleaned = sanitizeTranscript(text);
  const trimmed = cleaned.trim();
  const lower = trimmed.toLowerCase();

  // 1. Length check: Must be at least 4 characters
  if (trimmed.length < 4) {
    return { isValid: false, reason: 'Input is too short. Please describe the emergency detail.' };
  }

  // 2. Gibberish / repeated character patterns check (e.g., "aaaaa", "asdfghjkl", "123456", "qwerty")
  if (
    /^(.)\1{3,}/i.test(trimmed) ||
    /^(asdf|qwerty|zxcv|1234|5678|abcd|qwer|test|testing|hello|hi|lala|blah|sample|random)/i.test(lower) ||
    /^[b-df-hj-np-tv-z]{5,}$/i.test(lower)
  ) {
    return { isValid: false, reason: 'Random text or gibberish detected. Please specify real incident details.' };
  }

  // 3. Hallucination / Filler phrases check
  const invalidPhrases = [
    'thank you for watching',
    'thanks for watching',
    'subtitles by',
    'translated by',
    'like and subscribe',
    'testing 1 2 3',
    'hello world',
    'random text',
    'sample text',
    'foo bar',
    'lorem ipsum',
  ];

  for (const phrase of invalidPhrases) {
    if (lower.includes(phrase)) {
      return { isValid: false, reason: 'Non-emergency filler phrase detected. Please speak real emergency details.' };
    }
  }

  // 4. Emergency detail content keywords check
  const emergencyKeywords = [
    // Locations / Addresses
    'street', 'st', 'st.', 'road', 'rd', 'avenue', 'ave', 'corner', 'store', 'brgy', 'barangay', 'purok', 'hall',
    'near', 'building', 'house', 'floor', 'pinpoint', 'location', 'address', 'city', 'plaza', 'zone', 'highway',
    // Incident Types / Situations
    'fire', 'sunog', 'flood', 'baha', 'robbery', 'holdap', 'police', 'baril', 'medical', 'sakit', 'hospital',
    'injured', 'hurt', 'bleeding', 'trapped', 'safe', 'uninjured', 'bystander', 'victim', 'people', 'person',
    'child', 'elderly', 'family', 'man', 'woman', 'suspect', 'armed', 'gun', 'knife', 'weapon', 'smoke',
    'accident', 'crash', 'help', 'rescue', 'emergency', 'patient', 'casualties', 'dead', 'alive', 'hiding',
    'quiet', 'first', 'second', 'ground', 'roof', 'water', 'level', 'chest', 'breathing', 'unconscious',
  ];

  const words = lower.split(/\s+/).map((w) => w.replace(/[^a-z0-9]/g, ''));
  const hasEmergencyKeyword = words.some((w) => emergencyKeywords.includes(w) || emergencyKeywords.some((k) => w.startsWith(k)));

  // If word count >= 3 or contains an explicit emergency keyword, accept it
  if (hasEmergencyKeyword || words.length >= 3) {
    return { isValid: true };
  }

  return {
    isValid: false,
    reason: 'Input does not contain clear incident details (e.g., location, injuries, situation).',
  };
}

export function sanitizeTranscript(text: string): string {
  if (!text || typeof text !== 'string') return '';

  let cleaned = text;

  // 1. Remove UI / TTS prompt echoes
  const ttsPatterns = [
    /how can i help\??/gi,
    /please speak your emergency details\.?/gi,
    /what we know/gi,
    /all details confirmed\.?/gi,
    /routing to nearest emergency department\.?/gi,
    /missing emergency details detected:?/gi,
  ];

  for (const pattern of ttsPatterns) {
    cleaned = cleaned.replace(pattern, ' ');
  }

  // 2. Remove famous STT / Whisper hallucination phrases & silence disclaimers
  const hallucinationPatterns = [
    /(?:share\s+this\s+video\s+with\s+your\s+friends[^\.\!\n]*[\.\!\n]?)/gi,
    /(?:social\s+media[^\.\!\n]*[\.\!\n]?)/gi,
    /(?:they\s+are\s+all\s+profesional[^\.\!\n]*[\.\!\n]?)/gi,
    /(?:students'\s+expertise[^\.\!\n]*[\.\!\n]?)/gi,
    /(?:interview\s+each\s+other[^\.\!\n]*[\.\!\n]?)/gi,
    /(?:google\.com\s+or\s+at[^\.\!\n]*[\.\!\n]?)/gi,
    /(?:please\s+see\s+the\s+complete\s+disclaimer[^\.\!\n]*[\.\!\n]?)/gi,
    /(?:https?:\/\/[^\s]+)/gi,
    /(?:www\.[^\s]+)/gi,
    /(?:for\s+more\s+information,?\s+visit[^\.\!\n]*[\.\!\n]?)/gi,
    /(?:fema\.gov[^\.\!\n]*)/gi,
    /(?:preview\s+of\s+current\s+discussion[^\.\!\n]*[\.\!\n]?)/gi,
    /(?:emergency\s+response\s+speech\s+input[^\.\!\n]*[\.\!\n]?)/gi,
    /(?:northeast\s+asian\s+fisher[^\.\!\n]*[\.\!\n]?)/gi,
    /(?:[\u0E00-\u0E7F]+)/g, // Remove Thai script hallucinations
    /(?:[\u0400-\u04FF]+)/g, // Remove Cyrillic script hallucinations (e.g., Дякуємо за перегляд)
    /(?:[\u4E00-\u9FFF\u3040-\u30FF\uAC00-\uD7AF]+)/g, // Remove CJK / Hangul hallucinations
    /(?:[\u0600-\u06FF]+)/g, // Remove Arabic script hallucinations
    /(?:tagalog\s+bisaya\s*)+/gi,
    /(?:silence\.?\s*)+/gi,
    /(?:thank\s+you\s+for\s+watching[\!\.\?]*\s*)+/gi,
    /(?:thanks\s+for\s+watching[\!\.\?]*\s*)+/gi,
    /(?:subtitles\s+(?:by|created\s+by)[^\.\!\n]+[\.\!\n]?)/gi,
    /(?:translated\s+by[^\.\!\n]+[\.\!\n]?)/gi,
    /(?:amara\.org\s*)+/gi,
    /(?:like\s+and\s+subscribe[\!\.\?]*\s*)+/gi,
    /(?:subscribe\s+to\s+the\s+channel[\!\.\?]*\s*)+/gi,
    /(?:watching[\!\.\?]*\s*)+/gi,
    /(?:thank\s+you[\!\.\?]*\s*){2,}/gi,
    /(?:дякуємо|перегляд|спасибо|просмотр)[\!\.\?]*\s*/gi,
  ];

  for (const pattern of hallucinationPatterns) {
    cleaned = cleaned.replace(pattern, ' ');
  }

  // 3. Remove consecutive duplicate sentences cleanly
  const sentences = cleaned.split(/(?<=[.!?])\s+/);
  const deduplicatedSentences: string[] = [];
  for (const s of sentences) {
    const trimmed = s.trim();
    if (!trimmed) continue;
    if (
      deduplicatedSentences.length === 0 ||
      deduplicatedSentences[deduplicatedSentences.length - 1].toLowerCase() !== trimmed.toLowerCase()
    ) {
      deduplicatedSentences.push(trimmed);
    }
  }
  cleaned = deduplicatedSentences.join(' ');

  // 4. Clean up whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  // 5. If remnant phrase is pure hallucination remnant or stray noise, clear it
  if (/^(thank you|thanks|bye|bye bye|subtitles|watching|yellow)[\.\!\?]*$/i.test(cleaned)) {
    return '';
  }

  // 6. If the remaining text contains no Latin letters or is just punctuation, clear it
  if (!/[a-zA-Z]/.test(cleaned)) {
    return '';
  }

  return cleaned;
}

let currentPlayingAudio: HTMLAudioElement | null = null;
let currentUtterance: any = null;

export const AIService = {
  /**
   * Immediately stops any ongoing AI speech playback (both HTML5 Audio and Web Speech Synthesis).
   */
  stopSpeech(): void {
    if (typeof window !== 'undefined') {
      try {
        if ('speechSynthesis' in window) {
          window.speechSynthesis.cancel();
        }
      } catch (e) {}
    }
    if (currentPlayingAudio) {
      try {
        currentPlayingAudio.pause();
        currentPlayingAudio.currentTime = 0;
      } catch (e) {}
      currentPlayingAudio = null;
    }
    currentUtterance = null;
  },

  /**
   * Checks whether the AI reader is currently actively speaking.
   */
  isSpeaking(): boolean {
    if (currentPlayingAudio && !currentPlayingAudio.paused) return true;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      return !!window.speechSynthesis.speaking;
    }
    return false;
  },

  /**
   * Speaks greeting or phrase using OpenAI TTS audio or Web Speech API matching selected dialect/language.
   */
  async speakGreeting(customText?: string, langOverride?: string): Promise<void> {
    if (typeof window === 'undefined') return;

    // Immediately stop any prior speech to prevent overlapping voices
    this.stopSpeech();

    // Disable AI speech synthesis if busy on an ongoing emergency call to prevent voice overlap
    try {
      if (typeof window !== 'undefined') {
        const storeModule = require('@/store/incidentStore');
        const activeInc = storeModule?.useIncidentStore?.getState?.()?.activeIncident;
        if (activeInc && activeInc.id && activeInc.status === 'LIVE') {
          console.log('🔇 AI speech muted: Busy on live human emergency call');
          return;
        }
      }
    } catch (e) {}

    let selectedLang = langOverride;
    if (!selectedLang && typeof window !== 'undefined') {
      try {
        selectedLang =
          localStorage.getItem('ugnay_selected_language') ||
          sessionStorage.getItem('ugnay_selected_language') ||
          'Cebuano / Bisaya';
      } catch (e) {}
    }
    if (!selectedLang) selectedLang = 'Cebuano / Bisaya';

    let textToSpeak = customText || '';
    let ttsLang = 'en-US';

    if (selectedLang.includes('Cebuano') || selectedLang.includes('Bisaya')) {
      ttsLang = 'ceb-PH';
      if (!textToSpeak || textToSpeak.includes('How can I help')) {
        textToSpeak = 'Unsay nahitabo? Unsaon nako pagtabang nimo? Palihug isulti ang imong emergency.';
      }
    } else if (selectedLang.includes('Tagalog') || selectedLang.includes('Filipino')) {
      ttsLang = 'tl-PH';
      if (!textToSpeak || textToSpeak.includes('How can I help')) {
        textToSpeak = 'Ano ang nangyari? Paano kita matutulungan? Pakiusap isaysay ang iyong emergency.';
      }
    } else if (selectedLang.includes('Auto')) {
      ttsLang = 'ceb-PH';
      if (!textToSpeak || textToSpeak.includes('How can I help')) {
        textToSpeak = 'Unsay nahitabo? How can I help you?';
      }
    } else {
      ttsLang = 'en-US';
      if (!textToSpeak || textToSpeak.includes('How can I help')) {
        textToSpeak = 'How can I help you? Please speak your emergency details.';
      }
    }

    try {
      // 1. Try OpenAI Audio TTS API if API key is available
      if (
        OPENAI_KEY &&
        OPENAI_KEY.startsWith('sk-') &&
        typeof URL !== 'undefined' &&
        typeof URL.createObjectURL === 'function' &&
        typeof Audio !== 'undefined'
      ) {
        const response = await fetch('https://api.openai.com/v1/audio/speech', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${OPENAI_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'tts-1',
            input: textToSpeak,
            voice: 'alloy',
            speed: 1.0,
          }),
        });

        if (response.ok) {
          const blob = await response.blob();
          const audioUrl = URL.createObjectURL(blob);
          const audio = new Audio(audioUrl);
          currentPlayingAudio = audio;
          audio.onended = () => {
            if (currentPlayingAudio === audio) currentPlayingAudio = null;
          };
          audio.onerror = () => {
            if (currentPlayingAudio === audio) currentPlayingAudio = null;
          };
          await audio.play();
          return;
        }
      }
    } catch (err) {
      // Silently fall through to Web Speech Synthesis
    }

    // 2. Web Speech Synthesis Fallback
    try {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel(); // Clear queued speech
        const utterance = new SpeechSynthesisUtterance(textToSpeak);
        currentUtterance = utterance;
        utterance.onend = () => {
          if (currentUtterance === utterance) currentUtterance = null;
        };
        utterance.onerror = () => {
          if (currentUtterance === utterance) currentUtterance = null;
        };
        utterance.rate = 0.95;
        utterance.pitch = 1.0;
        utterance.lang = ttsLang;
        window.speechSynthesis.speak(utterance);
      }
    } catch (e) {
      console.warn('Speech synthesis error:', e);
    }
  },

  /**
   * Fast emergency and responder matching utility.
   * Checks if user input matches an actual responder department (Fire, Flood, Medical, Police).
   */
  matchResponderCategory(speechText: string): {
    isMatch: boolean;
    incidentType: IncidentType | 'UNMATCHED';
    responderType: 'FIRE_DEPT' | 'EMS_AMBULANCE' | 'POLICE_DEPT' | 'FLOOD_DRRMO' | 'NONE';
    categoryLabel: string;
    tags: string[];
  } {
    const raw = sanitizeTranscript(speechText).toLowerCase().trim();
    if (!raw || raw.length < 3) {
      return {
        isMatch: false,
        incidentType: 'UNMATCHED',
        responderType: 'NONE',
        categoryLabel: 'Listening... State emergency details',
        tags: [],
      };
    }

    // Filter out common greetings, inquiries, or test phrases with no emergency content
    const nonEmergencyPhrases = [
      'hello', 'hi', 'testing', 'test 1 2 3', 'mic check', 'naririnig mo ba ako',
      'naririnig ako', 'sino to', 'sino ka', 'kumusta', 'kamusta', 'wala lang',
      'good morning', 'good evening', 'good afternoon', 'ano to', 'ano ba to',
      'sample', 'pwede magtanong', 'nandiyan ka ba', 'salamat', 'thank you'
    ];

    const words = raw.split(/\s+/);
    if (words.length <= 4 && nonEmergencyPhrases.some((phrase) => raw === phrase || raw.startsWith(phrase + ' '))) {
      return {
        isMatch: false,
        incidentType: 'UNMATCHED',
        responderType: 'NONE',
        categoryLabel: 'Listening... Please describe the emergency',
        tags: [],
      };
    }

    // 1. FIRE (BFP - Bureau of Fire Protection)
    const fireKeywords = [
      'sunog', 'fire', 'apoy', 'kalayo', 'nasusunog', 'nasunog', 'aso', 'smoke',
      'blaze', 'nagliliyab', 'lpg leak', 'sumabog', 'explosion', 'bumbero', 'bfp'
    ];
    if (fireKeywords.some((k) => raw.includes(k))) {
      return {
        isMatch: true,
        incidentType: 'FIRE',
        responderType: 'FIRE_DEPT',
        categoryLabel: 'Fire Emergency (BFP Dispatch)',
        tags: ['Structure Fire', 'BFP Fire Rescue', 'Smoke Hazard'],
      };
    }

    // 2. FLOOD / TYPHOON (MDRRMO Rescue)
    const floodKeywords = [
      'baha', 'flood', 'tubig', 'lubog', 'anod', 'sulog', 'nagbaha', 'lunop',
      'bagyo', 'typhoon', 'storm', 'landslide', 'rescue boat', 'rumaragasang tubig',
      'apaw ang sapa', 'mataas ang tubig', 'lumubog ang bahay'
    ];
    if (floodKeywords.some((k) => raw.includes(k))) {
      const isTyphoon = raw.includes('bagyo') || raw.includes('typhoon') || raw.includes('storm');
      return {
        isMatch: true,
        incidentType: isTyphoon ? 'TYPHOON' : 'FLOOD',
        responderType: 'FLOOD_DRRMO',
        categoryLabel: isTyphoon ? 'Typhoon Rescue (MDRRMO)' : 'Flood Rescue (MDRRMO Water Rescue)',
        tags: [isTyphoon ? 'Typhoon Evacuation' : 'Flood Hazard', 'MDRRMO Water Rescue', 'Flood Evacuation'],
      };
    }

    // 3. MEDICAL (EMS Ambulance)
    const medicalKeywords = [
      'medical', 'ambulansya', 'ambulance', 'ems', 'ospital', 'hospital', 'doktor', 'doctor',
      'atake', 'heart attack', 'stroke', 'dugo', 'bleeding', 'nagdugo', 'samad', 'sugat',
      'bali', 'nabali', 'fracture', 'kuyapan', 'nawalan ng malay', 'unconscious', 'hindi humihinga',
      'di kaginahawa', 'hirap huminga', 'nahilo', 'aksidente', 'accident', 'bangga', 'nabangga',
      'motorcycle crash', 'car crash', 'hit and run', 'nalason', 'poison', 'manganak', 'labor',
      'emergency room', 'malubha', 'injured', 'biktima', 'pinsala'
    ];
    if (medicalKeywords.some((k) => raw.includes(k))) {
      return {
        isMatch: true,
        incidentType: 'MEDICAL',
        responderType: 'EMS_AMBULANCE',
        categoryLabel: 'Medical Emergency (EMS Ambulance)',
        tags: ['Medical Response', 'EMS Paramedics', 'Patient Care'],
      };
    }

    // 4. SECURITY / POLICE (PNP)
    const securityKeywords = [
      'pulis', 'police', 'pnp', 'holdup', 'hold-up', 'snatcher', 'kawatan', 'magnanakaw',
      'thief', 'robbery', 'robber', 'baril', 'pusil', 'gun', 'shooting', 'sinaksak',
      'dunggab', 'stab', 'knife', 'kutsilyo', 'away', 'rambol', 'gulo', 'threat',
      'banta', 'hostage', 'kidnap', 'carnap', 'pananakit', 'bugbog', 'trespassing', 'intruder'
    ];
    if (securityKeywords.some((k) => raw.includes(k))) {
      return {
        isMatch: true,
        incidentType: 'SECURITY',
        responderType: 'POLICE_DEPT',
        categoryLabel: 'Security Emergency (PNP Police)',
        tags: ['Police Response', 'PNP Precinct', 'Law Enforcement'],
      };
    }

    // 5. IMMEDIATE DISTRESS / CRY FOR HELP (Tabang, Tulong, Saklolo, Rescue)
    const distressKeywords = [
      'tabang', 'tabangi', 'tabanga', 'tulong', 'tulungan', 'saklolo', 'help', 'rescue',
      'disgrasya', 'nadisgrasya', 'emergency', 'nasamdan', 'samdan'
    ];
    if (distressKeywords.some((k) => raw.includes(k))) {
      return {
        isMatch: true,
        incidentType: 'GENERAL',
        responderType: 'EMS_AMBULANCE',
        categoryLabel: 'Emergency Distress Call (DRRMO / Rescue)',
        tags: ['Immediate Distress', 'DRRMO Dispatch', 'Emergency Rescue'],
      };
    }

    return {
      isMatch: false,
      incidentType: 'UNMATCHED',
      responderType: 'NONE',
      categoryLabel: 'Listening... Please state your emergency',
      tags: [],
    };
  },

  /**
   * Fast emergency verification & panic assessment via OpenAI GPT-4o-mini.
   * Dispatches ONLY if it is an actual emergency and categorizes properly.
   * Uses OpenAI to detect real life-threatening panic and escalate routing priority.
   */
  async evaluateEmergencyAndPanic(speechText: string): Promise<{
    is_emergency: boolean;
    category: IncidentType | 'UNMATCHED';
    categoryLabel: string;
    is_panic: boolean;
    urgency: Priority;
    summary: string;
  }> {
    const sanitized = sanitizeTranscript(speechText);
    if (!sanitized || sanitized.length < 3) {
      return {
        is_emergency: false,
        category: 'UNMATCHED',
        categoryLabel: '',
        is_panic: false,
        urgency: 'LOW',
        summary: '',
      };
    }

    const quickMatch = this.matchResponderCategory(sanitized);

    try {
      if (OPENAI_KEY && OPENAI_KEY.startsWith('sk-')) {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${OPENAI_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content:
                  'You are a 911 Philippine emergency triage evaluator. Respond ONLY in valid JSON. Determine if the caller speech describes a REAL life/safety emergency (fire, flood, medical, crime, trauma). Casual greetings, questions, or test phrases are NOT emergencies. Detect TRUE severe panic/distress vs calm reporting.',
              },
              {
                role: 'user',
                content: `Caller utterance: "${sanitized}"
Return JSON:
{
  "is_emergency": boolean,
  "category": "FIRE" | "FLOOD" | "MEDICAL" | "SECURITY" | "TYPHOON" | "GENERAL" | "NONE",
  "category_label": "e.g. Fire Emergency (BFP) / Medical Emergency (EMS)",
  "is_panic": boolean,
  "urgency": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "summary": "1 sentence brief"
}`,
              },
            ],
            temperature: 0.1,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const parsed = JSON.parse(data.choices[0]?.message?.content?.replace(/```json|```/g, '').trim() || '{}');
          if (parsed && typeof parsed.is_emergency === 'boolean') {
            return {
              is_emergency: parsed.is_emergency,
              category: parsed.category === 'NONE' ? 'UNMATCHED' : (parsed.category as IncidentType),
              categoryLabel: parsed.category_label || quickMatch.categoryLabel,
              is_panic: Boolean(parsed.is_panic),
              urgency: (parsed.urgency as Priority) || (parsed.is_panic ? 'CRITICAL' : 'HIGH'),
              summary: parsed.summary || sanitized,
            };
          }
        }
      }
    } catch (e) {
      console.warn('OpenAI evaluation fallback notice:', e);
    }

    // High reliability fallback: ONLY mark emergency if matched to legitimate emergency keywords
    return {
      is_emergency: quickMatch.isMatch,
      category: quickMatch.incidentType,
      categoryLabel: quickMatch.categoryLabel,
      is_panic: /(?:mamatay|mamamatay|saklolo|papatayin|dios ko|diyos ko|tulungan nyo kami)/i.test(sanitized),
      urgency: quickMatch.incidentType === 'MEDICAL' || quickMatch.incidentType === 'FIRE' ? 'HIGH' : 'MEDIUM',
      summary: sanitized,
    };
  },

  /**
   * Analyzes raw speech transcript using OpenAI GPT model for triaging emergency details & category tagging.
   */
  async analyzeSpeech(speechText: string): Promise<AIAnalysisResult> {
    const textSanitized = sanitizeTranscript(speechText);
    if (!textSanitized) {
      return this.getFallbackAnalysis(speechText);
    }

    try {
      if (OPENAI_KEY && OPENAI_KEY.startsWith('sk-')) {
        const prompt = `You are an AI emergency dispatch triage expert for UGNAY Emergency Response System in the Philippines.
Analyze the following emergency speech transcript (which may be in English, Tagalog, or Cebuano/Bisaya) and extract structured emergency incident details with strict responder category tagging.

SPEECH TRANSCRIPT: "${textSanitized}"

CRITICAL RESPONDER MATCHING & PROPER TAGGING RULES:
1. "is_emergency": Set to false if the user is just saying greetings ("hello", "hi", "test"), casual remarks, inaudible noise, or there is NO actual emergency being reported. Set to true ONLY if there is a real life, safety, medical, disaster, or crime emergency.
2. "matched_responder":
   - "FIRE_DEPT": Fire outbreak, smoke, gas leak, explosion, structural burning -> matches Bureau of Fire Protection (BFP).
   - "EMS_AMBULANCE": Medical crisis, vehicular accident injuries, bleeding, heart attack, stroke, poisoning, unconscious person, severe trauma -> matches Emergency Medical Services (EMS).
   - "POLICE_DEPT": Crime, theft, robbery, armed attack, physical assault, riot, shooting, stabbing, harassment, intruder -> matches Philippine National Police (PNP).
   - "FLOOD_DRRMO": Floods, typhoon devastation, storm surge, rising river waters, landslide, water rescue needed -> matches Disaster Risk Reduction & Management Office (MDRRMO).
   - "NONE": The speech DOES NOT match any responder department.
3. "incident_type": Must be "FIRE", "FLOOD", "MEDICAL", "TYPHOON", "SECURITY", "GENERAL", or "UNMATCHED" if matched_responder is "NONE".
4. "category_tags": 2 to 4 precise emergency classification tags (e.g., ["Residential Fire", "Smoke Inhalation Risk"], ["Vehicular Collision", "Severe Bleeding", "Pedestrian Victim"], ["Armed Robbery", "Active Intruder"]).
5. "missing_information": Only list missing info NOT already mentioned in the transcript.

Return ONLY a valid raw JSON object with NO markdown formatting matching this JSON structure:
{
  "is_emergency": true,
  "matched_responder": "FIRE_DEPT" | "EMS_AMBULANCE" | "POLICE_DEPT" | "FLOOD_DRRMO" | "NONE",
  "incident_type": "FIRE" | "FLOOD" | "MEDICAL" | "TYPHOON" | "SECURITY" | "GENERAL" | "UNMATCHED",
  "category_tags": ["Tag 1", "Tag 2"],
  "confidence": 0.95,
  "priority": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "person": "e.g., Bystanders, Child, Elderly, Family, Unspecified",
  "situation": "e.g., Armed robbery in progress, House Fire, Trapped in Flood, Heart Attack",
  "floor": "e.g., Ground floor, Second floor, Roof, null",
  "location": "e.g., Corner Store on 5th Street, Barangay Hall, null",
  "landmark": "e.g., Near Market, Near Chapel, null",
  "known_facts": ["Extracted facts from transcript"],
  "missing_information": [],
  "summary": "Concise 1-2 sentence emergency brief"
}`;

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${OPENAI_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.2,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const content = data.choices[0]?.message?.content || '';
          const cleanedJson = content.replace(/```json|```/g, '').trim();
          const parsed = JSON.parse(cleanedJson);

          const rawMissing = Array.isArray(parsed.missing_information) ? parsed.missing_information : [];
          const cleanedMissing = cleanMissingInformation(rawMissing, textSanitized);

          let cleanFacts: string[] = [];
          if (Array.isArray(parsed.known_facts)) {
            cleanFacts = parsed.known_facts
              .map((fact: string) => sanitizeTranscript(fact))
              .filter((fact: string) => fact.length > 0);
          }

          if (cleanFacts.length === 0) {
            cleanFacts = textSanitized ? [textSanitized] : ['Emergency reported via voice interface'];
          }

          let cleanSummary = sanitizeTranscript(parsed.summary || textSanitized);
          if (!cleanSummary) {
            cleanSummary = textSanitized || `Emergency reported requiring ${parsed.incident_type || 'GENERAL'} dispatch.`;
          }

          const rawTags = Array.isArray(parsed.category_tags) ? parsed.category_tags : [];
          const cleanTags = rawTags.map((t: string) => String(t).trim()).filter(Boolean);

          const isEmergency = typeof parsed.is_emergency === 'boolean' ? parsed.is_emergency : true;
          const incidentType = parsed.incident_type || 'GENERAL';
          const matchedResponder = parsed.matched_responder || 'NONE';

          return {
            incident_type: incidentType,
            is_emergency: isEmergency,
            matched_responder: matchedResponder,
            category_tags: cleanTags.length > 0 ? cleanTags : [incidentType + ' Emergency'],
            confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.9,
            priority: parsed.priority || 'MEDIUM',
            person: parsed.person || 'Unspecified',
            situation: parsed.situation || 'Emergency issue reported',
            floor: parsed.floor || undefined,
            location: parsed.location || undefined,
            landmark: parsed.landmark || undefined,
            known_facts: cleanFacts,
            missing_information: cleanedMissing,
            summary: cleanSummary,
          };
        }
      }
    } catch (err) {
      console.warn('OpenAI Speech Analysis Error, fallback triggered:', err);
    }

    return this.getFallbackAnalysis(speechText);
  },

  /**
   * Rule-based fallback parser with responder matching when offline or without key.
   */
  getFallbackAnalysis(speechText: string): AIAnalysisResult {
    const textSanitized = sanitizeTranscript(speechText);
    const match = this.matchResponderCategory(textSanitized);

    const incident_type: IncidentType | 'UNMATCHED' = match.incidentType;
    let priority: Priority = 'MEDIUM';
    let person = 'Unspecified';
    let situation = textSanitized ? textSanitized : 'Emergency reported via voice interface';

    if (incident_type === 'SECURITY' || incident_type === 'FIRE') {
      priority = 'HIGH';
    } else if (incident_type === 'MEDICAL') {
      priority = 'CRITICAL';
    }

    const missing_information: string[] = [];
    if (!match.isMatch) {
      missing_information.push('specific emergency details matching responder');
    }

    const summaryText = textSanitized && textSanitized.length > 15
      ? textSanitized
      : match.isMatch
      ? `Emergency reported requiring ${match.categoryLabel}.`
      : 'Caller voice did not match a specific responder department.';

    return {
      incident_type,
      is_emergency: match.isMatch,
      matched_responder: match.responderType,
      category_tags: match.tags,
      confidence: match.isMatch ? 0.85 : 0.2,
      priority,
      person,
      situation,
      known_facts: textSanitized ? [textSanitized] : ['Emergency reported via voice interface'],
      missing_information,
      summary: summaryText,
    };
  },

  /**
   * Generates emergency-specific calming guidance and immediate safety/first-aid steps
   * even when the caller panics. Supports Bisaya, Tagalog, and English.
   */
  getCalmingEmergencyGuidance(
    incidentType: IncidentType | string,
    userSpeechText?: string,
    langOverride?: string
  ): {
    reassurance: string;
    steps: string[];
    panicDetected: boolean;
    incidentType: IncidentType | string;
  } {
    const rawText = (userSpeechText || '').toLowerCase();
    const panicKeywords = [
      'tabang', 'tulong', 'help', 'patay', 'mamatay', 'kalisang', 'hadlok', 'takot',
      'dios ko', 'diyos ko', 'bilisan', 'hurry', 'dying', 'scared', 'natatakot', 'bleeding',
      'sunog', 'baha', 'trapped', 'apoy', 'smoke', 'breathe', 'hininga', 'dali', 'please'
    ];
    const panicDetected = panicKeywords.some((k) => rawText.includes(k)) || /[!]{2,}/.test(userSpeechText || '');

    let selectedLang = langOverride;
    if (!selectedLang && typeof window !== 'undefined') {
      try {
        selectedLang =
          localStorage.getItem('ugnay_selected_language') ||
          sessionStorage.getItem('ugnay_selected_language') ||
          'Cebuano / Bisaya';
      } catch (e) {}
    }
    if (!selectedLang) selectedLang = 'Cebuano / Bisaya';

    const isBisaya = selectedLang.includes('Cebuano') || selectedLang.includes('Bisaya');
    const isTagalog = selectedLang.includes('Tagalog') || selectedLang.includes('Filipino');

    if (isBisaya) {
      if (incidentType === 'FIRE') {
        return {
          panicDetected,
          incidentType,
          reassurance: panicDetected
            ? 'Dungog nako ka, kalma lang palihug ug ginhawa ug lawom. Padulong na ang bumbero sa inyong lokasyon. Ayaw kalisang, buhata dayon kini:'
            : 'Pabiling kalmado, padulong na ang BFP Fire Rescue. Sunda kining mga luwas nga lakang:',
          steps: [
            'Mukamang sa salog kay mas limpyo ug bugnaw ang hangin sa ubos kaysa aso.',
            'Taboni imong ilong ug baba gamit ang basa nga panapton o sanina.',
            'Ayaw hikapa ang pultahan kung init ang gunitanan; pangita og laing luwas nga gawasanan.',
            'Ayaw na og balik sa sulod bisan unsa pay mahabilin. Pabilin sa luwas nga gawas.',
          ],
        };
      }
      if (incidentType === 'FLOOD' || incidentType === 'TYPHOON') {
        return {
          panicDetected,
          incidentType,
          reassurance: panicDetected
            ? 'Kalma lang, ayaw kalisang, naka-alerto na ang rescue boats sa CDRRMO padulong nimo. Narito ang mga luwas nga buhaton:'
            : 'Naka-alerto na ang rescue team. Sunda kining mga dinalian nga panalipod sa baha:',
          steps: [
            'Pasaka dayon sa kinatas-ang luwas nga bahin sa balay o atop kon paspas ang tubig.',
            'I-off dayon ang main electrical breaker sa kuryente aron malikayan ang makuryentehan.',
            'Ayaw gyud og sulod o langoy sa kusog nga sulog sa tubig baha.',
            'Pangandam og pito, flashlight, o sanag nga panapton aron dali makit-an sa rescue team.',
          ],
        };
      }
      if (incidentType === 'MEDICAL') {
        return {
          panicDetected,
          incidentType,
          reassurance: panicDetected
            ? 'Ginhawa ug lawom, tabangan tika. Nagpadulong na ang ambulansya ug paramedics. Buhata kining paunang lunas:'
            : 'Nagpadulong na ang medical response team. Sunda kining first-aid nga lakang:',
          steps: [
            'Pabiling kalmado ug papahulaya ang pasyente sa komportable nga posisyon.',
            'Luagi ang mga huot nga sanina sa liog ug dughan aron sayon ang pagginhawa.',
            'Kon naay samad nga nagdugo, pugngi kini gamit ang limpyo nga panapton nga walay undang.',
            'Kon nakuyapan apan nagginhawa, ipaliraw siya patakilid aron dili maghuot ang tutunlan.',
          ],
        };
      }
      if (incidentType === 'SECURITY') {
        return {
          panicDetected,
          incidentType,
          reassurance: panicDetected
            ? 'Pabiling hilum ug kalma. Padulong na ang kapulisan sa inyong dapit. Panalipod dayon:'
            : 'Naka-dispatch na ang kapulisan. Sunda kining mga lakang alang sa imong kaluwasan:',
          steps: [
            'Panalipod sa tago nga kwarto ug i-lock o barikadahi ang pultahan.',
            'I-silent ang imong cellphone ug palonga ang tanang suga.',
            'Ayaw pagsaba o pakig-atubang sa kawatan o armado.',
            'Pabilin sa tagoanan hangtod makadungog ka sa mga awtoridad.',
          ],
        };
      }
      // General / Unmatched Emergency Guidance
      return {
        panicDetected,
        incidentType,
        reassurance: panicDetected
          ? 'Nia ko diri, imong UGNAY AI guide. Kalma lang palihug ug ginhawa og lawom. Naka-alerto na ang DRRMO Central Command. Isulti kanako unsay nahitabo samtang nagpaabot ta sa rescue unit:'
          : 'Nia ko diri, imong UGNAY AI guide. Samtang nagpaabot sa pinakaduol nga rescue unit, sunda kining mga dinalian nga panalipod:',
        steps: [
          'Isulti kanako unsay partikular nga nahitabo: dunay nasamdan, sunog, baha, o nagkinahanglan og kapulisan?',
          'Pabilin sa labing luwas nga lugar ug ayaw ibutang sa peligro ang imong kaugalingon.',
          'Ayaw putla kining tawag; padayon nga ginamonitor sa UGNAY AI ang imong GPS lokasyon.',
          'Kon dunay kuyog o biktima sa palibot, susiha kon nagginhawa pa ba sila ug pabilin nga kalmado.',
        ],
      };
    }

    if (isTagalog) {
      if (incidentType === 'FIRE') {
        return {
          panicDetected,
          incidentType,
          reassurance: panicDetected
            ? 'Naririnig kita, huminahon po at huminga nang malalim. Papunta na ang mga bumbero sa lokasyon mo. Sundin agad ito:'
            : 'Panatilihing kalmado ang sarili. Naka-dispatch na ang BFP Fire Rescue. Sundin ang mga ligtas na hakbang:',
          steps: [
            'Gumapang nang mababa sa sahig dahil mas malinis at malamig ang hangin sa ilalim.',
            'Takpan ang ilong at bibig gamit ang basang panyo o damit upang makaiwas sa usok.',
            'Huwag bubuksan ang pinto kung mainit ang seradura; humanap ng ibang ligtas na labasan.',
            'Huwag nang babalik sa loob para sa anumang gamit. Manatili sa labas.',
          ],
        };
      }
      if (incidentType === 'FLOOD' || incidentType === 'TYPHOON') {
        return {
          panicDetected,
          incidentType,
          reassurance: panicDetected
            ? 'Kalma lang po, huwag mag-panic. Naka-alerto na ang rescue boats papunta sa inyong pwesto. Narito ang dapat gawin:'
            : 'Naka-dispatch na ang rescue team. Sundin ang mga paunang hakbang sa baha:',
          steps: [
            'Umakyat agad sa pinakamataas na ligtas na bahagi ng bahay o bubong kung tumataas ang tubig.',
            'I-off agad ang main electrical circuit breaker upang maiwasan ang makuryente.',
            'Iwasang lumusong o magtangkang lumangoy sa rumaragasang agos ng tubig baha.',
            'Maghanda ng pito, flashlight, o maliwanag na tela bilang senyales sa rescue team.',
          ],
        };
      }
      if (incidentType === 'MEDICAL') {
        return {
          panicDetected,
          incidentType,
          reassurance: panicDetected
            ? 'Huminga nang malalim, kasama mo ako. Naka-dispatch na ang ambulansya at EMT paramedics. Gawin ang paunang lunas na ito:'
            : 'Papunta na ang medical response team. Narito ang mga paunang lunas:',
          steps: [
            'Panatilihing kalmado at nakapahinga ang pasyente sa komportableng posisyon.',
            'Luagan ang masisikip na damit sa leeg at dibdib upang makahinga nang maluwag.',
            'Kung may malubhang pagdurugo, diinan ito gamit ang malinis na tela nang tuloy-tuloy.',
            'Kung walang malay ngunit humihinga, ipihit siya patagilid (recovery position).',
          ],
        };
      }
      if (incidentType === 'SECURITY') {
        return {
          panicDetected,
          incidentType,
          reassurance: panicDetected
            ? 'Manatiling tahimik at kalmado. Naka-dispatch na ang kapulisan sa inyong lugar. Maging ligtas agad:'
            : 'Naka-dispatch na ang kapulisan. Sundin ang mga ligtas na hakbang:',
          steps: [
            'Pumasok sa tagong silid at i-lock o harangan ang pinto.',
            'I-silent ang cellphone at patayin ang mga ilaw upang hindi mapansin.',
            'Huwag mag-ingay o lumaban sa armado. Paparating na ang mga pulis.',
            'Manatili sa taguan hanggang sa matiyak na ligtas.',
          ],
        };
      }
      // General / Unmatched Emergency Guidance
      return {
        panicDetected,
        incidentType,
        reassurance: panicDetected
          ? 'Nandito ako, ang iyong UGNAY AI guide. Huminahon ka po at huminga nang malalim. Naka-alerto na ang City DRRMO Command Center. Sabihin mo sa akin ang sitwasyon habang naghihintay ng rescue unit:'
          : 'Nandito ako, ang iyong UGNAY AI guide. Habang naghihintay ng pinakamalapit na rescue unit, sundin ang mahahalagang gabay na ito:',
        steps: [
          'Sabihin sa akin kung anong partikular na emergency ang nangyayari: may nasaktan ba, sunog, baha, o kailangan ng pulis?',
          'Manatili sa pinakaligtas na pwesto at umiwas sa anumang posibleng kapahamakan.',
          'Panatilihing bukas ang linyang ito; aktibong binabantayan ng UGNAY AI ang iyong GPS lokasyon.',
          'Kung may kasamang nasugatan o nangangailangan ng saklolo, alamin kung humihinga at alerto sila.',
        ],
      };
    }

    // English Standard
    if (incidentType === 'FIRE') {
      return {
        panicDetected,
        incidentType,
        reassurance: panicDetected
          ? 'I hear you. Take a slow, deep breath and stay calm. Firefighters are dispatched to your location right now. Follow these steps:'
          : 'Fire rescue units are en route. Follow these immediate safety steps:',
        steps: [
          'Stay low and crawl under smoke where the air is cleaner and cooler.',
          'Cover your nose and mouth with a damp cloth or fabric.',
          'Feel doors before opening; if the handle is warm, do not open it.',
          'Once outside, stay out. Never re-enter a burning structure.',
        ],
      };
    }
    if (incidentType === 'FLOOD' || incidentType === 'TYPHOON') {
      return {
        panicDetected,
        incidentType,
        reassurance: panicDetected
          ? 'Stay calm, do not panic. Water rescue teams are alerted and heading to your sector. Here is what to do immediately:'
          : 'Emergency rescue boats are en route. Follow these flood safety steps:',
        steps: [
          'Move to the highest stable floor or roof if water levels continue rising.',
          'Turn off your main electrical breaker before water reaches outlets.',
          'Never attempt to walk or drive through rapidly moving flood currents.',
          'Keep a flashlight, whistle, or bright marker ready to signal responders.',
        ],
      };
    }
    if (incidentType === 'MEDICAL') {
      return {
        panicDetected,
        incidentType,
        reassurance: panicDetected
          ? 'Take a deep breath, I am here with you. An ambulance and EMT crew are dispatched. Follow these first-aid actions:'
          : 'Medical paramedics are dispatched. Follow these first-aid instructions:',
        steps: [
          'Keep the patient sitting or lying in a restful, comfortable position.',
          'Loosen any tight clothing around the neck and chest to facilitate airflow.',
          'If there is bleeding, apply direct, firm pressure with clean fabric.',
          'If unconscious but breathing normally, roll them onto their side into recovery position.',
        ],
      };
    }
    if (incidentType === 'SECURITY') {
      return {
        panicDetected,
        incidentType,
        reassurance: panicDetected
          ? 'Stay low and remain quiet. Law enforcement units are actively responding to your coordinates. Take shelter:'
          : 'Police units are responding. Take these immediate safety precautions:',
        steps: [
          'Barricade inside a secure room and lock all entrances.',
          'Silence your phone ringer and turn off indoor lights.',
          'Do not confront suspects or make unnecessary noise.',
          'Remain concealed until uniform officers identify themselves.',
        ],
      };
    }

    // General / Unmatched Emergency Guidance
    return {
      panicDetected,
      incidentType,
      reassurance: panicDetected
        ? 'I am here with you, your UGNAY AI guide. Take a slow, deep breath and stay calm. City DRRMO Command Center is alerted. Tell me what is happening while we route rescue units:'
        : 'I am here with you, your UGNAY AI guide. While waiting for the nearest rescue unit, follow these essential emergency safety steps:',
      steps: [
        'State your specific emergency aloud: is there an injury, fire, flood, or police situation?',
        'Move to the safest available position away from immediate hazards.',
        'Keep this emergency connection open; UGNAY AI is actively tracking your GPS coordinates.',
        'If anyone nearby is injured, check if they are responsive and breathing normally.',
      ],
    };
  },

  /**
   * Speaks calming first-aid & emergency guidance aloud to the caller at a slow, soothing pace.
   */
  async speakCalmingGuidance(
    incidentType: IncidentType | string,
    userSpeechText?: string,
    langOverride?: string
  ): Promise<void> {
    const guidance = this.getCalmingEmergencyGuidance(incidentType, userSpeechText, langOverride);
    let selectedLang = langOverride;
    if (!selectedLang && typeof window !== 'undefined') {
      try {
        selectedLang =
          localStorage.getItem('ugnay_selected_language') ||
          sessionStorage.getItem('ugnay_selected_language') ||
          'Cebuano / Bisaya';
      } catch (e) {}
    }
    const isBisaya = (selectedLang || '').includes('Cebuano') || (selectedLang || '').includes('Bisaya');
    const isTagalog = (selectedLang || '').includes('Tagalog') || (selectedLang || '').includes('Filipino');

    let spokenMessage = '';
    if (isBisaya) {
      spokenMessage = `${guidance.reassurance} Una: ${guidance.steps[0]} Ikaduha: ${guidance.steps[1]} Padulong na ang rescue unit.`;
    } else if (isTagalog) {
      spokenMessage = `${guidance.reassurance} Una: ${guidance.steps[0]} Pangalawa: ${guidance.steps[1]} Paparating na ang rescue unit.`;
    } else {
      spokenMessage = `${guidance.reassurance} First: ${guidance.steps[0]} Second: ${guidance.steps[1]} Help is coming.`;
    }

    return this.speakGreeting(spokenMessage, langOverride);
  },

  /**
   * Analyzes real-time emotional state and psychological behavior from caller's voice utterances.
   * Generates actionable behavioral instructions tailored to the caller's specific state of distress.
   */
  detectCallerEmotionAndBehavior(
    userSpeechText: string = '',
    langOverride?: string
  ): {
    emotion: 'PANICKED' | 'IN_PAIN' | 'ANXIOUS' | 'DISORIENTED' | 'CALM';
    emotionLabel: string;
    distressLevel: 'SEVERE' | 'HIGH' | 'MODERATE' | 'LOW';
    distressScore: number;
    color: string;
    badgeBg: string;
    detectedBehavior: string;
    summary: string;
    instructions: string[];
    soothingAudioPhrase: string;
  } {
    const raw = (userSpeechText || '').toLowerCase();

    let selectedLang = langOverride;
    if (!selectedLang && typeof window !== 'undefined') {
      try {
        selectedLang =
          localStorage.getItem('ugnay_selected_language') ||
          sessionStorage.getItem('ugnay_selected_language') ||
          'Cebuano / Bisaya';
      } catch (e) {}
    }
    const isBisaya = (selectedLang || '').includes('Cebuano') || (selectedLang || '').includes('Bisaya');
    const isTagalog = (selectedLang || '').includes('Tagalog') || (selectedLang || '').includes('Filipino');

    // 1. Acute Pain & Trauma
    const painKeywords = [
      'sakit', 'masakit', 'dugo', 'nagdugo', 'bleeding', 'aray', 'agay', 'ouch', 'bali',
      'broken', 'nasugatan', 'samad', 'tiyan', 'chest', 'dibdib', 'dughan', 'ulo', 'hurt', 'pain'
    ];
    if (painKeywords.some((k) => raw.includes(k))) {
      return {
        emotion: 'IN_PAIN',
        emotionLabel: 'ACUTE PAIN & PHYSICAL TRAUMA',
        distressLevel: 'SEVERE',
        distressScore: 94,
        color: '#EF4444',
        badgeBg: 'rgba(239, 68, 68, 0.15)',
        detectedBehavior: isBisaya
          ? 'Nakasulay og grabeng kasakit o samad sa lawas'
          : isTagalog
          ? 'Nakararanas ng matinding pananakit o pisikal na sugat'
          : 'Experiencing severe physical agony or traumatic injury',
        summary: isBisaya
          ? 'Ayaw lihoka ang masakit nga parte. Magpabiling pahuway samtang padulong ang ambulansya.'
          : isTagalog
          ? 'Huwag galawin ang masakit na bahagi. Manatiling nakapahinga habang papunta ang ambulansya.'
          : 'Do not move injured areas. Rest quietly while the paramedic ambulance is en route.',
        instructions: isBisaya
          ? [
              'Pabiling naghigda o naglingkod sa komportableng salog; ayaw pagsulay og barog.',
              'Kon nagdugo, pugngi kini gamit ang limpyo nga panapton nga walay pagtangtang.',
              'Ginhawa og hinay pinaagi sa baba aron maminusan ang kabug-at sa kasakit.',
              'Pahibaloa ang mga kauban nga ayaw ka i-alsa o tarugon hangtod moabot ang EMT.'
            ]
          : isTagalog
          ? [
              'Manatiling nakaupo o nakahiga; iwasang tumayo o gumalaw nang bigla.',
              'Kung may malakas na pagdurugo, diinan ito nang tuloy-tuloy gamit ang malinis na tela.',
              'Huminga nang dahan-dahan sa bibig upang maibsan ang tensyon ng pananakit.',
              'Huwag hayaang buhatin o igalaw ang bali o sugatang parte hanggang dumating ang medics.'
            ]
          : [
              'Remain sitting or lying down; avoid standing or sudden body movements.',
              'Apply direct, uninterrupted pressure with clean cloth over any bleeding site.',
              'Breathe slowly through your mouth to help calm physiological shock.',
              'Keep injured limbs fully supported and still until paramedics arrive.'
            ],
        soothingAudioPhrase: isBisaya
          ? 'Ayaw kahadlok, pabilin nga nagpahuway. Padulong na ang mga medics para atimanon ang imong kasakit.'
          : isTagalog
          ? 'Huminahon ka, hawakan ang sarili. Paparating na ang mga medics upang gamutin ang iyong nararamdaman.'
          : 'Stay resting and hold on. Paramediс units are on the way to treat your injury.',
      };
    }

    // 2. Severe Panic & Terror
    const panicKeywords = [
      'tulong', 'tabang', 'help', 'diyos ko', 'dios ko', 'mamatay', 'patay', 'kalisang',
      'hadlok', 'takot', 'natatakot', 'scared', 'dying', 'bilisan nyo', 'dali palihog', 'apoy', 'baha'
    ];
    if (panicKeywords.some((k) => raw.includes(k)) || /[!]{2,}/.test(userSpeechText)) {
      return {
        emotion: 'PANICKED',
        emotionLabel: 'PANICKED & IN SEVERE DISTRESS',
        distressLevel: 'SEVERE',
        distressScore: 88,
        color: '#F43F5E',
        badgeBg: 'rgba(244, 63, 94, 0.15)',
        detectedBehavior: isBisaya
          ? 'Kusog nga kakulba, paspas nga pagginhawa, ug kahadlok'
          : isTagalog
          ? 'Matinding takot, mabilis na paghinga, at matinding kaba'
          : 'Hyperventilating, acute adrenaline spike, and elevated fear',
        summary: isBisaya
          ? 'Ginhawa og lawom. Naka-alerto na ang rescue team. Sunda kining pamaagi aron makuha ang kalma:'
          : isTagalog
          ? 'Huminga nang malalim. Naka-dispatch na ang rescue team. Sundin ang mga hakbang na ito para kumalma:'
          : 'Take deep breaths. Rescue units are alerted. Follow these immediate grounding actions:',
        instructions: isBisaya
          ? [
              'Ipatong imong likod sa lig-on nga bongbong o lingkod sa salog aron dili makuyapan.',
              'Tan-awa ang palibot: isulti sa kusog ang 3 ka butang nga imong nakita karon.',
              'Sunda ang 4-4-4 box breathing sa ubos aron mabalik ang normal nga ginhawa.',
              'Ayaw pagdagan sa walay kaseguruhan nga direksyon; pabilin sa luwas nga pwesto.'
            ]
          : isTagalog
          ? [
              'Umupo sa sahig o isandal ang likod sa pader upang maiwasan ang pagkatumba o pagkahilo.',
              'Mag-grounding: sabihin nang malakas ang 3 bagay na nakikita mo sa iyong paligid.',
              'Sundin ang 4-4-4 box breathing counter sa ibaba upang humupa ang tibok ng puso.',
              'Huwag tumakbo nang walang direksyon; manatili sa kumpirmadong ligtas na pwesto.'
            ]
          : [
              'Sit down or lean against a solid wall to stabilize yourself and prevent fainting.',
              'Perform sensory grounding: verbally name 3 objects you can see right now.',
              'Follow the 4-4-4 box breathing exercise below to normalize your heart rate.',
              'Do not run blindly; stay in your secure perimeter until sirens are audible.'
            ],
        soothingAudioPhrase: isBisaya
          ? 'Dungog tika. Kalma lang palihug, ginhawa og lawom. Wala ka nag-inusara, padulong na ang rescue.'
          : isTagalog
          ? 'Naririnig kita. Huminahon ka, huminga nang malalim. Kasama mo ako, paparating na ang rescue.'
          : 'I hear you. Take a slow, deep breath. You are not alone; rescue units are on the way.',
      };
    }

    // 3. Disorientation & Confusion
    const disorientedKeywords = [
      'nahihilo', 'nalipong', 'dizzy', 'saan ako', 'di ko alam', 'asa ko', 'dilim',
      'lost', 'confused', 'malabo', 'blurry', 'walang makita'
    ];
    if (disorientedKeywords.some((k) => raw.includes(k))) {
      return {
        emotion: 'DISORIENTED',
        emotionLabel: 'DISORIENTED & SENSORY OVERLOAD',
        distressLevel: 'HIGH',
        distressScore: 78,
        color: '#A855F7',
        badgeBg: 'rgba(168, 85, 247, 0.15)',
        detectedBehavior: isBisaya
          ? 'Kasinatian sa kalipong o kalibog sa palibot'
          : isTagalog
          ? 'Pagkahilo, panlalabo, o pagkalito sa kinaroroonan'
          : 'Sensory confusion, potential concussive shock, or disorientation',
        summary: isBisaya
          ? 'Paundanga ang paglakaw. Pabilin nga naglingkod aron dili matumba.'
          : isTagalog
          ? 'Itigil ang paglalakad. Manatiling nakaupo upang hindi matumba.'
          : 'Halt moving. Sit securely on the floor to prevent stumbling or falling.',
        instructions: isBisaya
          ? [
              'Palingkod dayon sa salog ug hikapa ang salog aron mabalik imong balanse.',
              'Ipiyong imong mata sa 5 segundos samtang naggunit sa lig-on nga butang.',
              'Pangita og street sign, numero sa pultahan, o landmark nga maklaro nimo.',
              'Ayaw pagsulay og saka o lakaw sa ngitngit nga dapit.'
            ]
          : isTagalog
          ? [
              'Umupo agad sa sahig at hawakan ang lapag upang muling makuha ang iyong balanse.',
              'Pumikit nang 5 segundo habang nakahawak sa matibay na bagay.',
              'Basahin nang malakas ang anumang karatula o numero ng bahay na nakikita mo.',
              'Iwasang maglakad sa madilim o madulas na bahagi habang nahihilo.'
            ]
          : [
              'Sit down immediately and place both hands flat on the floor for balance.',
              'Pause with eyes closed for 5 seconds while holding firmly to a stable surface.',
              'Look for and speak aloud any visible street sign, house number, or landmark.',
              'Avoid traversing dark or unstable terrain while feeling dizzy.'
            ],
        soothingAudioPhrase: isBisaya
          ? 'Palingkod lang una. Hinay-hinaya imong pagginhawa, gi-trace namo imong GPS lokasyon.'
          : isTagalog
          ? 'Umupo muna nang dahan-dahan. Huminga nang malalim, sinusundan ng GPS ang iyong lokasyon.'
          : 'Sit down slowly. Take steady breaths; our GPS is actively tracking your position.',
      };
    }

    // 4. Anxious & Anticipatory Distress
    const anxiousKeywords = [
      'asan na', 'asa na', 'tagal', 'dugay', 'kelan', 'kanus-a', 'parating na ba',
      'natatakot', 'worried', 'waiting', 'anxious', 'kaba', 'nervous', 'urgent'
    ];
    if (anxiousKeywords.some((k) => raw.includes(k))) {
      return {
        emotion: 'ANXIOUS',
        emotionLabel: 'ANXIOUS & URGENTLY WORRIED',
        distressLevel: 'MODERATE',
        distressScore: 65,
        color: '#F59E0B',
        badgeBg: 'rgba(245, 158, 11, 0.15)',
        detectedBehavior: isBisaya
          ? 'Kaguol sa pagpaabot ug kabalaka sa sitwasyon'
          : isTagalog
          ? 'Matinding pag-aalala sa oras at pagdating ng tulong'
          : 'High situational anxiety and urgency for rescue confirmation',
        summary: isBisaya
          ? 'Aktibo ang rescue unit sa mapa sa ubos. Pabilin sa luwas nga dapit.'
          : isTagalog
          ? 'Aktibong bumibiyahe ang rescue unit sa mapa sa ibaba. Manatili sa ligtas na lugar.'
          : 'The rescue unit is actively mapped and en route below. Conserve your energy.',
        instructions: isBisaya
          ? [
              'Makita nimo sa live radar map ang biyahe sa emergency unit padulong nimo.',
              'Tipigi ang baterya sa imong telepono; ayaw pagsige og bukas og ubang apps.',
              'Pangandam og pito o suga nga magamit pagsenyas inigkadungog nimo sa wangwang.',
              'Paneguroa nga abli o dali ma-access ang pultahan para sa rescue personnel.'
            ]
          : isTagalog
          ? [
              'Makikita mo sa live radar map ang takbo ng emergency unit papunta sa iyo.',
              'Tipirin ang baterya ng telepono; manatili lang sa linyang ito ng UGNAY.',
              'Maghanda ng pito, flashlight, o telang pansenyas kapag narinig na ang sirena.',
              'Siguraduhing madaling buksan ang gate o pinto para sa paparating na responders.'
            ]
          : [
              'Check the live radar map below to verify your rescue unit approaching in real-time.',
              'Conserve device battery; remain focused on this dedicated emergency dispatch line.',
              'Prepare a whistle, flashlight, or brightly colored item to signal incoming crews.',
              'Ensure entryway gates or doors are unlocked and accessible for responders.'
            ],
        soothingAudioPhrase: isBisaya
          ? 'Padulong na gyud sila. Makita nimo sa live map ang ilang distansya. Kalma lang.'
          : isTagalog
          ? 'Paparating na talaga sila. Makikita mo sa live map ang kanilang distansya. Kumalma ka.'
          : 'They are actively traveling toward you. You can see their live ETA on the map.',
      };
    }

    // 5. Calm & Steady (Default Baseline)
    return {
      emotion: 'CALM',
      emotionLabel: 'CALM & SITUATIONALLY FOCUSED',
      distressLevel: 'LOW',
      distressScore: 20,
      color: '#10B981',
      badgeBg: 'rgba(16, 185, 129, 0.15)',
      detectedBehavior: isBisaya
        ? 'Kalmado ug alerto nga pag-obserbar sa sitwasyon'
        : isTagalog
        ? 'Kalmado at alertong nagmamasid sa kapaligiran'
        : 'Composed, situationally alert, and assessing environment',
      summary: isBisaya
        ? 'Maayo kaayo imong pagka-kalmado. Padayon nga bantayi ang imong palibot samtang nagpaabot.'
        : isTagalog
        ? 'Napakahusay ng iyong pagiging kalmado. Patuloy na bantayan ang paligid habang naghihintay.'
        : 'Excellent composure. Continue monitoring your surroundings while queuing for dispatch.',
      instructions: isBisaya
        ? [
              'Pabilin sa luwas nga posisyon layo sa kuryente, aso, o baha.',
              'Kon naay ubang biktima sa tupad, pahinumdomi sila nga magpabilin nga kalmado.',
              'Paminaw sa tingog sa sirena sa kadalanan.',
              'Padayon nga maghatag og tingog kon duna kay dugang namatikdan sa hitabo.'
            ]
        : isTagalog
        ? [
              'Manatili sa ligtas na pwesto malayo sa usok, baha, o bumabagsak na bagay.',
              'Kung may kasamang iba, panatilihin din silang kalmado at huwag maghiwa-hiwalay.',
              'Makinig sa tunog ng papalapit na sirena ng rescue unit.',
              'Magsalita lang muli gamit ang boses kung may karagdagang detalye o pagbabago.'
            ]
        : [
              'Maintain safe distance from fire, smoke, rising water, or structural hazards.',
              'If you are with others, encourage them to stay together and remain calm.',
              'Listen for the audible sirens of incoming response vehicles.',
              'Speak freely via the mic anytime to report new updates or changes on the scene.'
            ],
      soothingAudioPhrase: isBisaya
        ? 'Maayo kaayo. Nagpadayon ang pag-monitor sa pinakaduol nga unit para nimo.'
        : isTagalog
        ? 'Napakahusay. Patuloy na minomonitor ang pinakamalapit na rescue unit para sa iyo.'
        : 'Very good. We are actively monitoring the closest rescue unit for you.',
    };
  },

  /**
   * Generates scenario-based emergency panic de-escalation guidance.
   * Grounded strictly in the caller's specific disaster or medical scenario (fire, flood, trauma, intruder, trapped, etc.).
   */
  getScenarioPanicGuidance(
    scenario: {
      incidentType?: string;
      situation?: string;
      knownFacts?: string[];
      location?: string;
    },
    userSpeechText: string = '',
    langOverride?: string
  ): {
    isPanicking: boolean;
    scenarioCategory: 'FIRE' | 'FLOOD' | 'MEDICAL' | 'SECURITY' | 'TRAPPED' | 'GENERAL';
    scenarioLabel: string;
    calmingTitle: string;
    reassuranceText: string;
    steps: string[];
    soothingAudioPhrase: string;
  } {
    let selectedLang = langOverride;
    if (!selectedLang && typeof window !== 'undefined') {
      try {
        selectedLang =
          localStorage.getItem('ugnay_selected_language') ||
          sessionStorage.getItem('ugnay_selected_language') ||
          'Cebuano / Bisaya';
      } catch (e) {}
    }
    const isBisaya = (selectedLang || '').includes('Cebuano') || (selectedLang || '').includes('Bisaya');
    const isTagalog = (selectedLang || '').includes('Tagalog') || (selectedLang || '').includes('Filipino');

    const corpus = `${userSpeechText} ${scenario.situation || ''} ${(scenario.knownFacts || []).join(' ')} ${scenario.incidentType || ''}`.toLowerCase();

    const panicKeywords = [
      'panic', 'panicking', 'natatakot', 'takot', 'help', 'tulong', 'tabang',
      'dali', 'dalian', 'bilis', 'nahadlok', 'kuyawan', 'nerbyos', 'di ko alam',
      'wala ko kahibalo', 'screaming', 'nanginginig', 'hindi makahinga', 'di makahinga',
      'dili makaginhawa', 'naiiyak', 'mamamatay', 'mamatay', 'save us', 'please help',
      'emergency please', 'scared', 'terrified', 'crying', 'emergency'
    ];
    const isPanicking = panicKeywords.some((k) => corpus.includes(k));

    // Determine specific emergency scenario category
    let category: 'FIRE' | 'FLOOD' | 'MEDICAL' | 'SECURITY' | 'TRAPPED' | 'GENERAL' = 'GENERAL';

    if (
      scenario.incidentType === 'FIRE' ||
      corpus.includes('apoy') ||
      corpus.includes('sunog') ||
      corpus.includes('usok') ||
      corpus.includes('smoke') ||
      corpus.includes('flame')
    ) {
      category = 'FIRE';
    } else if (
      corpus.includes('naipit') ||
      corpus.includes('trapped') ||
      corpus.includes('guho') ||
      corpus.includes('debris') ||
      corpus.includes('collapsed') ||
      corpus.includes('lindol')
    ) {
      category = 'TRAPPED';
    } else if (
      scenario.incidentType === 'FLOOD' ||
      scenario.incidentType === 'TYPHOON' ||
      corpus.includes('baha') ||
      corpus.includes('tubig') ||
      corpus.includes('water') ||
      corpus.includes('lumulubog') ||
      corpus.includes('current')
    ) {
      category = 'FLOOD';
    } else if (
      scenario.incidentType === 'SECURITY' ||
      corpus.includes('pulis') ||
      corpus.includes('police') ||
      corpus.includes('baril') ||
      corpus.includes('kutsilyo') ||
      corpus.includes('intruder') ||
      corpus.includes('holdup') ||
      corpus.includes('threat')
    ) {
      category = 'SECURITY';
    } else if (
      scenario.incidentType === 'MEDICAL' ||
      corpus.includes('dugo') ||
      corpus.includes('bleeding') ||
      corpus.includes('sakit') ||
      corpus.includes('atake') ||
      corpus.includes('heart') ||
      corpus.includes('binti') ||
      corpus.includes('ulo') ||
      corpus.includes('walang malay') ||
      corpus.includes('injured')
    ) {
      category = 'MEDICAL';
    }

    if (category === 'FIRE') {
      return {
        isPanicking,
        scenarioCategory: 'FIRE',
        scenarioLabel: isBisaya ? 'SUNOG UG ASO (FIRE SCENARIO)' : isTagalog ? 'SUNOG AT USOK (FIRE SCENARIO)' : 'FIRE & SMOKE SCENARIO',
        calmingTitle: isBisaya ? 'DE-ESCALATION ALANG SA SUNOG' : isTagalog ? 'DE-ESCALATION PARA SA SUNOG' : 'FIRE SCENARIO DE-ESCALATION',
        reassuranceText: isBisaya
          ? 'Ayaw kalisang, paminawa ko. Naka-alerto na ang BFP Fire Rescue ug padulong na sa imong dapit. Sunda kini karon dayon aron maluwas:'
          : isTagalog
          ? 'Huminahon ka, pakinggan mo ako. Papunta na ang BFP Fire Rescue sa iyong lokasyon. Sundin agad ang mga ligtas na hakbang na ito:'
          : 'Stay low and stay calm. BFP Fire Rescue is en route to your sector right now. Follow these life-saving actions immediately:',
        steps: isBisaya
          ? [
              'Kamang sa ubos sa salog diin mas limpyo ang hangin ug layo sa makahilo nga aso.',
              'Tabuni ang imong ilong ug baba gamit ang basa nga panapton o sanina.',
              'Ayaw ablihi ang pultahan kon init ang trangka o may aso sa ilalom.',
              'Pumwesto duol sa bintana ug i-wagayway ang sanag nga panapton o flashlight aron makita sa bumbero.'
            ]
          : isTagalog
          ? [
              'Dumapa at gumapang nang mababa sa sahig dahil mas malinis ang hangin sa ilalim kaysa sa usok.',
              'Takpan ang ilong at bibig gamit ang basang damit o panyo upang hindi malanghap ang usok.',
              'Huwag buksan ang anumang pinto kung mainit ang seradura o may lumalabas na usok sa ilalim.',
              'Pumunta malapit sa bintana at magwagayway ng maliwanag na tela o flashlight para makita ka ng bumbero.'
            ]
          : [
              'Drop to the floor and crawl beneath the toxic smoke layer where air is cleaner.',
              'Cover your nose and mouth with a damp cloth or fabric.',
              'Feel door handles before turning; never open hot doors.',
              'Signal your position at an exterior window using a bright cloth or light.'
            ],
        soothingAudioPhrase: isBisaya
          ? 'Ayaw kalisang. Kamang sa salog aron makalikay sa aso. Papunta na ang mga bumbero.'
          : isTagalog
          ? 'Huminahon ka. Gumapang nang mababa sa sahig upang makaiwas sa usok. Paparating na ang mga bumbero.'
          : 'Stay low to the ground to breathe clean air. Firefighters are responding.',
      };
    }

    if (category === 'FLOOD') {
      return {
        isPanicking,
        scenarioCategory: 'FLOOD',
        scenarioLabel: isBisaya ? 'BAHA UG BAGYO (FLOOD SCENARIO)' : isTagalog ? 'BAHA AT PAGBAHA (FLOOD SCENARIO)' : 'FLOOD & WATER RESCUE',
        calmingTitle: isBisaya ? 'DE-ESCALATION ALANG SA BAHA' : isTagalog ? 'DE-ESCALATION PARA SA BAHA' : 'FLOOD RESCUE DE-ESCALATION',
        reassuranceText: isBisaya
          ? 'Kalma lang, ayaw kalisang. Padulong na ang rescue boats sa CDRRMO. Sunda kining mga dinalian nga panalipod:'
          : isTagalog
          ? 'Huminahon ka, huwag mag-panic. Naka-alerto ang rescue boats at patungo na sa iyong sector. Sundin agad ang mga hakbang na ito:'
          : 'Do not panic. Flood rescue boats are deployed and heading toward your coordinates. Take shelter immediately:',
        steps: isBisaya
          ? [
              'Pasaka dayon sa kinatas-ang luwas nga bahin sa balay o atop kon paspas ang pagsaka sa tubig.',
              'I-off dayon ang main electrical breaker sa kuryente aron malikayan ang makuryentehan.',
              'Ayaw gyud og sulod o langoy sa kusog nga sulog sa tubig baha.',
              'Pangandam og pito o suga aron dali makit-an ug madungog sa rescue team.'
            ]
          : isTagalog
          ? [
              'Umakyat agad sa pinakamataas at matibay na bahagi ng bahay o gusali.',
              'Patayin ang main electrical breaker bago pa abutin ng tubig ang mga saksakan.',
              'Huwag lumusong o tumawid sa mabilis na agos ng baha kahit mukhang mababaw.',
              'Maghanda ng pito o flashlight upang marinig at makita ka ng rescue boat.'
            ]
          : [
              'Move to the highest stable floor or roof structure away from rising water.',
              'Shut off the main electrical breaker immediately before water reaches outlets.',
              'Never attempt to wade or swim through swift-moving flood currents.',
              'Keep a whistle or flashlight ready to signal incoming water rescue crews.'
            ],
        soothingAudioPhrase: isBisaya
          ? 'Kalma lang. Pasaka sa kinatas-ang bahin sa balay ug patya ang kuryente. Padulong na ang rescue boat.'
          : isTagalog
          ? 'Kumalma ka. Umakyat sa mataas na lugar at patayin ang kuryente. Paparating na ang rescue boats.'
          : 'Move to the highest level and disconnect power. Rescue boats are en route.',
      };
    }

    if (category === 'TRAPPED') {
      return {
        isPanicking,
        scenarioCategory: 'TRAPPED',
        scenarioLabel: isBisaya ? 'NAIPIT SA GUHO (COLLAPSE/TRAPPED)' : isTagalog ? 'NAIPIT O TRAPPED (COLLAPSE SCENARIO)' : 'TRAPPED IN COLLAPSE SCENARIO',
        calmingTitle: isBisaya ? 'DE-ESCALATION ALANG SA NAIPIT' : isTagalog ? 'DE-ESCALATION PARA SA NAIPIT' : 'TRAPPED RESCUE DE-ESCALATION',
        reassuranceText: isBisaya
          ? 'Maluwas ka, paminawa ko. Naka-deploy na ang search and rescue team. Tipigi ang imong hangin ug kusog:'
          : isTagalog
          ? 'Ligtas kang makakalabas, pakinggan mo ako. Naka-deploy na ang search and rescue team. Tipirin ang hangin at lakas:'
          : 'You will be rescued; listen carefully. Search and rescue personnel are actively scanning. Conserve air and energy:',
        steps: isBisaya
          ? [
              'Tabuni ang baba ug ilong gamit ang panapton aron dili malanghap ang abog.',
              'Ayaw pagsige og syagit aron dili mahurot ang hangin; panuktok sa tubo o bungbong matag 10 segundos.',
              'Panalipdi ang imong ulo ug likod ilalom sa lig-ong balangkas.',
              'Pabiling kalmado aron magpabiling regular ang pagginhawa.'
            ]
          : isTagalog
          ? [
              'Takpan ang ilong at bibig gamit ang damit upang hindi malanghap ang alikabok.',
              'Huwag sumigaw nang tuloy-tuloy para makatipid sa hangin; kumatok sa tubo o pader tuwing 10 segundo.',
              'Protektahan ang ulo at likod sa ilalim ng matibay na bahagi.',
              'Panatilihing mabagal ang paghinga upang hindi maubusan ng oxygen.'
            ]
          : [
              'Cover your face with clothing to filter out dust and particles.',
              'Do not shout continuously to conserve oxygen; tap on pipes or walls every 10 seconds.',
              'Protect your head and vital organs under stable debris structures.',
              'Breathe slowly through your nose to maintain steady oxygenation.'
            ],
        soothingAudioPhrase: isBisaya
          ? 'Tipigi ang hangin. Panuktok sa tubo o bungbong aron madungog sa rescue team.'
          : isTagalog
          ? 'Tipirin ang hangin. Kumatok sa pader o tubo tuwing ilang segundo. Papunta na ang rescue.'
          : 'Conserve oxygen and tap periodically on walls. Rescue teams are scanning.',
      };
    }

    if (category === 'SECURITY') {
      return {
        isPanicking,
        scenarioCategory: 'SECURITY',
        scenarioLabel: isBisaya ? 'BANTA SA SEGURIDAD (SECURITY SCENARIO)' : isTagalog ? 'BANTA SA SEGURIDAD (SECURITY SCENARIO)' : 'SECURITY & POLICE SCENARIO',
        calmingTitle: isBisaya ? 'DE-ESCALATION ALANG SA SEGURIDAD' : isTagalog ? 'DE-ESCALATION PARA SA SEGURIDAD' : 'SECURITY THREAT DE-ESCALATION',
        reassuranceText: isBisaya
          ? 'Pabiling hilom ug kalma. Padulong na ang kapulisan sa inyong dapit. Panalipod dayon:'
          : isTagalog
          ? 'Manatiling tahimik at huminga nang dahan-dahan. Naka-dispatch na ang kapulisan sa inyong lokasyon. Magtago agad:'
          : 'Stay quiet and keep calm. Armed police officers are dispatched to your location. Take protective shelter:',
        steps: isBisaya
          ? [
              'Panalipod sa kinasulurang kwarto ug i-lock o barikadahi ang pultahan.',
              'I-silent ang imong cellphone ug palonga ang tanang suga sa kwarto.',
              'Dupa sa salog luyo sa lig-ong butang ug ayaw paghimo og bisan unsang saba.',
              'Pabilin sa tagoanan hangtod makadungog ka sa mga opisyal nga pulis.'
            ]
          : isTagalog
          ? [
              'Pumasok sa pinakaloob na silid at i-lock o barikadahan ang pinto.',
              'I-silent ang iyong telepono at patayin ang lahat ng ilaw sa silid.',
              'Dumapa sa sahig sa likod ng matibay na kasangkapan at huwag gagawa ng anumang ingay.',
              'Manatili sa taguan hanggang sa marinig ang malinaw na pagpapakilala ng pulisya.'
            ]
          : [
              'Retreat into an interior lockable room and barricade the entrance.',
              'Silence your mobile phone ringer and turn off all interior lighting.',
              'Stay low to the floor behind heavy furniture; make zero noise.',
              'Remain concealed until uniformed officers clearly announce themselves.'
            ],
        soothingAudioPhrase: isBisaya
          ? 'Pabiling hilom. I-lock ang pultahan ug palonga ang suga. Padulong na ang kapulisan.'
          : isTagalog
          ? 'Manatiling tahimik. I-lock ang pinto at patayin ang ilaw. Paparating na ang mga pulis.'
          : 'Stay silent and locked inside. Police units are dispatched.',
      };
    }

    if (category === 'MEDICAL') {
      return {
        isPanicking,
        scenarioCategory: 'MEDICAL',
        scenarioLabel: isBisaya ? 'MEDIKAL UG KRITIKAL NGA SAMAD' : isTagalog ? 'MEDIKAL AT MALUBHANG SUGAT' : 'MEDICAL & TRAUMA SCENARIO',
        calmingTitle: isBisaya ? 'DE-ESCALATION ALANG SA MEDIKAL' : isTagalog ? 'DE-ESCALATION PARA SA MEDIKAL' : 'MEDICAL TRAUMA DE-ESCALATION',
        reassuranceText: isBisaya
          ? 'Ginhawa og lawom, tabangan tika. Nagpadulong na ang ambulansya ug paramedics. Buhata kining paunang lunas:'
          : isTagalog
          ? 'Huminga nang malalim, nandito ako kasama mo. Paparating na ang ambulansya at paramedic crew. Gawin ang first-aid na ito:'
          : 'Take a deep, slow breath. An ambulance and EMT paramedic unit are actively rushing to you. Perform this first-aid:',
        steps: isBisaya
          ? [
              'Kon may nagdugo, pugngi kini gamit ang limpyo nga panapton nga walay undang nga pagduso.',
              'Papahulaya ang pasyente sa komportable nga posisyon ug luagi ang mga huot nga sanina.',
              'Kon maglisod og ginhawa, patindoga og gamay ang likod ug isandal sa unlan.',
              'Ayaw hatagi og tubig o pagkaon samtang nagpaabot sa doktor.'
            ]
          : isTagalog
          ? [
              'Kung may nagdudugo, diinan ito nang tuloy-tuloy gamit ang malinis na tela nang hindi inaalis.',
              'Panatilihing komportable ang posisyon at luwagan ang anumang masikip na damit sa leeg at dibdib.',
              'Kung hirap huminga, panatilihing nakaupo nang bahagyang nakasandal.',
              'Huwag paiinumin o pakakainin habang naghihintay ng medic.'
            ]
          : [
              'Apply firm, continuous direct pressure to any bleeding wound with clean cloth.',
              'Keep the patient rested in a comfortable position; loosen tight neck and chest wear.',
              'If experiencing breathing difficulty, keep them sitting slightly upright.',
              'Do not give food or fluids while waiting for medical personnel.'
            ],
        soothingAudioPhrase: isBisaya
          ? 'Ginhawa og lawom. Diini ang samad ug pabilin nga maglingkod. Padulong na ang ambulansya.'
          : isTagalog
          ? 'Huminga nang malalim. Diinan ang nagdudugong sugat at manatiling nakaupo. Paparating na ang ambulansya.'
          : 'Take a slow deep breath. Keep firm pressure on the wound. The ambulance is coming.',
      };
    }

    // Default / General scenario
    return {
      isPanicking,
      scenarioCategory: 'GENERAL',
      scenarioLabel: isBisaya ? 'GENERAL EMERGENCY SCENARIO' : isTagalog ? 'PANGKALAHATANG EMERGENCY' : 'GENERAL EMERGENCY SCENARIO',
      calmingTitle: isBisaya ? 'PANIC GROUNDING & DE-ESCALATION' : isTagalog ? 'PANIC GROUNDING AT DE-ESCALATION' : 'PANIC GROUNDING & DE-ESCALATION',
      reassuranceText: isBisaya
        ? 'Nia ko uban nimo sa linya. Ginhawa og lawom: 1, 2, 3, 4. Ipagawas ang hangin. Naka-alerto na ang command center para nimo:'
        : isTagalog
        ? 'Nandito ako kasama mo sa linya. Huminga nang malalim: 1, 2, 3, 4. Ibuga ang hangin. Nakatutok ang command center sa iyo:'
        : 'I am right here with you on this line. Take a deep, slow breath: 1, 2, 3, 4. Exhale smoothly. Emergency command is routing help to you:',
      steps: isBisaya
        ? [
            'Isandal ang imong likod sa lig-ong bungbong ug lingkod sa salog aron dili makuyapan.',
            'Tan-aw sa palibot ug isulti kanako: duna bay kalayo, tubig, samad, o peligro duol nimo?',
            'Ayaw putla kining tawag; nagpadayon ang pagsubay sa imong GPS.',
            'Ginhawa subay sa 4-4-4 rhythm: 4 segundo sulod, 4 segundo gawas.'
          ]
        : isTagalog
        ? [
            'Isandal ang iyong likod sa matibay na pader at umupo sa sahig upang hindi matumba o mahilo.',
            'Tumingin sa paligid at sabihin sa akin: may apoy ba, tubig, sugat, o panganib malapit sa iyo?',
            'Huwag ibaba ang linyang ito; patuloy na sinusubaybayan ang iyong GPS lokasyon.',
            'Huminga nang dahan-dahan: 4 na segundo papasok, 4 na segundo palabas.'
          ]
        : [
            'Sit on the floor with your back against a sturdy wall to ground your balance.',
            'Look around and describe your environment: is there fire, water, injury, or threat?',
            'Keep this emergency connection open; our system is locking onto your coordinates.',
            'Focus on slow rhythmic breathing: 4 seconds in through your nose, 4 seconds out.'
          ],
      soothingAudioPhrase: isBisaya
        ? 'Ginhawa og lawom. Isandal ang likod sa pader ug paminaw sa akong tingog. Nia ko para nimo.'
        : isTagalog
        ? 'Huminga nang malalim. Umupo sa sahig at isandal ang likod sa pader. Nandito ako para sa iyo.'
        : 'Take a deep breath and lean against a wall. I am here with you.',
    };
  },

  /**
   * Empathetically interprets caller speech while queuing.
   * - Stops previous AI voice immediately when caller speaks (barge-in).
   * - If simple affirmation (e.g. "opo", "sige", "okay"): gently acknowledges without repeating explanations.
   * - If caller needs assistance / expresses pain, panic, or gives an update: responds with genuine human empathy and 1 practical instruction,
   *   and extracts facts for the responders.
   */
  async interpretCallerUtterance(
    speechText: string,
    incidentContext: {
      type?: string;
      departmentName?: string;
      location?: string;
      lastAiMessage?: string;
    } = {},
    langOverride?: string
  ): Promise<{
    isAffirmationOnly: boolean;
    needsAssistance: boolean;
    extractedUpdate?: string;
    spokenResponse: string;
  }> {
    const sanitized = sanitizeTranscript(speechText);
    if (!sanitized || sanitized.length < 2) {
      return {
        isAffirmationOnly: false,
        needsAssistance: false,
        spokenResponse: '',
      };
    }

    let selectedLang = langOverride;
    if (!selectedLang && typeof window !== 'undefined') {
      try {
        selectedLang =
          localStorage.getItem('ugnay_selected_language') ||
          sessionStorage.getItem('ugnay_selected_language') ||
          'Cebuano / Bisaya';
      } catch (e) {}
    }
    const isBisaya = (selectedLang || '').includes('Cebuano') || (selectedLang || '').includes('Bisaya');
    const isTagalog = (selectedLang || '').includes('Tagalog') || (selectedLang || '').includes('Filipino');
    const targetLanguage = isBisaya ? 'Cebuano / Bisaya' : isTagalog ? 'Tagalog / Filipino' : 'English';

    // Quick regex check for pure affirmations
    const rawLower = sanitized.toLowerCase().trim();
    const affirmationRegex = /^(opo|sige|sige po|oo|okay|ok|uu|nandito ako|nandito lang ako|salamat|thanks|yes|yes po|alright|copy|noted|sige sige|oo nga)[\.\!\?]*$/i;
    const isSimpleAffirmation = affirmationRegex.test(rawLower);

    if (isSimpleAffirmation) {
      const affirmationResponses = isBisaya
        ? [
            'Nia ra ko uban nimo. Padayon ang pag-monitor sa rescue.',
            'Sige, paminaw lang sa akong tingog. Nia ra ko.',
            'Kasabot ko. Pabilin lang sa luwas nga pwesto.',
          ]
        : isTagalog
        ? [
            'Nandito lang ako kasama mo. Patuloy ang pag-monitor sa rescue unit.',
            'Sige, makinig ka lang sa akin. Huwag kang mag-alala.',
            'Naiintindihan ko. Manatili ka lang sa ligtas na pwesto.',
          ]
        : [
            'I am right here with you. Responders are actively being routed.',
            'Stay steady. I am staying on the line with you.',
            'Understood. Remain safe where you are.',
          ];
      const chosen = affirmationResponses[Math.floor(Math.random() * affirmationResponses.length)];
      return {
        isAffirmationOnly: true,
        needsAssistance: false,
        spokenResponse: chosen,
      };
    }

    // Call OpenAI for deep human empathy & triage if available
    try {
      if (OPENAI_KEY && OPENAI_KEY.startsWith('sk-')) {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${OPENAI_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content: `You are an experienced, deeply empathetic 911 emergency voice dispatcher in the Philippines (UGNAY AI).
The caller is currently on hold waiting for emergency dispatch (${incidentContext.departmentName || 'Rescue Unit'} for ${incidentContext.type || 'Emergency'}).
The caller just spoke into the microphone while waiting.
Language MUST strictly be in: ${targetLanguage}.

Instructions:
1. is_affirmation_only: true if the caller is only agreeing, saying okay, acknowledging, or saying short passive phrases (e.g. "opo", "sige", "okay", "oo", "nandito lang ako").
2. needs_assistance: true if the caller is in pain, terrified, asking a question, reporting worsening danger, or giving incident updates.
3. extracted_update: if the caller mentions new relevant facts (e.g. "masakit ang paa ko", "may 2 bata kasama", "pumasok na ang tubig", "patay ang ilaw"), extract a concise English bullet note for the dispatchers. Otherwise return empty string.
4. spoken_response: 
   - If is_affirmation_only: A very brief (1 sentence), gentle, calming reassurance (e.g. "Nandito lang ako kasama mo...").
   - If needs_assistance: Respond with genuine, heartfelt human empathy and warmth, like a caring responder holding their hand. Acknowledge what they felt/said, give EXACTLY ONE simple practical grounding action, and reassure them that help is moving. Keep it strictly to 1-2 spoken sentences. Do NOT give long robotic checklists.

Respond ONLY in valid JSON:
{
  "is_affirmation_only": boolean,
  "needs_assistance": boolean,
  "extracted_update": string,
  "spoken_response": string
}`,
              },
              {
                role: 'user',
                content: `Caller utterance: "${sanitized}"
Context: Incident Type: ${incidentContext.type || 'EMERGENCY'}, Station: ${incidentContext.departmentName || 'Nearest Unit'}, Location: ${incidentContext.location || 'Reported Pin'}`,
              },
            ],
            temperature: 0.2,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const parsed = JSON.parse(
            data.choices[0]?.message?.content?.replace(/```json|```/g, '').trim() || '{}'
          );
          if (parsed && typeof parsed.spoken_response === 'string') {
            return {
              isAffirmationOnly: Boolean(parsed.is_affirmation_only),
              needsAssistance: Boolean(parsed.needs_assistance),
              extractedUpdate: parsed.extracted_update || undefined,
              spokenResponse: parsed.spoken_response,
            };
          }
        }
      }
    } catch (e) {
      console.warn('OpenAI caller utterance interpretation error:', e);
    }

    // High quality offline fallback
    const hasDistress = /(sakit|aray|agay|masakit|dugo|apoy|baha|patay|tulong|tabang|help|takot|hadlok|dali|nahihilo)/i.test(sanitized);
    let fallbackSpeech = '';
    if (isBisaya) {
      fallbackSpeech = hasDistress
        ? 'Dungog tika, ayaw kabalaka. Ginhawa og lawom ug pabilin sa luwas nga pwesto. Padulong na ang rescue unit.'
        : 'Nia ra ko sa linya uban nimo. Padayon ang pag-monitor sa pinakaduol nga estasyon.';
    } else if (isTagalog) {
      fallbackSpeech = hasDistress
        ? 'Naririnig kita, huwag kang matakot. Huminga nang dahan-dahan at manatili sa ligtas na pwesto. Paparating na ang rescue.'
        : 'Nandito lang ako kasama mo sa linya. Patuloy na minomonitor ang pinakamalapit na rescue unit.';
    } else {
      fallbackSpeech = hasDistress
        ? 'I hear you, please stay calm and take a deep breath. Focus on your safety while the rescue unit is en route.'
        : 'I am right here on the line with you. The emergency rescue unit is actively being routed.';
    }

    return {
      isAffirmationOnly: !hasDistress,
      needsAssistance: hasDistress,
      extractedUpdate: hasDistress ? sanitized : undefined,
      spokenResponse: fallbackSpeech,
    };
  },

  /**
   * Generates a realistic live emergency response dialogue from the Responder Unit.
   * Grounded in incident context, department type, and caller speech.
   */
  async generateResponderReply(
    callerSpeech: string,
    incidentContext: {
      type?: string;
      departmentName?: string;
      location?: string;
      responderName?: string;
    } = {},
    langOverride?: string
  ): Promise<string> {
    const sanitized = sanitizeTranscript(callerSpeech);
    let selectedLang = langOverride;
    if (!selectedLang && typeof window !== 'undefined') {
      try {
        selectedLang =
          localStorage.getItem('ugnay_selected_language') ||
          sessionStorage.getItem('ugnay_selected_language') ||
          'Cebuano / Bisaya';
      } catch (e) {}
    }
    const isBisaya = (selectedLang || '').includes('Cebuano') || (selectedLang || '').includes('Bisaya');
    const isTagalog = (selectedLang || '').includes('Tagalog') || (selectedLang || '').includes('Filipino');
    const targetLanguage = isBisaya ? 'Cebuano / Bisaya' : isTagalog ? 'Tagalog / Filipino' : 'English';

    try {
      if (OPENAI_KEY && OPENAI_KEY.startsWith('sk-')) {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${OPENAI_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content: `You are an official Philippine emergency responder (${incidentContext.departmentName || 'Emergency Response Unit'}) on a live two-way voice call with a citizen caller.
The citizen caller just spoke to you: "${sanitized}".
Respond as the responder in 1-2 realistic, concise, direct sentences in ${targetLanguage}.
Acknowledge the caller, give direct professional safety instructions or status of arrival, and sound authentic to Philippine 911 dispatch responders. Do NOT use bullet points or markdown.`,
              },
              {
                role: 'user',
                content: `Caller says: "${sanitized}"
Incident: ${incidentContext.type || 'Emergency'} at ${incidentContext.location || 'Reported Location'}.`,
              },
            ],
            temperature: 0.3,
            max_tokens: 100,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const reply = data.choices[0]?.message?.content?.trim();
          if (reply) return reply;
        }
      }
    } catch (e) {
      console.warn('Responder reply generation notice:', e);
    }

    // High quality offline fallback responses
    const lower = sanitized.toLowerCase();
    if (isBisaya) {
      if (lower.includes('dugo') || lower.includes('samad') || lower.includes('sakit')) {
        return 'Nadawat namo! Padulong na ang ambulansya. Diini og tarong ang samad gamit ang limpyo nga panapton samtang nagbiyahe among team.';
      }
      if (lower.includes('apoy') || lower.includes('sunog') || lower.includes('aso')) {
        return 'Naka-alerto na ang bumbero sa inyong sektor. Pabiling ubos sa aso ug paggawas dayon sa luwas nga dapit.';
      }
      if (lower.includes('asa na') || lower.includes('dugay') || lower.includes('kanus-a')) {
        return 'Nasa dalan na ang atong rescue unit duol sa inyong lokasyon. Pabilin lang sa luwas nga lugar.';
      }
      return 'Nadawat ang report. Padulong na ang atong mga responders sa inyong pwesto. Pabiling kalmado ug bantayi ang palibot.';
    } else if (isTagalog) {
      if (lower.includes('dugo') || lower.includes('sugat') || lower.includes('masakit') || lower.includes('sakit')) {
        return 'Copy that! Paparating na ang ating medics. Diinan ang sugat ng malinis na tela nang tuloy-tuloy at panatilihing nakapahinga ang pasyente.';
      }
      if (lower.includes('apoy') || lower.includes('sunog') || lower.includes('usok')) {
        return 'Naka-dispatch na ang BFP fire truck sa inyong lokasyon. Gumapang sa ilalim ng usok at lumabas agad sa ligtas na lugar.';
      }
      if (lower.includes('nasaan') || lower.includes('tagal') || lower.includes('kelan')) {
        return 'Nasa bisinidad na po ang ating rescue unit, mga 1 hanggang 2 minuto na lang. Manatili sa ligtas na pwesto.';
      }
      return 'Kumpirmado po ang inyong report. Paparating na ang ating responder team sa inyong lokasyon. Manatili sa ligtas na lugar.';
    } else {
      return 'Copy that! Emergency response units are actively en route to your coordinates. Please stay safe and keep this line open.';
    }
  },

  /**
   * Generates a realistic citizen caller response to a responder's question or instruction.
   */
  async generateCallerReply(
    responderSpeech: string,
    incidentContext: {
      type?: string;
      situation?: string;
      location?: string;
      callerName?: string;
    } = {},
    langOverride?: string
  ): Promise<string> {
    const sanitized = sanitizeTranscript(responderSpeech);
    let selectedLang = langOverride;
    if (!selectedLang && typeof window !== 'undefined') {
      try {
        selectedLang =
          localStorage.getItem('ugnay_selected_language') ||
          sessionStorage.getItem('ugnay_selected_language') ||
          'Cebuano / Bisaya';
      } catch (e) {}
    }
    const isBisaya = (selectedLang || '').includes('Cebuano') || (selectedLang || '').includes('Bisaya');
    const isTagalog = (selectedLang || '').includes('Tagalog') || (selectedLang || '').includes('Filipino');
    const targetLanguage = isBisaya ? 'Cebuano / Bisaya' : isTagalog ? 'Tagalog / Filipino' : 'English';

    try {
      if (OPENAI_KEY && OPENAI_KEY.startsWith('sk-')) {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${OPENAI_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content: `You are a citizen caller on a live emergency phone call with an emergency responder in the Philippines.
The responder just told you: "${sanitized}".
Respond realistically in 1 short sentence in ${targetLanguage} confirming their instruction or giving a brief update.`,
              },
              {
                role: 'user',
                content: `Responder says: "${sanitized}"
Emergency: ${incidentContext.type || 'Emergency'}.`,
              },
            ],
            temperature: 0.3,
            max_tokens: 60,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const reply = data.choices[0]?.message?.content?.trim();
          if (reply) return reply;
        }
      }
    } catch (e) {
      console.warn('Caller reply generation notice:', e);
    }

    if (isBisaya) {
      return 'Opo, salamat kaayo. Nia ra mi nagpaabot sa inyong pag-abot.';
    } else if (isTagalog) {
      return 'Opo officer, naiintindihan po namin. Nandito lang kami naghihintay.';
    } else {
      return 'Understood, thank you. We are staying in place waiting for you.';
    }
  },
};


