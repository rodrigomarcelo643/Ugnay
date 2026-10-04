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
  HeartHandshake,
  Mic,
  PhoneCall,
  Radio,
  ShieldCheck,
  Sparkles,
  Volume2,
  XCircle,
  Zap
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

  const getInitialComfort = (lang: string) => {
    if (lang?.includes('Bisaya') || lang?.includes('Cebuano')) {
      return 'Ako ang imong UGNAY AI gabay. Kalma lang ug ginhawa og lawom. Isulti unsay nahitabo ug asa imong lokasyon.';
    }
    if (lang?.includes('Tagalog') || lang?.includes('Filipino')) {
      return 'Ako ang iyong UGNAY AI gabay. Huminahon po at huminga nang malalim. Sabihin kung ano ang nangyari at ang inyong lokasyon.';
    }
    return 'I am your UGNAY AI guide. Take a slow, deep breath. Tell me what is happening and your location.';
  };

  // AI Behavior Observation & Emotional Comfort State
  const [detectedMood, setDetectedMood] = useState<'CALM' | 'PANICKED' | 'LISTENING'>('LISTENING');
  const [comfortText, setComfortText] = useState<string>(() => getInitialComfort(selectedLanguage));
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

      const clean = sanitizeTranscript(finalSpeech) || finalSpeech.trim() || 'Emergency reported via voice interface';
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
      if (!liveText || liveText.trim().length < 2) return;

      // 1. FAST LOCAL KEYWORD & CATEGORY TRIAGE (Zero-latency instant matching)
      const quickMatch = AIService.matchResponderCategory(liveText);
      const isEmergencyDistress = quickMatch.isMatch;

      if (isEmergencyDistress) {
        setUnderstoodSituation(quickMatch.categoryLabel);
        setDetectedMood(
          /(?:patay|mamatay|saklolo|tulong|tabang|papatayin|dios ko|diyos ko)/i.test(liveText)
            ? 'PANICKED'
            : 'CALM'
        );

        const comfort =
          selectedLanguage.includes('Tagalog') || selectedLanguage.includes('Filipino')
            ? `Naiintindihan ko ang emergency (${quickMatch.categoryLabel}). Huminahon po, inihahanda ang dispatch.`
            : selectedLanguage.includes('Bisaya') || selectedLanguage.includes('Cebuano')
              ? `Nasabtan nako ang emergency (${quickMatch.categoryLabel}). Kalma lang palihug, giandam na ang dispatch.`
              : `I understand your emergency (${quickMatch.categoryLabel}). Stay calm, preparing rescue dispatch.`;
        setComfortText(comfort);

        // Clear any prior timer before starting silence detection
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);

        // 2-second countdown to allow caller to add details, then auto-dispatch
        let secondsRemaining = 2;
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
        }, 2200);

        // Background AI panic evaluation
        AIService.evaluateEmergencyAndPanic(liveText).then((evalResult) => {
          if (evalResult.is_panic) setDetectedMood('PANICKED');
        }).catch(() => {});

        return;
      }

      // 2. Strict Emergency Verification via OpenAI Evaluation for complex speech
      try {
        const evaluation = await AIService.evaluateEmergencyAndPanic(liveText);

        if (!evaluation.is_emergency || evaluation.category === 'UNMATCHED') {
          if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
          if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
          setAutoDispatchCountdown(null);
          setUnderstoodSituation('');
          setDetectedMood('LISTENING');

          const promptDetail =
            selectedLanguage.includes('Tagalog') || selectedLanguage.includes('Filipino')
              ? 'Nakikinig ako. Pakisabi po kung anong emergency ang nangyayari (sunog, baha, aksidente, o kailangan ng pulis)?'
              : selectedLanguage.includes('Bisaya') || selectedLanguage.includes('Cebuano')
                ? 'Paminaw ko nimo. Isulti palihug kon unsay emergency (sunog, baha, pasyente, o pulis)?'
                : 'Listening... Please describe the emergency: is it fire, flood, medical, or police?';
          setComfortText(promptDetail);
          return;
        }

        // REAL EMERGENCY IDENTIFIED VIA AI!
        setUnderstoodSituation(evaluation.categoryLabel);
        setDetectedMood(evaluation.is_panic ? 'PANICKED' : 'CALM');

        const comfort =
          selectedLanguage.includes('Tagalog') || selectedLanguage.includes('Filipino')
            ? `Naiintindihan ko ang iyong emergency (${evaluation.categoryLabel}). Inihahanda ang dispatch.`
            : selectedLanguage.includes('Bisaya') || selectedLanguage.includes('Cebuano')
              ? `Nasabtan nako ang imong report (${evaluation.categoryLabel}). Giproseso na ang emergency dispatch.`
              : `I understand your report clearly (${evaluation.categoryLabel}). Processing emergency dispatch details now.`;
        setComfortText(comfort);

        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);

        let secondsRemaining = 2;
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
        }, 2200);
      } catch (err) {
        console.warn('AI evaluation notice:', err);
      }
    },
    [selectedLanguage, triggerAutoDispatch]
  );

  const handleTranscriptUpdate = useCallback(
    (liveText: string) => {
      if (isBusyOnCall) return;
      const textToUse = sanitizeTranscript(liveText) || liveText?.trim();
      if (textToUse) {
        setSpeechTranscript(textToUse);
        evaluateUserBehavior(textToUse);
      }
    },
    [setSpeechTranscript, evaluateUserBehavior, isBusyOnCall]
  );

  // Interrupt talking AI immediately when user starts speaking
  const handleSpeechStart = useCallback(() => {
    AIService.stopSpeech();
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    setAutoDispatchCountdown(null);
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
    isOpenAIActive,
  } = useLiveSpeech(handleTranscriptUpdate, handleSpeechStart);

  stopListeningRef.current = stopListening;
  startListeningRef.current = startListening;

  const [isMounted, setIsMounted] = useState(false);
  const [openAiVerified, setOpenAiVerified] = useState<boolean | null>(null);

  useEffect(() => {
    setIsMounted(true);
    AIService.verifyOpenAIKey().then((res) => {
      setOpenAiVerified(res.valid);
      console.log('[UGNAY AI Engine] OpenAI API Key Status:', res.valid ? 'ACTIVE & VERIFIED' : 'FAILED', res.message);
    });
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
    if (currentSpoken && currentSpoken.trim().length >= 2) {
      triggerAutoDispatch(currentSpoken);
      return;
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
      : (micTranscript?.trim() || speechTranscript?.trim() || 'Listening... Speak naturally into your microphone'));

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
                className={`px-3 py-1 rounded-full border ${selectedLanguage === lang.code
                    ? 'bg-amber-400/20 border-amber-400'
                    : 'bg-[#18181B] border-[#27272A] active:bg-zinc-800'
                  }`}
              >
                <Text
                  className={`text-[11px] font-bold ${selectedLanguage === lang.code ? 'text-amber-300' : 'text-zinc-400'
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

          {/* Hands-Free Auto-Dispatching Countdown Bar with Instant Send */}
          {autoDispatchCountdown !== null && autoDispatchCountdown > 0 ? (
            <Pressable
              onPress={() => triggerAutoDispatch(sanitizeTranscript(speechTranscript) || sanitizeTranscript(micTranscript) || 'Emergency assistance needed')}
              className="flex-row items-center justify-between rounded-xl bg-amber-500 border border-amber-400 p-3 px-3.5 gap-2 flex-wrap active:scale-98"
            >
              <View className="flex-row items-center gap-2 shrink-0">
                <ActivityIndicator size="small" color="#09090B" />
                <Text className="text-xs font-black text-zinc-950 uppercase tracking-wider">
                  DISPATCHING IN {autoDispatchCountdown}s • TAP TO SEND NOW ⚡
                </Text>
              </View>
              <Text className="text-[10px] font-black text-zinc-950 shrink-0">SEND ➔</Text>
            </Pressable>
          ) : null}
        </View>

        {/* Live Speech Stream Display with Typewriter Text */}
        <View className="w-full gap-2.5 rounded-3xl bg-[#18181B] border border-[#27272A] p-4 px-4.5">
          <View className="flex-row items-center justify-between border-b border-[#27272A] pb-2 gap-2">
            <View className="flex-row items-center gap-1.5 flex-1 min-w-0">
              <Sparkles size={13} color="#38BDF8" />
              <Text className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-sky-400" numberOfLines={1}>
                LIVE TRANSCRIPT
              </Text>
            </View>
            <View className="flex-row items-center gap-1.5 shrink-0">
              {openAiVerified && (
                <View className="flex-row items-center gap-0.5 bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.5 rounded-full">
                  <Text className="text-[9px] font-black text-emerald-300">WHISPER ⚡</Text>
                </View>
              )}
              <Text className="text-[10px] font-bold text-emerald-400">
                {isMicActive ? 'LIVE 🔴' : 'READY 🟢'}
              </Text>
            </View>
          </View>

          <View className="min-h-[50px] justify-center py-1">
            <TypewriterText
              key={activeText}
              text={`"${activeText}"`}
              speed={6}
              className="text-sm font-extrabold leading-relaxed italic text-white"
            />
          </View>
        </View>

        {/* Hands-Free Voice-First Dispatch Notice */}
        <View className="items-center py-2 px-3 bg-[#18181B]/60 border border-[#27272A] rounded-2xl">
          <Text className="text-center text-xs text-amber-300/90 font-bold leading-relaxed">
            🎙️ Voice-First Emergency Dispatch
          </Text>
          <Text className="text-center text-[11px] text-zinc-400 font-medium mt-0.5">
            Speak naturally into your microphone. The AI comforts you and auto-dispatches nearest emergency units.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}
