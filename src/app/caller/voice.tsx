import { AnimatedVoiceOrb } from '@/components/ui/AnimatedVoiceOrb';
import { ConnectionStatus } from '@/components/ui/ConnectionStatus';
import { TypewriterText } from '@/components/ui/TypewriterText';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/ui/logo';
import { useLiveSpeech } from '@/hooks/useLiveSpeech';
import { AIService, sanitizeTranscript } from '@/services/ai';
import { supabaseService } from '@/services/supabase';
import { useIncidentStore } from '@/store/incidentStore';
import { useRouter } from 'expo-router';
import {
  AlertTriangle,
  ArrowRight,
  HeartHandshake,
  Mic,
  PhoneCall,
  Radio,
  ShieldCheck,
  Sparkles,
  Volume2,
  XCircle,
  Zap,
} from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';

export default function CallerVoice() {
  const router = useRouter();
  const {
    activeIncident,
    resetIncident,
    speechTranscript,
    setSpeechTranscript,
    setIsListening,
    selectedLanguage,
    setSelectedLanguage,
  } = useIncidentStore();

  const isBusyOnCall = Boolean(activeIncident && activeIncident.id && activeIncident.status === 'LIVE');

  // AI Behavior Observation & Emotional Comfort State
  const [detectedMood, setDetectedMood] = useState<'CALM' | 'PANICKED' | 'LISTENING'>('LISTENING');
  const [understoodSituation, setUnderstoodSituation] = useState<string>('');
  const [autoDispatchCountdown, setAutoDispatchCountdown] = useState<number | null>(null);

  const silenceTimerRef = useRef<any>(null);
  const countdownIntervalRef = useRef<any>(null);
  const stopListeningRef = useRef<() => void>(() => { });
  const startListeningRef = useRef<() => void>(() => { });

  // Trigger hands-free auto-dispatch once user finishes speaking
  const triggerAutoDispatch = useCallback(
    async (finalSpeech: string) => {
      if (isBusyOnCall) return;
      stopListeningRef.current();
      setIsListening(false);

      const clean = sanitizeTranscript(finalSpeech) || 'Emergency reported via voice interface';
      setSpeechTranscript(clean);

      // Provide verbal emotional support and guidance as queuing starts
      const isBisaya = selectedLanguage.includes('Bisaya') || selectedLanguage.includes('Cebuano');
      const isTagalog = selectedLanguage.includes('Tagalog') || selectedLanguage.includes('Filipino');
      const queuingVoice = isBisaya
        ? 'Giproseso na ang emergency dispatch. Kalma lang palihug ug pabilin sa linya, tabang padulong na.'
        : isTagalog
        ? 'Pinoproseso na ang emergency dispatch. Huminahon po kayo at manatili sa linya, papunta na ang tulong.'
        : 'Emergency dispatch is in progress. Please stay calm and remain on the line, help is on the way.';

      AIService.speakGreeting(queuingVoice, selectedLanguage);
      router.push('/caller/analyzing');
    },
    [isBusyOnCall, router, setSpeechTranscript, setIsListening, selectedLanguage]
  );

  // Observe caller behavior and verify if voice input matches a real emergency
  const evaluateUserBehavior = useCallback(
    async (liveText: string) => {
      if (!liveText || liveText.trim().length < 3) return;

      // 1. Strict Emergency Verification & Categorization via OpenAI Evaluation
      const evaluation = await AIService.evaluateEmergencyAndPanic(liveText);

      // CRITICAL: DO NOT DISPATCH IF NOT AN EMERGENCY!
      if (!evaluation.is_emergency || evaluation.category === 'UNMATCHED') {
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
        setAutoDispatchCountdown(null);
        setUnderstoodSituation('');
        setDetectedMood('LISTENING');
        return;
      }

      // 2. REAL EMERGENCY IDENTIFIED & CATEGORIZED!
      setUnderstoodSituation(evaluation.categoryLabel);

      if (evaluation.is_panic) {
        setDetectedMood('PANICKED');
        const comfort =
          selectedLanguage.includes('Tagalog') || selectedLanguage.includes('Filipino')
            ? `Huminahon ka, kasama mo ako. Inihahanda ang responde ng ${evaluation.categoryLabel}.`
            : selectedLanguage.includes('Bisaya') || selectedLanguage.includes('Cebuano')
            ? `Kalma lang palihug, ayaw kalisang. Giproseso na ang responde sa ${evaluation.categoryLabel}.`
            : `Stay calm, take a deep breath. Coordinating ${evaluation.categoryLabel} rescue units for you now.`;
        AIService.speakGreeting(comfort, selectedLanguage);
      } else {
        setDetectedMood('CALM');
      }

      // Clear any prior timer before starting silence detection
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);

      // Start 3-second countdown to allow caller to finish speech, then auto-dispatch
      let secondsRemaining = 3;
      setAutoDispatchCountdown(secondsRemaining);

      countdownIntervalRef.current = setInterval(() => {
        secondsRemaining -= 1;
        if (secondsRemaining <= 0) {
          clearInterval(countdownIntervalRef.current!);
        } else {
          setAutoDispatchCountdown(secondsRemaining);
        }
      }, 1000);

      silenceTimerRef.current = setTimeout(() => {
        triggerAutoDispatch(liveText);
      }, 3000);
    },
    [selectedLanguage, triggerAutoDispatch]
  );

  const handleTranscriptUpdate = useCallback(
    (liveText: string) => {
      if (isBusyOnCall) return;
      const cleanText = sanitizeTranscript(liveText);
      if (cleanText) {
        setSpeechTranscript(cleanText);
        evaluateUserBehavior(cleanText);
      }
    },
    [setSpeechTranscript, evaluateUserBehavior, isBusyOnCall]
  );

  const handleSpeechStart = useCallback(() => {
    // When caller starts talking, immediately stop AI speech so they aren't talking over each other
    AIService.stopSpeech();
  }, []);

  const {
    isListening: isMicActive,
    transcript: micTranscript,
    interimTranscript,
    audioLevel,
    hasPermission,
    requestMicPermission,
    startListening,
    stopListening,
  } = useLiveSpeech(handleTranscriptUpdate, handleSpeechStart);

  stopListeningRef.current = stopListening;
  startListeningRef.current = startListening;

  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (isBusyOnCall) {
      stopListening();
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      return;
    }

    // Auto-start listening on mount when entering voice screen
    startListening();

    // Speak initial comforting AI guidance so user hears the AI guide immediately
    const isBisaya = selectedLanguage.includes('Bisaya') || selectedLanguage.includes('Cebuano');
    const isTagalog = selectedLanguage.includes('Tagalog') || selectedLanguage.includes('Filipino');
    const initialGreeting = isBisaya
      ? 'UGNAY Emergency AI. Paminaw ko nimo. Isulti palihug unsay nahitabo.'
      : isTagalog
      ? 'UGNAY Emergency AI. Nakikinig ako. Sabihin kung ano ang nangyari.'
      : 'UGNAY Emergency AI is listening. Please tell me what happened.';
    AIService.speakGreeting(initialGreeting, selectedLanguage);

    return () => {
      stopListening();
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, [isBusyOnCall]);

  // If redirected from home with an initial spoken transcript, evaluate behavior right away
  useEffect(() => {
    if (speechTranscript && speechTranscript.trim().length >= 3) {
      evaluateUserBehavior(speechTranscript.trim());
    }
  }, []);

  const handleActivateVoiceAI = async () => {
    if (isBusyOnCall) return;

    const currentSpoken = sanitizeTranscript(micTranscript) || sanitizeTranscript(speechTranscript);
    if (currentSpoken && currentSpoken.trim().length >= 3) {
      const match = AIService.matchResponderCategory(currentSpoken);
      if (match.isMatch) {
        triggerAutoDispatch(currentSpoken);
        return;
      }
    }

    startListening();
  };

  const handleCancelCallToReportAgain = async () => {
    if (activeIncident?.id) {
      await supabaseService.updateIncidentStatus(activeIncident.id, 'RESOLVED');
    }
    resetIncident();
    setSpeechTranscript('');
    router.replace('/caller/home');
  };

  const activeText = isBusyOnCall
    ? 'AI Voice engine disabled during active call...'
    : (interimTranscript
      ? `Hearing you: "${interimTranscript}"`
      : (sanitizeTranscript(micTranscript) || sanitizeTranscript(speechTranscript) || 'Listening... Speak naturally into your microphone'));

  return (
    <ScrollView contentContainerClassName="flex-grow items-center justify-between bg-[#09090B] px-4 sm:px-6 py-6 pb-28">
      <View className="w-full max-w-2xl flex-grow justify-between gap-4 sm:gap-5">
        {/* Top Header */}
        <View className="w-full flex-row items-center justify-between gap-2">
          <View className="flex-row items-center gap-2.5 flex-1 min-w-0">
            <Logo size={34} />
            <View className="flex-1 min-w-0">
              <Text className="text-[10px] font-bold text-sky-400 uppercase tracking-wider" numberOfLines={1}>
                UGNAY CONVERSATIONAL AI
              </Text>
              <Text className="text-base sm:text-lg font-black text-white" numberOfLines={1}>
                {isBusyOnCall ? 'Call Active • AI Standby' : 'Listening & Comforting...'}
              </Text>
            </View>
          </View>
          <View className="shrink-0">
            <ConnectionStatus status={isBusyOnCall ? 'LIVE' : 'LIVE'} />
          </View>
        </View>

        {/* Ongoing Active Call Warning */}
        {isBusyOnCall ? (
          <View className="w-full gap-3 rounded-2xl bg-amber-500/15 border border-amber-500/40 p-4">
            <View className="flex-row items-center justify-between border-b border-amber-500/30 pb-2">
              <View className="flex-row items-center gap-2">
                <PhoneCall size={16} color="#FBBF24" />
                <Text className="text-xs font-black text-amber-400 uppercase tracking-wider">
                  ONGOING EMERGENCY CALL ({activeIncident?.id})
                </Text>
              </View>
              <Text className="text-xs font-bold text-emerald-400">CALL ACTIVE</Text>
            </View>
            <Text className="text-xs font-medium text-zinc-300 leading-relaxed">
              AI Voice intake is suspended during an ongoing responder call to avoid audio conflicts.
            </Text>
            <Button
              title="CANCEL CALL TO REPORT AGAIN"
              variant="danger"
              size="sm"
              icon={<XCircle size={16} color="#FFFFFF" />}
              onPress={handleCancelCallToReportAgain}
            />
          </View>
        ) : null}

        {/* Center Live AI Avatar with Voice Wave & Emotional Glow */}
        <View className="items-center justify-center my-1">
          <AnimatedVoiceOrb
            onPress={handleActivateVoiceAI}
            size={145}
            useAvatar={true}
            ringColor={detectedMood === 'PANICKED' ? '#F43F5E' : '#38BDF8'}
            audioLevel={audioLevel}
            isListening={isMicActive}
          />

          {hasPermission === false ? (
            <Pressable
              onPress={handleActivateVoiceAI}
              disabled={isBusyOnCall}
              className={`flex-row items-center gap-2 mt-3 bg-rose-500/20 border border-rose-500 px-4 py-2 rounded-full ${isBusyOnCall ? 'opacity-40' : 'active:bg-rose-500/30'}`}
            >
              <Mic size={14} color="#F43F5E" />
              <Text className="text-xs font-extrabold text-rose-300 uppercase tracking-wider">
                GRANT MIC PERMISSION TO SPEAK
              </Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={handleActivateVoiceAI}
              disabled={isBusyOnCall}
              className={`flex-row items-center gap-2 mt-3 bg-[#18181B] border border-[#27272A] px-3.5 py-1.5 rounded-full ${isBusyOnCall ? 'opacity-40' : 'active:bg-[#27272A]'}`}
            >
              <Mic size={14} color={isBusyOnCall ? '#EF4444' : (isMicActive ? '#10B981' : '#FBBF24')} />
              <Text className="text-xs font-extrabold text-zinc-300">
                {isBusyOnCall
                  ? 'BUSY ON LIVE CALL'
                  : (isMicActive ? 'MICROPHONE ACTIVE • SPEAK FREELY' : 'TAP AVATAR TO SPEAK')}
              </Text>
              {!isBusyOnCall && audioLevel > 0 && (
                <View className="flex-row items-center gap-1 ml-1">
                  <Volume2 size={12} color="#38BDF8" />
                  <Text className="text-xs font-bold text-sky-400">{audioLevel}%</Text>
                </View>
              )}
            </Pressable>
          )}

          {/* Language Selector Pills */}
          <View className="flex-row items-center justify-center gap-1.5 mt-2.5">
            {[
              { label: '🇵🇭 Bisaya', code: 'Cebuano / Bisaya' },
              { label: '🇵🇭 Tagalog', code: 'Tagalog / Filipino' },
              { label: '🌐 English', code: 'English / Taglish' },
            ].map((lang) => (
              <Pressable
                key={lang.code}
                onPress={() => setSelectedLanguage(lang.code)}
                className={`px-3 py-1 rounded-full border ${
                  selectedLanguage === lang.code
                    ? 'bg-amber-400/20 border-amber-400'
                    : 'bg-[#18181B] border-[#27272A] active:bg-zinc-800'
                }`}
              >
                <Text
                  className={`text-[11px] font-bold ${
                    selectedLanguage === lang.code ? 'text-amber-300' : 'text-zinc-400'
                  }`}
                >
                  {lang.label}
                </Text>
              </Pressable>
            ))}
          </View>

        </View>

        {/* AI GUIDANCE & EMOTIONAL SUPPORT CARD */}
        <View className="w-full gap-3.5 rounded-3xl bg-[#18181B] border border-[#27272A] p-4 sm:p-5 shadow-xl">
          <View className="flex-row items-center justify-between border-b border-[#27272A] pb-3 gap-2 flex-wrap">
            <View className="flex-row items-center gap-2 shrink-0">
              <HeartHandshake size={16} color="#38BDF8" />
              <Text className="text-xs font-black uppercase tracking-wider text-sky-400">
                AI GUIDANCE & EMOTIONAL SUPPORT
              </Text>
            </View>

            {/* Live Emotional State Badge */}
            {detectedMood === 'PANICKED' ? (
              <View className="flex-row items-center gap-1.5 bg-rose-500/20 border border-rose-500/60 rounded-full px-2.5 py-1 shrink-0">
                <AlertTriangle size={11} color="#F43F5E" />
                <Text className="text-[10px] font-black uppercase text-rose-300">
                  PANIC OBSERVED
                </Text>
              </View>
            ) : detectedMood === 'CALM' ? (
              <View className="flex-row items-center gap-1.5 bg-emerald-500/20 border border-emerald-500/60 rounded-full px-2.5 py-1 shrink-0">
                <ShieldCheck size={11} color="#10B981" />
                <Text className="text-[10px] font-black uppercase text-emerald-300">
                  CALM REPORTING
                </Text>
              </View>
            ) : (
              <View className="flex-row items-center gap-1 bg-sky-500/15 rounded-full px-2.5 py-1 shrink-0">
                <Radio size={11} color="#38BDF8" />
                <Text className="text-[10px] font-extrabold text-sky-300">OBSERVING VOICE...</Text>
              </View>
            )}
          </View>

          {/* Understood Situation Pill */}
          {understoodSituation ? (
            <View className="flex-row items-center gap-2 bg-[#09090B] border border-[#27272A] rounded-xl p-2.5 px-3">
              <Zap size={14} color="#FBBF24" />
              <Text className="text-xs font-bold text-zinc-300 flex-1">
                AI Understood: <Text className="text-amber-400 font-extrabold">{understoodSituation}</Text>
              </Text>
            </View>
          ) : null}

          {/* Hands-Free Auto-Dispatching Countdown Bar */}
          {autoDispatchCountdown !== null && autoDispatchCountdown > 0 ? (
            <View className="flex-row items-center justify-between rounded-xl bg-amber-500/15 border border-amber-500/40 p-3 px-3.5 gap-2 flex-wrap">
              <View className="flex-row items-center gap-2 shrink-0">
                <ActivityIndicator size="small" color="#FBBF24" />
                <Text className="text-xs font-black text-amber-300">
                  AUTO-DISPATCHING IN {autoDispatchCountdown}s...
                </Text>
              </View>
              <Text className="text-[10px] font-semibold text-zinc-400 shrink-0">Keep speaking to add info</Text>
            </View>
          ) : null}
        </View>

        {/* Live Speech Stream Display with Typewriter Text */}
        <View className="w-full gap-2.5 rounded-3xl bg-[#18181B] border border-[#27272A] p-4 px-5">
          <View className="flex-row items-center justify-between border-b border-[#27272A] pb-2">
            <View className="flex-row items-center gap-2">
              <Sparkles size={14} color="#38BDF8" />
              <Text className="text-xs font-black uppercase tracking-wider text-sky-400">
                LIVE VOICE TRANSCRIPT
              </Text>
            </View>
            <Text className="text-[11px] font-bold text-emerald-400">
              {isMicActive ? 'LISTENING LIVE 🔴' : 'MIC READY 🟢'}
            </Text>
          </View>

          <View className="min-h-[50px] justify-center py-1">
            <TypewriterText
              key={activeText}
              text={`"${activeText}"`}
              speed={20}
              className="text-sm font-extrabold leading-relaxed italic text-white"
            />
          </View>
        </View>
      </View>
    </ScrollView>
  );
}
