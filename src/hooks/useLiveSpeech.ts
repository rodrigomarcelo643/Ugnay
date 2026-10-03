import { sanitizeTranscript } from '@/services/ai';
import { useIncidentStore } from '@/store/incidentStore';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

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
  isOpenAIActive: boolean;
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
  const isWhisperTranscribingRef = useRef<boolean>(false);
  const hasSpokenRecentlyRef = useRef<boolean>(false);
  const silenceFlushTimerRef = useRef<any>(null);
  const nativeRecordingRef = useRef<any>(null);
  const restartTimeoutRef = useRef<any>(null);
  const isStartingRef = useRef<boolean>(false);
  const lastTranscriptRef = useRef<{ text: string; timestamp: number }>({ text: '', timestamp: 0 });

  const isMicSupported = true;
  const isOpenAIActive = Boolean(OPENAI_KEY && OPENAI_KEY.startsWith('sk-'));

  const onTranscriptUpdateRef = useRef(onTranscriptUpdate);
  useEffect(() => {
    onTranscriptUpdateRef.current = onTranscriptUpdate;
  }, [onTranscriptUpdate]);

  const onSpeechStartRef = useRef(onSpeechStart);
  useEffect(() => {
    onSpeechStartRef.current = onSpeechStart;
  }, [onSpeechStart]);

  /**
   * Unified transcript emitter with sanitization and duplicate suppression
   */
  const emitTranscript = useCallback((text: string) => {
    const cleaned = sanitizeTranscript(text);
    if (!cleaned || cleaned.length < 2) return;

    const now = Date.now();
    const last = lastTranscriptRef.current;
    const isDuplicate =
      last.text.toLowerCase() === cleaned.toLowerCase() &&
      now - last.timestamp < 1000;

    if (isDuplicate) return;

    lastTranscriptRef.current = { text: cleaned, timestamp: now };
    setTranscript((prev) => (prev ? `${prev} ${cleaned}` : cleaned));
    setInterimTranscript('');
    if (onTranscriptUpdateRef.current) {
      onTranscriptUpdateRef.current(cleaned);
    }
  }, []);

  /**
   * Transcribe recorded audio with OpenAI Whisper API
   */
  const transcribeWithOpenAIWhisper = useCallback(
    async (audioInput: any): Promise<string> => {
      if (!OPENAI_KEY || !audioInput) return '';

      try {
        const formData = new FormData();
        if (Platform.OS === 'web') {
          const blobType = (audioInput.type || '').toLowerCase();
          let filename = 'speech.webm';
          if (blobType.includes('mp4') || blobType.includes('aac')) {
            filename = 'speech.mp4';
          } else if (blobType.includes('m4a')) {
            filename = 'speech.m4a';
          } else if (blobType.includes('wav')) {
            filename = 'speech.wav';
          } else if (blobType.includes('ogg')) {
            filename = 'speech.ogg';
          }
          formData.append('file', audioInput, filename);
        } else {
          formData.append('file', {
            uri: audioInput,
            name: 'speech.m4a',
            type: 'audio/m4a',
          } as any);
        }

        formData.append('model', 'whisper-1');
        formData.append('temperature', '0.0');
        formData.append(
          'prompt',
          'Emergency call: mic check, hello, rescue, tulong, medical, police, fire, Tagalog, English.'
        );

        const storeLang = useIncidentStore.getState().selectedLanguage;
        if (storeLang?.includes('Tagalog') || storeLang?.includes('Filipino')) {
          formData.append('language', 'tl');
        }

        const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${OPENAI_KEY}`,
          },
          body: formData,
        });

        if (res.ok) {
          const data = await res.json();
          const rawText = (data.text || '').trim();
          console.log('[Whisper AI Transcription]:', rawText);

          // Discard silence & YouTube outro hallucination patterns
          const normalizedCheck = rawText.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
          if (
            /[\u0400-\u04FF\u4E00-\u9FFF\u0600-\u06FF]/.test(rawText) ||
            /(?:дякуємо|перегляд|спасибо|subtitles by|amara\.org|youtube)/i.test(rawText) ||
            /^(?:thank\s+you(?:\s+for\s+watching)?|thanks(?:\s+for\s+watching)?|thank\s+you\s+very\s+much|watching|bye|goodbye|see\s+you)$/i.test(normalizedCheck) ||
            /(?:thank\s+you\s+for\s+watching|thanks\s+for\s+watching|subscribe\s+to|like\s+and\s+subscribe)/i.test(rawText)
          ) {
            console.log('[Whisper AI] Ignored silence outro artifact:', rawText);
            return '';
          }

          // Strip any hallucinated trailing outro from real speech
          let filteredText = rawText.replace(/(?:,?\s*thank\s+you(?:\s+for\s+watching)?[\.\!\?]*)+$/gi, '').trim();
          if (!filteredText || filteredText.length < 2) {
            return '';
          }

          emitTranscript(filteredText);
          return filteredText;
        } else {
          const errData = await res.json().catch(() => ({}));
          console.warn('[Whisper API Response Notice]:', res.status, errData);
        }
      } catch (e) {
        console.warn('[Whisper Transcription Error]:', e);
      }
      return '';
    },
    [emitTranscript]
  );

  /**
   * Instantiates and starts a fresh MediaRecorder instance on stream
   */
  const createAndStartMediaRecorder = useCallback(
    (stream: MediaStream) => {
      if (typeof window === 'undefined' || !(window as any).MediaRecorder) return null;
      if (!stream || !stream.active) return null;

      try {
        const MediaRec = (window as any).MediaRecorder;
        let mime = '';
        if (MediaRec.isTypeSupported('audio/webm;codecs=opus')) {
          mime = 'audio/webm;codecs=opus';
        } else if (MediaRec.isTypeSupported('audio/webm')) {
          mime = 'audio/webm';
        } else if (MediaRec.isTypeSupported('audio/mp4')) {
          mime = 'audio/mp4';
        } else if (MediaRec.isTypeSupported('audio/aac')) {
          mime = 'audio/aac';
        }

        const options = mime ? { mimeType: mime } : undefined;
        const recorder = options ? new MediaRec(stream, options) : new MediaRec(stream);
        let localChunks: Blob[] = [];

        recorder.ondataavailable = (evt: any) => {
          if (evt.data && evt.data.size > 0) {
            localChunks.push(evt.data);
          }
        };

        recorder.onstop = async () => {
          const chunks = [...localChunks];
          localChunks = [];
          if (chunks.length > 0 && !isWhisperTranscribingRef.current) {
            const actualMime = recorder.mimeType || mime || 'audio/webm';
            const audioBlob = new Blob(chunks, { type: actualMime });

            // Only transcribe if speech was detected and blob contains meaningful audio (>2000 bytes)
            if (audioBlob.size > 2000) {
              isWhisperTranscribingRef.current = true;
              try {
                await transcribeWithOpenAIWhisper(audioBlob);
              } finally {
                isWhisperTranscribingRef.current = false;
              }
            }
          }
        };

        recorder.start(250);
        mediaRecorderRef.current = recorder;
        return recorder;
      } catch (err) {
        console.warn('[LiveSpeech] MediaRecorder creation notice:', err);
        return null;
      }
    },
    [transcribeWithOpenAIWhisper]
  );

  const requestMicPermission = useCallback(async (): Promise<boolean> => {
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined') {
        if (mediaStreamRef.current && mediaStreamRef.current.active) {
          setHasPermission(true);
          setError(null);
          return true;
        }

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

        if (navigator.mediaDevices?.getUserMedia) {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
          });
          mediaStreamRef.current = stream;
          setHasPermission(true);
          setError(null);
          return true;
        }

        setHasPermission(true);
        return true;
      } else {
        // Native mobile permission request
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
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        mediaStreamRef.current = stream;
      }

      const hasNativeSpeech =
        typeof window !== 'undefined' &&
        Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

      // Only start MediaRecorder Whisper batch polling if native browser streaming SpeechRecognition is absent
      if (!hasNativeSpeech) {
        createAndStartMediaRecorder(stream);
      }

      const AudioCtx =
        typeof window !== 'undefined'
          ? window.AudioContext || (window as any).webkitAudioContext
          : null;
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

        // Voice Activity Detection (VAD)
        if (normalized > 12) {
          hasSpokenRecentlyRef.current = true;
          if (silenceFlushTimerRef.current) {
            clearTimeout(silenceFlushTimerRef.current);
            silenceFlushTimerRef.current = null;
          }
          if (onSpeechStartRef.current) {
            onSpeechStartRef.current();
          }
        } else if (!hasNativeSpeech && hasSpokenRecentlyRef.current && normalized < 8) {
          // Caller paused speaking: wait 380ms then flush recording to Whisper (fallback mode)
          if (!silenceFlushTimerRef.current) {
            silenceFlushTimerRef.current = setTimeout(() => {
              hasSpokenRecentlyRef.current = false;
              silenceFlushTimerRef.current = null;

              if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
                try {
                  const currentRec = mediaRecorderRef.current;
                  mediaRecorderRef.current = null;
                  currentRec.stop(); // Triggers onstop -> transcribes with Whisper!
                } catch (e) {}
              }

              // Immediately start fresh MediaRecorder on the active stream for next speech
              if (isListeningRef.current && mediaStreamRef.current?.active) {
                createAndStartMediaRecorder(mediaStreamRef.current);
              }
            }, 380);
          }
        }

        animFrameRef.current = requestAnimationFrame(updateLevel);
      };

      updateLevel();
    } catch (err: any) {
      console.warn('Audio analyser notice:', err);
    }
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

          const storeLang = useIncidentStore.getState().selectedLanguage;
          let bcp47 = 'fil-PH';
          if (storeLang?.includes('English')) {
            bcp47 = 'en-US';
          } else {
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

            if (currentInterim.trim()) {
              if (onSpeechStartRef.current) {
                onSpeechStartRef.current();
              }
              setInterimTranscript(currentInterim.trim());
            }

            if (currentFinal.trim()) {
              emitTranscript(currentFinal);
            }
          };

          recognition.onerror = (evt: any) => {
            if (recognitionRef.current !== recognition) return;
            const errType = evt.error;

            if (errType === 'not-allowed' || errType === 'service-not-allowed') {
              console.warn(`[LiveSpeech] Browser SpeechRecognition restricted (${errType}). Seamlessly using OpenAI Whisper AI.`);
              try {
                recognition.abort();
              } catch (e) {}
              recognitionRef.current = null;

              if (mediaStreamRef.current && mediaStreamRef.current.active) {
                isListeningRef.current = true;
                setIsListening(true);
                setError(null);
                if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
                  createAndStartMediaRecorder(mediaStreamRef.current);
                }
              } else {
                setError('Microphone permission blocked. Please allow mic in browser settings.');
                isListeningRef.current = false;
                setIsListening(false);
              }
            } else if (errType === 'network') {
              try {
                recognition.lang =
                  typeof navigator !== 'undefined' ? navigator.language || 'en-US' : 'en-US';
              } catch (e) {}
            } else if (errType === 'no-speech' || errType === 'aborted') {
              // Expected silence or lifecycle events
            } else {
              console.warn('[LiveSpeech] Speech recognition notice:', errType);
            }
          };

          recognition.onend = () => {
            if (restartTimeoutRef.current) {
              clearTimeout(restartTimeoutRef.current);
              restartTimeoutRef.current = null;
            }

            if (isListeningRef.current && recognitionRef.current === recognition) {
              restartTimeoutRef.current = setTimeout(() => {
                if (isListeningRef.current && recognitionRef.current === recognition) {
                  try {
                    recognition.start();
                  } catch (e) {}
                }
              }, 400);
            } else if (recognitionRef.current === recognition) {
              if (!mediaStreamRef.current?.active) {
                setIsListening(false);
              }
            }
          };

          recognitionRef.current = recognition;
          try {
            recognition.start();
          } catch (e: any) {
            console.warn('SpeechRecognition start notice:', e);
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
  }, [requestMicPermission, createAndStartMediaRecorder, emitTranscript]);

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
          const recording = nativeRecordingRef.current;
          await recording.stopAndUnloadAsync();
          const uri = recording.getURI();
          if (uri) {
            transcribeWithOpenAIWhisper(uri);
          }
        } catch (e) {}
        nativeRecordingRef.current = null;
      }
    }
  }, [transcribeWithOpenAIWhisper]);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
    lastTranscriptRef.current = { text: '', timestamp: 0 };
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
    isOpenAIActive,
    setLanguage,
    requestMicPermission,
    startListening,
    stopListening,
    resetTranscript,
    transcribeWithOpenAIWhisper,
  };
}
