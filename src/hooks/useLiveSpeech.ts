import { useState, useEffect, useRef, useCallback } from 'react';
import { Platform } from 'react-native';
import { sanitizeTranscript } from '@/services/ai';
import { useIncidentStore } from '@/store/incidentStore';

const OPENAI_KEY = process.env.EXPO_PUBLIC_OPENAI_KEY || '';

export interface UseLiveSpeechReturn {
  isListening: boolean;
  transcript: string;
  interimTranscript: string;
  audioLevel: number;
  isMicSupported: boolean;
  hasPermission: boolean | null;
  error: string | null;
  language: string;
  setLanguage: (lang: string) => void;
  requestMicPermission: () => Promise<boolean>;
  startListening: () => void;
  stopListening: () => void;
  resetTranscript: () => void;
  transcribeWithOpenAIWhisper: (audioInput: any) => Promise<string>;
}

export function useLiveSpeech(
  onTranscriptUpdate?: (text: string) => void,
  onSpeechStart?: () => void
): UseLiveSpeechReturn {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [audioLevel, setAudioLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [language, setLanguageState] = useState<string>('fil-PH');

  const isListeningRef = useRef(false);
  const recognitionRef = useRef<any>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const nativeRecordingRef = useRef<any>(null);

  const isMicSupported = true;

  const onTranscriptUpdateRef = useRef(onTranscriptUpdate);
  useEffect(() => {
    onTranscriptUpdateRef.current = onTranscriptUpdate;
  }, [onTranscriptUpdate]);

  const onSpeechStartRef = useRef(onSpeechStart);
  useEffect(() => {
    onSpeechStartRef.current = onSpeechStart;
  }, [onSpeechStart]);

  const requestMicPermission = useCallback(async (): Promise<boolean> => {
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator?.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // Don't close immediately if audio analyser needs it, keep stream reference
        stream.getTracks().forEach((t) => t.stop());
        setHasPermission(true);
        setError(null);
        return true;
      } else {
        // Native mobile permission request (expo-av if installed)
        try {
          let Audio: any = null;
          try {
            Audio = require('expo-av').Audio;
          } catch (e) {}

          if (Audio?.requestPermissionsAsync) {
            const { status } = await Audio.requestPermissionsAsync();
            const granted = status === 'granted';
            setHasPermission(granted);
            if (!granted) {
              setError('Microphone permission required for Voice AI');
            } else {
              setError(null);
            }
            return granted;
          }
        } catch (nativeErr) {}
        setHasPermission(true);
        return true;
      }
    } catch (err: any) {
      console.warn('Microphone permission check:', err);
      setHasPermission(false);
      setError('Microphone access denied. Tap browser address bar to allow.');
      return false;
    }
  }, []);

  const stopAudioAnalysis = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      try {
        audioCtxRef.current.close();
      } catch (e) {}
      audioCtxRef.current = null;
    }
    setAudioLevel(0);
  };

  const startAudioAnalysis = async () => {
    if (Platform.OS !== 'web') return;
    if (typeof navigator === 'undefined' || !navigator?.mediaDevices?.getUserMedia) {
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const AudioCtx = typeof window !== 'undefined' ? (window.AudioContext || (window as any).webkitAudioContext) : null;
      if (!AudioCtx) return;

      const audioCtx = new AudioCtx();
      if (audioCtx.state === 'suspended') {
        try {
          await audioCtx.resume();
        } catch (e) {}
      }
      audioCtxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateLevel = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        const normalized = Math.min(100, Math.round((avg / 128) * 100));
        setAudioLevel(normalized);
        if (normalized > 20 && onSpeechStartRef.current) {
          onSpeechStartRef.current();
        }
        animFrameRef.current = requestAnimationFrame(updateLevel);
      };

      updateLevel();
    } catch (err: any) {
      console.warn('Audio analyser notice:', err);
    }
  };

  /**
   * OpenAI Whisper API fallback
   */
  const transcribeWithOpenAIWhisper = async (audioInput: any): Promise<string> => {
    if (!OPENAI_KEY || !audioInput) return '';

    try {
      const formData = new FormData();
      if (Platform.OS === 'web') {
        formData.append('file', audioInput, 'speech.webm');
      } else {
        formData.append('file', {
          uri: audioInput,
          name: 'speech.m4a',
          type: 'audio/m4a',
        } as any);
      }
      formData.append('model', 'whisper-1');

      const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${OPENAI_KEY}`,
        },
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        const text = sanitizeTranscript(data.text || '');
        if (text) {
          setTranscript((prev) => (prev ? `${prev} ${text}` : text));
          if (onTranscriptUpdateRef.current) {
            onTranscriptUpdateRef.current(text);
          }
          return text;
        }
      }
    } catch (e) {
      console.warn('Whisper API Transcription Error:', e);
    }
    return '';
  };

  const startListening = useCallback(async () => {
    setError(null);
    isListeningRef.current = true;
    setIsListening(true);

    const granted = await requestMicPermission();
    if (!granted) {
      isListeningRef.current = false;
      setIsListening(false);
      return;
    }

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      startAudioAnalysis();
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (SpeechRecognition) {
        try {
          if (recognitionRef.current) {
            try {
              recognitionRef.current.stop();
            } catch (e) {}
          }

          const recognition = new SpeechRecognition();
          recognition.continuous = true;
          recognition.interimResults = true;

          // Select BCP-47 language according to active store selection
          const storeLang = useIncidentStore.getState().selectedLanguage;
          let bcp47 = 'fil-PH';
          if (storeLang?.includes('English')) {
            bcp47 = 'en-US';
          } else if (storeLang?.includes('Tagalog') || storeLang?.includes('Filipino')) {
            bcp47 = 'fil-PH';
          } else if (storeLang?.includes('Cebuano') || storeLang?.includes('Bisaya')) {
            bcp47 = 'fil-PH';
          }
          recognition.lang = bcp47;

          recognition.onstart = () => {
            isListeningRef.current = true;
            setIsListening(true);
            setError(null);
          };

          recognition.onspeechstart = () => {
            if (onSpeechStartRef.current) {
              onSpeechStartRef.current();
            }
          };

          recognition.onresult = (event: any) => {
            let currentInterim = '';
            let currentFinal = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
              const text = event.results[i][0].transcript;
              if (event.results[i].isFinal) {
                currentFinal += text + ' ';
              } else {
                currentInterim += text;
              }
            }

            // Immediately propagate interim live speech so caller sees words in real-time
            if (currentInterim.trim()) {
              if (onSpeechStartRef.current) {
                onSpeechStartRef.current();
              }
              setInterimTranscript(currentInterim.trim());
              if (onTranscriptUpdateRef.current) {
                onTranscriptUpdateRef.current(currentInterim.trim());
              }
            }

            // Propagate finalized sentence
            if (currentFinal.trim()) {
              const cleaned = sanitizeTranscript(currentFinal) || currentFinal.trim();
              if (cleaned) {
                setTranscript((prev) => (prev ? `${prev} ${cleaned}` : cleaned));
                setInterimTranscript('');
                if (onTranscriptUpdateRef.current) {
                  onTranscriptUpdateRef.current(cleaned);
                }
              }
            }
          };

          recognition.onerror = (evt: any) => {
            console.warn('Speech recognition notice:', evt.error);
            if (evt.error === 'not-allowed') {
              setError('Microphone permission blocked. Please allow mic in browser settings.');
              isListeningRef.current = false;
              setIsListening(false);
            } else if (evt.error === 'network') {
              setError('Network error in speech service. Please check connection.');
            }
          };

          recognition.onend = () => {
            // Keep listening continuous if active
            if (isListeningRef.current) {
              try {
                recognition.start();
              } catch (e) {
                // Ignore if already active
              }
            } else {
              setIsListening(false);
            }
          };

          recognitionRef.current = recognition;
          recognition.start();
        } catch (e: any) {
          console.warn('SpeechRecognition start error:', e);
          setIsListening(true);
        }
      } else {
        setIsListening(true);
      }
    } else {
      // Native Mobile (Expo Go / Android / iOS) Audio Recording
      try {
        let Audio: any = null;
        try {
          Audio = require('expo-av').Audio;
        } catch (e) {
          Audio = null;
        }

        if (Audio) {
          await Audio.setAudioModeAsync({
            allowsRecordingIOS: true,
            playsInSilentModeIOS: true,
          });

          const recording = new Audio.Recording();
          await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);

          recording.setOnRecordingStatusUpdate((status: any) => {
            if (status.metering) {
              const db = status.metering;
              const level = Math.min(100, Math.max(0, Math.round(((db + 160) / 160) * 100)));
              setAudioLevel(level);
            }
          });

          await recording.startAsync();
          nativeRecordingRef.current = recording;
        }
        setIsListening(true);
      } catch (err) {
        console.warn('Native recording warning:', err);
        setIsListening(true);
      }
    }
  }, [requestMicPermission]);

  const stopListening = useCallback(async () => {
    isListeningRef.current = false;
    setIsListening(false);
    stopAudioAnalysis();

    if (Platform.OS === 'web') {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
        recognitionRef.current = null;
      }
    } else {
      if (nativeRecordingRef.current) {
        try {
          await nativeRecordingRef.current.stopAndUnloadAsync();
        } catch (e) {}
        nativeRecordingRef.current = null;
      }
    }
  }, []);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
  }, []);

  const setLanguage = useCallback((lang: string) => {
    setLanguageState(lang);
    if (recognitionRef.current) {
      recognitionRef.current.lang = lang;
    }
  }, []);

  useEffect(() => {
    return () => {
      isListeningRef.current = false;
      stopAudioAnalysis();
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
      }
    };
  }, []);

  return {
    isListening,
    transcript,
    interimTranscript,
    audioLevel,
    isMicSupported,
    hasPermission,
    error,
    language,
    setLanguage,
    requestMicPermission,
    startListening,
    stopListening,
    resetTranscript,
    transcribeWithOpenAIWhisper,
  };
}
