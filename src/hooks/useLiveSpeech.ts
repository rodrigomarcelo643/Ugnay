import { useState, useEffect, useRef, useCallback } from 'react';
import { Platform } from 'react-native';
import { sanitizeTranscript } from '@/services/ai';
import { useIncidentStore } from '@/store/incidentStore';

const OPENAI_KEY =
  process.env.EXPO_PUBLIC_OPENAI_KEY ||
  process.env.EXPO_PUBLIC_OPENAI_API_KEY ||
  process.env.OPENAI_API_KEY ||
  '';

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
  const mediaRecorderRef = useRef<any>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const isWhisperTranscribingRef = useRef<boolean>(false);
  const hasSpokenRecentlyRef = useRef<boolean>(false);
  const speechEnergyDetectedRef = useRef<boolean>(false);
  const silenceFlushTimerRef = useRef<any>(null);
  const nativeRecordingRef = useRef<any>(null);
  const restartTimeoutRef = useRef<any>(null);
  const isStartingRef = useRef<boolean>(false);

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
      if (Platform.OS === 'web' && typeof navigator !== 'undefined') {
        // If mediaStream is already active, permission is already verified
        if (mediaStreamRef.current && mediaStreamRef.current.active) {
          setHasPermission(true);
          setError(null);
          return true;
        }

        // Check Permissions API if available
        if (navigator.permissions && navigator.permissions.query) {
          try {
            const status = await navigator.permissions.query({ name: 'microphone' as PermissionName });
            if (status.state === 'granted') {
              setHasPermission(true);
              setError(null);
              return true;
            } else if (status.state === 'denied') {
              setHasPermission(false);
              setError('Microphone access denied. Tap browser address bar to allow.');
              return false;
            }
          } catch (pErr) {}
        }

        // Query getUserMedia without instantly killing track
        if (navigator.mediaDevices?.getUserMedia) {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          mediaStreamRef.current = stream;
          setHasPermission(true);
          setError(null);
          return true;
        }

        setHasPermission(true);
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
    if (silenceFlushTimerRef.current) {
      clearTimeout(silenceFlushTimerRef.current);
      silenceFlushTimerRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (mediaRecorderRef.current) {
      try {
        if (mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
        }
      } catch (e) {}
      mediaRecorderRef.current = null;
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
      let stream = mediaStreamRef.current;
      if (!stream || !stream.active) {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaStreamRef.current = stream;
      }

      const hasNativeSpeechRec =
        typeof window !== 'undefined' &&
        Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

      // Background MediaRecorder for Whisper AI transcription ONLY when native SpeechRecognition is unavailable
      if (!hasNativeSpeechRec && typeof window !== 'undefined' && (window as any).MediaRecorder) {
        try {
          const MediaRec = (window as any).MediaRecorder;
          let mime = '';
          if (MediaRec.isTypeSupported('audio/webm;codecs=opus')) {
            mime = 'audio/webm;codecs=opus';
          } else if (MediaRec.isTypeSupported('audio/webm')) {
            mime = 'audio/webm';
          } else if (MediaRec.isTypeSupported('audio/mp4')) {
            mime = 'audio/mp4';
          }

          const recorder = mime ? new MediaRec(stream, { mimeType: mime }) : new MediaRec(stream);
          mediaRecorderRef.current = recorder;
          recordedChunksRef.current = [];

          recorder.ondataavailable = (evt: any) => {
            if (evt.data && evt.data.size > 0) {
              recordedChunksRef.current.push(evt.data);
            }
          };

          recorder.onstop = async () => {
            const chunks = recordedChunksRef.current;
            recordedChunksRef.current = [];
            const hadVoice = speechEnergyDetectedRef.current;
            speechEnergyDetectedRef.current = false;

            // Only transcribe if actual voice energy (>20%) was observed to avoid silence hallucinations
            if (chunks.length > 0 && hadVoice && !isWhisperTranscribingRef.current) {
              const actualMime = recorder.mimeType || 'audio/webm';
              const audioBlob = new Blob(chunks, { type: actualMime });
              if (audioBlob.size > 14000) {
                isWhisperTranscribingRef.current = true;
                try {
                  await transcribeWithOpenAIWhisper(audioBlob);
                } finally {
                  isWhisperTranscribingRef.current = false;
                }
              }
            }
          };

          try {
            recorder.start(1000);
          } catch (rErr) {}
        } catch (mErr) {
          console.warn('[LiveSpeech] MediaRecorder setup notice:', mErr);
        }
      }

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

        // Require genuine voice energy (> 20%) to trigger speech detection
        if (normalized > 20) {
          speechEnergyDetectedRef.current = true;
          hasSpokenRecentlyRef.current = true;
          if (silenceFlushTimerRef.current) {
            clearTimeout(silenceFlushTimerRef.current);
            silenceFlushTimerRef.current = null;
          }
          if (onSpeechStartRef.current) {
            onSpeechStartRef.current();
          }
        } else if (hasSpokenRecentlyRef.current && normalized < 10) {
          // User paused speaking: flush recorded audio chunk to Whisper
          if (!silenceFlushTimerRef.current) {
            silenceFlushTimerRef.current = setTimeout(() => {
              hasSpokenRecentlyRef.current = false;
              if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
                try {
                  mediaRecorderRef.current.stop();
                  if (isListeningRef.current && mediaStreamRef.current?.active) {
                    setTimeout(() => {
                      if (isListeningRef.current && mediaRecorderRef.current) {
                        try {
                          mediaRecorderRef.current.start(1000);
                        } catch (e) {}
                      }
                    }, 200);
                  }
                } catch (e) {}
              }
            }, 1200);
          }
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
      formData.append(
        'prompt',
        'UGNAY 911 Emergency Philippines. Tabang, sunog, baha, disgrasya, aksidente, tulong, saklolo, pulis, ambulansya, ospital, pasyente, rescue. Dialects: Bisaya, Cebuano, Tagalog, English.'
      );
      formData.append('temperature', '0.0');

      const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${OPENAI_KEY}`,
        },
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        const rawText = data.text || '';
        if (/[\u0400-\u04FF\u4E00-\u9FFF\u0600-\u06FF]/.test(rawText) || /(?:дякуємо|перегляд|спасибо)/i.test(rawText)) {
          return '';
        }
        const text = sanitizeTranscript(rawText);
        if (text && text.trim().length > 2) {
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
    if (isStartingRef.current) return;
    isStartingRef.current = true;

    try {
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current);
        restartTimeoutRef.current = null;
      }

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
          // Cleanly unbind and abort previous recognition instance to prevent collision
          if (recognitionRef.current) {
            const prev = recognitionRef.current;
            recognitionRef.current = null;
            prev.onstart = null;
            prev.onspeechstart = null;
            prev.onresult = null;
            prev.onerror = null;
            prev.onend = null;
            try {
              prev.abort();
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
          } else {
            // fil-PH supports Philippine phonetics for Bisaya and Tagalog
            bcp47 = 'fil-PH';
          }
          recognition.lang = bcp47;
          try {
            recognition.maxAlternatives = 1;
          } catch (e) {}

          recognition.onstart = () => {
            if (recognitionRef.current !== recognition) return;
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
            if (recognitionRef.current !== recognition) return;
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

            // Propagate interim live speech to interim display only
            if (currentInterim.trim()) {
              const cleanInterim = sanitizeTranscript(currentInterim);
              if (cleanInterim) {
                if (onSpeechStartRef.current) {
                  onSpeechStartRef.current();
                }
                setInterimTranscript(cleanInterim);
              }
            }

            // Propagate finalized sentence
            if (currentFinal.trim()) {
              const cleaned = sanitizeTranscript(currentFinal);
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
            if (recognitionRef.current !== recognition) return;
            const errType = evt.error;

            if (errType === 'not-allowed' || errType === 'service-not-allowed') {
              setError('Microphone permission blocked. Please allow mic in browser settings.');
              isListeningRef.current = false;
              setIsListening(false);
            } else if (errType === 'network') {
              // Network error with selected locale: fall back to browser default locale
              try {
                recognition.lang = typeof navigator !== 'undefined' ? (navigator.language || 'en-US') : 'en-US';
              } catch (e) {}
            } else if (errType === 'no-speech' || errType === 'aborted') {
              // Expected silence or lifecycle abort — do not spam console or set error
            } else {
              console.warn('[LiveSpeech] Speech recognition notice:', errType);
            }
          };

          recognition.onend = () => {
            if (restartTimeoutRef.current) {
              clearTimeout(restartTimeoutRef.current);
              restartTimeoutRef.current = null;
            }

            // Keep listening continuous if active, with 400ms debounce to avoid rapid abort loops
            if (isListeningRef.current && recognitionRef.current === recognition) {
              restartTimeoutRef.current = setTimeout(() => {
                if (isListeningRef.current && recognitionRef.current === recognition) {
                  try {
                    recognition.start();
                  } catch (e) {
                    // Ignore already started or transitional state
                  }
                }
              }, 400);
            } else if (recognitionRef.current === recognition) {
              setIsListening(false);
            }
          };

          recognitionRef.current = recognition;
          try {
            recognition.start();
          } catch (e: any) {
            console.warn('SpeechRecognition start error:', e);
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
    } finally {
      isStartingRef.current = false;
    }
  }, [requestMicPermission]);

  const stopListening = useCallback(async () => {
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }
    isListeningRef.current = false;
    setIsListening(false);
    stopAudioAnalysis();

    if (Platform.OS === 'web') {
      if (recognitionRef.current) {
        const prev = recognitionRef.current;
        recognitionRef.current = null;
        prev.onstart = null;
        prev.onspeechstart = null;
        prev.onresult = null;
        prev.onerror = null;
        prev.onend = null;
        try {
          prev.abort();
        } catch (e) {}
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
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current);
        restartTimeoutRef.current = null;
      }
      isListeningRef.current = false;
      stopAudioAnalysis();
      if (recognitionRef.current) {
        const prev = recognitionRef.current;
        recognitionRef.current = null;
        prev.onstart = null;
        prev.onspeechstart = null;
        prev.onresult = null;
        prev.onerror = null;
        prev.onend = null;
        try {
          prev.abort();
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
