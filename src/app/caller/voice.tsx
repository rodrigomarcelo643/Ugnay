import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useIncidentStore } from '@/store/incidentStore';
import { useLiveSpeech } from '@/hooks/useLiveSpeech';
import { ConnectionStatus } from '@/components/ui/ConnectionStatus';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/ui/logo';
import { AnimatedVoiceOrb } from '@/components/ui/AnimatedVoiceOrb';
import { TypewriterText } from '@/components/ui/TypewriterText';
import {
  Mic,
  Sparkles,
  Volume2,
  PhoneCall,
  XCircle,
  HeartHandshake,
  ShieldCheck,
  AlertTriangle,
  Radio,
  Zap,
} from 'lucide-react-native';
import { supabaseService } from '@/services/supabase';
import { AIService, sanitizeTranscript } from '@/services/ai';

export default function CallerVoice() {
  const router = useRouter();
  const {
    activeIncident,
    resetIncident,
    speechTranscript,
    setSpeechTranscript,
    setIsListening,
    selectedLanguage,
  } = useIncidentStore();

  const isBusyOnCall = Boolean(activeIncident && activeIncident.id && activeIncident.status === 'LIVE');

  // AI Behavior Observation & Emotional Comfort State
  const [detectedMood, setDetectedMood] = useState<'CALM' | 'PANICKED' | 'LISTENING'>('LISTENING');
  const [comfortText, setComfortText] = useState<string>('');
  const [understoodSituation, setUnderstoodSituation] = useState<string>('');
  const [autoDispatchCountdown, setAutoDispatchCountdown] = useState<number | null>(null);

  const silenceTimerRef = useRef<any>(null);
  const countdownIntervalRef = useRef<any>(null);
  const hasTriggeredComfortRef = useRef<boolean>(false);
  const stopListeningRef = useRef<() => void>(() => {});
  const startListeningRef = useRef<() => void>(() => {});

  // Trigger hands-free auto-dispatch once user finishes speaking
  const triggerAutoDispatch = useCallback(
    async (finalSpeech: string) => {
      if (isBusyOnCall) return;
      stopListeningRef.current();
      setIsListening(false);

      const clean = sanitizeTranscript(finalSpeech) || finalSpeech.trim() || 'Emergency reported via voice interface';
      setSpeechTranscript(clean);

      // Do not play auto-responding speech over the user; proceed directly to triage
      router.push('/caller/analyzing');
    },
    [isBusyOnCall, router, setSpeechTranscript, setIsListening]
  );

  // Observe caller behavior and verify if voice input matches a responder
  const evaluateUserBehavior = useCallback(
    (liveText: string) => {
      if (!liveText || liveText.trim().length < 3) return;

      const lower = liveText.toLowerCase();

      // Detect panic indicators & distress phrases
      const panicWords = [
        'tabang', 'tulong', 'help', 'patay', 'mamatay',
        'kalisang', 'hadlok', 'takot', 'natatakot', 'dios ko', 'diyos ko', 'bilis',
        'dali', 'dying', 'scared', 'bleeding', 'dugo', 'trapped', 'breathe', 'hininga',
        'tulungan'
      ];
      const isPanic = panicWords.some((w) => lower.includes(w)) || /[!]{2,}/.test(liveText);

      // Check whether user's voice matches an actual responder department (Fire, Flood, Medical, Police)
      const match = AIService.matchResponderCategory(liveText);

      // IF USER INPUT DOES NOT MATCH A VALID RESPONDER CATEGORY:
      // DO NOT claim "Processing emergency dispatch details now" and DO NOT show category/urgency!
      if (!match.isMatch) {
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
        setAutoDispatchCountdown(null);

        // Clear understood situation so no fake category/urgency is shown
        setUnderstoodSituation('');

        if (isPanic) {
          setDetectedMood('PANICKED');
          const soothe =
            selectedLanguage.includes('Tagalog') || selectedLanguage.includes('Filipino')
              ? 'Huminahon ka po, kasama mo ako. Sabihin mo kung anong emergency ang nangyayari (sunog, baha, aksidente, o kailangan ng pulis)?'
              : selectedLanguage.includes('Bisaya') || selectedLanguage.includes('Cebuano')
              ? 'Kalma lang palihug, ayaw kalisang. Isulti palihog unsay nahitabo (sunog, baha, pasyente, o pulis)?'
              : 'Stay calm, take a slow deep breath. Please tell me what happened: is it fire, flood, medical, or police?';
          setComfortText(soothe);
        } else {
          setDetectedMood('LISTENING');
          setComfortText('');
        }
        return;
      }

      // USER VOICE IS VALID & MATCHED A RESPONDER!
      setUnderstoodSituation(match.categoryLabel);

      if (isPanic) {
        setDetectedMood('PANICKED');
        const comfort =
          selectedLanguage.includes('Tagalog') || selectedLanguage.includes('Filipino')
            ? `Huminahon ka, kasama mo ako. Inihahanda ang responde ng ${match.categoryLabel}.`
            : selectedLanguage.includes('Bisaya') || selectedLanguage.includes('Cebuano')
            ? `Kalma lang palihug, ayaw kalisang. Giproseso na ang responde sa ${match.categoryLabel}.`
            : `Stay calm, take a deep breath. Coordinating ${match.categoryLabel} rescue units for you now.`;
        setComfortText(comfort);
      } else {
        setDetectedMood('CALM');
        const understood =
          selectedLanguage.includes('Tagalog') || selectedLanguage.includes('Filipino')
            ? `Naiintindihan ko ang iyong emergency (${match.categoryLabel}). Inihahanda ang dispatch.`
            : selectedLanguage.includes('Bisaya') || selectedLanguage.includes('Cebuano')
            ? `Nasabtan nako ang imong report (${match.categoryLabel}). Giproseso na ang emergency dispatch.`
            : `I understand your report clearly (${match.categoryLabel}). Processing emergency dispatch details now.`;
        setComfortText(understood);
      }

      // Clear any prior timer before starting silence detection
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);

      // Start 3-second silence detector only when a responder emergency is matched
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
      const cleanText = sanitizeTranscript(liveText) || liveText.trim();
      if (cleanText) {
        setSpeechTranscript(cleanText);
        evaluateUserBehavior(cleanText);
      }
    },
    [setSpeechTranscript, evaluateUserBehavior, isBusyOnCall]
  );

  const {
    isListening: isMicActive,
    transcript: micTranscript,
    interimTranscript,
    audioLevel,
    hasPermission,
    requestMicPermission,
    startListening,
    stopListening,
  } = useLiveSpeech(handleTranscriptUpdate);

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
    requestMicPermission().then((granted) => {
      if (granted) {
        startListening();
      }
    });

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

    const granted = await requestMicPermission();
    if (granted) {
      startListening();
    }
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
        </View>

        {/* AI REAL-TIME BEHAVIOR OBSERVATION & COMFORTING CARD */}
        <View className="w-full gap-3.5 rounded-3xl bg-[#18181B] border border-[#27272A] p-4 sm:p-5 shadow-xl">
          <View className="flex-row items-center justify-between border-b border-[#27272A] pb-3 gap-2 flex-wrap">
            <View className="flex-row items-center gap-2 shrink-0">
              <HeartHandshake size={16} color="#38BDF8" />
              <Text className="text-xs font-black uppercase tracking-wider text-sky-400">
                AI BEHAVIOR OBSERVATION
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

          {/* AI Comfort Guidance Message */}
          {comfortText ? (
            <View className="rounded-2xl bg-sky-500/10 border border-sky-500/30 p-3.5">
              <Text className="text-xs font-bold text-sky-200 leading-relaxed italic">
                "{comfortText}"
              </Text>
            </View>
          ) : (
            <View className="rounded-2xl bg-[#09090B] border border-[#27272A] p-3">
              <Text className="text-xs font-medium text-zinc-400 leading-relaxed">
                Speak freely about what happened. The AI observes if you feel frightened or panicked and will de-escalate, soothe, and dispatch automatically.
              </Text>
            </View>
          )}

          {/* Hands-Free Auto-Dispatching Countdown Bar (No button to press!) */}
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

        <Text className="text-center text-[11px] text-zinc-500 font-medium">
          Hands-Free Mode: Speak naturally. The AI understands you, comforts your panic, and automatically dispatches without pressing any button.
        </Text>
      </View>
    </ScrollView>
  );
}
