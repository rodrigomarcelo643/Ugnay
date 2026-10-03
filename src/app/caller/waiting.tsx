import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useIncidentStore } from '@/store/incidentStore';
import { ConnectionStatus } from '@/components/ui/ConnectionStatus';
import { Logo } from '@/components/ui/logo';
import { Button } from '@/components/ui/button';
import { supabaseService } from '@/services/supabase';
import { AIService } from '@/services/ai';
import { agoraConvoAI } from '@/services/agoraConvoAI';
import { useLiveSpeech } from '@/hooks/useLiveSpeech';
import { DepartmentService } from '@/services/department-service';
import { DepartmentInfo } from '@/types/incident';
import { QueuingRadarIcon } from '@/components/ui/QueuingRadarIcon';
import { LiveMapView } from '@/components/ui/LiveMapView';
import {
  RefreshCw,
  XCircle,
  ShieldAlert,
  MapPin,
  Clock,
  ArrowLeft,
  Mic,
  Volume2,
  VolumeX,
  Sparkles,
  AlertTriangle,
  Route,
  Radar,
  HeartPulse,
  Brain,
} from 'lucide-react-native';

export default function CallerWaitingScreen() {
  const router = useRouter();
  const { activeIncident, setActiveIncident, resetIncident, selectedLanguage } = useIncidentStore();

  const callerLat = activeIncident?.caller_latitude || 14.5518;
  const callerLng = activeIncident?.caller_longitude || 121.0478;
  const callerAddress = activeIncident?.caller_address || activeIncident?.location || 'Arthaland Century Pacific Tower, 5th Ave cor 30th St, BGC, Taguig';
  const deptLat = activeIncident?.responder_latitude || activeIncident?.department_latitude || 14.5540;
  const deptLng = activeIncident?.responder_longitude || activeIncident?.department_longitude || 121.0475;
  const deptAddress = activeIncident?.department_address || activeIncident?.responder_address || activeIncident?.station_name || activeIncident?.department_name || 'Emergency Dispatch Station Bay';
  const deptName = activeIncident?.department_name || activeIncident?.station_name || 'Emergency Response Unit';

  const [timeLeft, setTimeLeft] = useState(60);
  const [isTimedOut, setIsTimedOut] = useState(false);
  const [attemptCount, setAttemptCount] = useState(1);
  const [isSpeakingWithAI, setIsSpeakingWithAI] = useState(false);
  const [lastUserUtterance, setLastUserUtterance] = useState<string>('');
  const [requeueNotice, setRequeueNotice] = useState<string | null>(null);

  // Real-time Caller Emotion & Behavioral Guidance state
  const [callerEmotion, setCallerEmotion] = useState(() =>
    AIService.detectCallerEmotionAndBehavior('', selectedLanguage)
  );
  const [addedVoiceFactsCount, setAddedVoiceFactsCount] = useState(0);

  // User speech & AI reader pause / resume state
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [isAIReaderPaused, setIsAIReaderPaused] = useState(false);
  const silenceTimerRef = useRef<any>(null);
  const latestUtteranceRef = useRef<string>('');

  // Scenario-based panic guidance state (grounded in caller's specific disaster / medical scenario)
  const [scenarioPanicGuidance, setScenarioPanicGuidance] = useState(() =>
    AIService.getScenarioPanicGuidance(
      {
        incidentType: activeIncident?.type,
        situation: activeIncident?.situation,
        knownFacts: activeIncident?.known_facts,
        location: activeIncident?.caller_address || activeIncident?.location,
      },
      '',
      selectedLanguage
    )
  );

  // 1. Instant speech start: PAUSE / CUT OFF AI speech immediately when caller starts talking (barge-in)
  const handleSpeechStart = useCallback(() => {
    AIService.stopSpeech();
    setIsAIReaderPaused(true);
    setIsUserSpeaking(true);

    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  // 2. Silence detection: Interpret caller utterance with genuine human empathy & voice response
  const handleUserQuiet = useCallback(
    async (text: string) => {
      setIsUserSpeaking(false);
      setIsAIReaderPaused(false);

      if (!text || text.trim().length < 2) return;

      // Read caller emotion and behavioral pattern
      const emotionResult = AIService.detectCallerEmotionAndBehavior(text, selectedLanguage);
      setCallerEmotion(emotionResult);

      // Formulate scenario-based guidance grounded in the user's specific emergency context
      const currentActive = useIncidentStore.getState().activeIncident;
      const scenarioData = {
        incidentType: currentActive?.type,
        situation: currentActive?.situation,
        knownFacts: currentActive?.known_facts,
        location: currentActive?.caller_address || currentActive?.location,
      };

      const scenarioGuidance = AIService.getScenarioPanicGuidance(
        scenarioData,
        text,
        selectedLanguage
      );
      setScenarioPanicGuidance(scenarioGuidance);

      // Interpret caller's utterance with genuine human empathy
      const interpretation = await AIService.interpretCallerUtterance(
        text,
        {
          type: currentActive?.type,
          departmentName: deptName,
          location: callerAddress,
        },
        selectedLanguage
      );

      // Speak empathetic response aloud via voice (if user hasn't started speaking again)
      if (interpretation.spokenResponse && !isUserSpeaking) {
        AIService.speakGreeting(interpretation.spokenResponse, selectedLanguage);
      }

      // If caller needs assistance or provided an update, retain and persist to incident known_facts!
      if (interpretation.extractedUpdate && currentActive?.id) {
        const cleanUpdate = interpretation.extractedUpdate.trim();
        const existingFacts = currentActive.known_facts || [];
        if (!existingFacts.some((f) => f.toLowerCase().includes(cleanUpdate.toLowerCase()))) {
          const updatedFacts = [...existingFacts, `Voice Update: ${cleanUpdate}`];
          useIncidentStore.getState().setActiveIncident({ ...currentActive, known_facts: updatedFacts });
          setAddedVoiceFactsCount((prev) => prev + 1);

          try {
            const { supabase } = require('@/lib/supabase');
            supabase
              .from('incidents')
              .update({ known_facts: updatedFacts })
              .eq('id', currentActive.id)
              .then(() => {});
          } catch (e) {}
        }
      }
    },
    [selectedLanguage, deptName, callerAddress, isUserSpeaking]
  );

  // 3. Live Speech recognition callback: appends telemetries & manages silence debounce
  const handleTranscript = useCallback(
    (liveText: string) => {
      if (!liveText || liveText.trim().length < 2) return;
      const text = liveText.trim();
      latestUtteranceRef.current = text;
      setLastUserUtterance(text);

      // Instantly pause AI reader while user voice is active
      AIService.stopSpeech();
      setIsAIReaderPaused(true);
      setIsUserSpeaking(true);

      const lower = text.toLowerCase();
      let effectiveType = activeIncident?.type || 'GENERAL';

      // Dynamic emergency category triage if initially GENERAL
      if (effectiveType === 'GENERAL') {
        if (lower.includes('sunog') || lower.includes('fire') || lower.includes('apoy')) {
          effectiveType = 'FIRE';
        } else if (lower.includes('baha') || lower.includes('flood') || lower.includes('tubig')) {
          effectiveType = 'FLOOD';
        } else if (
          lower.includes('medical') ||
          lower.includes('sakit') ||
          lower.includes('ospital') ||
          lower.includes('dugo') ||
          lower.includes('atake') ||
          lower.includes('heart')
        ) {
          effectiveType = 'MEDICAL';
        } else if (
          lower.includes('pulis') ||
          lower.includes('police') ||
          lower.includes('away') ||
          lower.includes('holdup')
        ) {
          effectiveType = 'SECURITY';
        }
      }

      // PRESERVE PREVIOUS QUEUEING WHILE RECORDING NEW CALLER VOICE TELEMETRY
      if (activeIncident) {
        const currentFacts = activeIncident.known_facts || [];
        const isDuplicate = currentFacts.some((f) => f.toLowerCase() === text.toLowerCase());
        const updatedFacts = isDuplicate ? currentFacts : [...currentFacts, text];

        const matchedDept =
          effectiveType !== activeIncident.type
            ? DepartmentService.getNearestDepartment(effectiveType, callerLat, callerLng, true)
            : null;

        const updatedPayload = {
          ...activeIncident,
          type: effectiveType,
          incident_type: effectiveType,
          department: matchedDept ? matchedDept.type : activeIncident.department,
          department_name: matchedDept ? matchedDept.name : activeIncident.department_name,
          station_name: matchedDept ? matchedDept.station_name : activeIncident.station_name,
          distance_km: matchedDept ? matchedDept.distance_km : activeIncident.distance_km,
          eta_minutes: matchedDept ? matchedDept.eta_minutes : activeIncident.eta_minutes,
          known_facts: updatedFacts,
          speech_transcript: `${activeIncident.speech_transcript || ''}\nCaller (Queued Voice): ${text}`.trim(),
          status: 'DISPATCHING' as const, // CRITICAL: PRESERVES PREVIOUS DISPATCH QUEUE!
        };

        setActiveIncident(updatedPayload);
        supabaseService.createIncident(updatedPayload);
        setAddedVoiceFactsCount((prev) => prev + 1);
      }

      // Reset silence debounce timer: 1.5 seconds of quiet after speech before AI continues
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
      silenceTimerRef.current = setTimeout(() => {
        handleUserQuiet(text);
      }, 1500);
    },
    [activeIncident, callerLat, callerLng, handleUserQuiet, setActiveIncident]
  );

  const {
    isListening: isMicActive,
    transcript: micTranscript,
    audioLevel,
    requestMicPermission,
    startListening,
    stopListening,
  } = useLiveSpeech(handleTranscript, handleSpeechStart);

  // 1. On Mount: Speak initial soothing guidance & start Agora Convo AI session
  useEffect(() => {
    if (!activeIncident) return;

    // Auto-start listening on mount (hands-free)
    startListening();

    agoraConvoAI.startConvoAIAgent({
      channelName: activeIncident.channel_name || `ugnay_emergency_${activeIncident.id}`,
      appId: process.env.EXPO_PUBLIC_AGORA_APP_ID || '',
      language: selectedLanguage,
      emergencyType: activeIncident.type || 'GENERAL',
      location: activeIncident.caller_address || activeIncident.location,
    });

    const timer = setTimeout(() => {
      AIService.speakCalmingGuidance(activeIncident.type || 'GENERAL', undefined, selectedLanguage);
    }, 700);

    return () => {
      clearTimeout(timer);
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
      AIService.stopSpeech();
      stopListening();
    };
  }, []);

  // 2. Realtime subscription: When responder accepts, yield AI and push to live call
  useEffect(() => {
    const currentActiveId = activeIncident?.id;
    if (!currentActiveId) return;

    const channel = supabaseService.subscribeToIncidents((incidents) => {
      const activeId = useIncidentStore.getState().activeIncident?.id;
      if (!activeId) return;

      const matched = incidents.find((i) => i.id === activeId);
      if (matched) {
        const previousStatus = useIncidentStore.getState().activeIncident?.status;
        setActiveIncident(matched);
        if (matched.status === 'RESPONDER_FOUND' || matched.status === 'EN_ROUTE') {
          agoraConvoAI.handoverToHumanResponder();
          stopListening();
          AIService.speakGreeting('Responder connected! Transferring to live dispatch line.');
          router.push('/caller/live');
        } else if (matched.status === 'RESOLVED') {
          agoraConvoAI.handoverToHumanResponder();
          stopListening();
          AIService.speakGreeting('Emergency response resolved. Displaying incident brief report.');
          router.push('/caller/incident');
        } else if (matched.status === 'DISPATCHING') {
          // If was previously paired, actually rejected, or re-routed to a new department
          const currentDept = useIncidentStore.getState().activeIncident?.department_name;
          const hasRejections = Boolean(matched.rejected_departments && matched.rejected_departments.length > 0);
          const wasPreviouslyPaired = previousStatus === 'RESPONDER_FOUND' || previousStatus === 'LIVE';
          const isRerouted = Boolean(matched.department_name && currentDept && matched.department_name !== currentDept);

          if (hasRejections || wasPreviouslyPaired || isRerouted) {
            setTimeLeft(60);
            setIsTimedOut(false);
            const targetDeptName = matched.department_name || matched.station_name || 'next available unit';
            const distInfo = matched.distance_km ? ` (${matched.distance_km} km away)` : '';
            setRequeueNotice(
              selectedLanguage.includes('Tagalog') || selectedLanguage.includes('Filipino')
                ? `Hindi available ang nakaraang unit. Inilipat ang dispatch sa ${targetDeptName}${distInfo}... Naghihintay ng responde.`
                : selectedLanguage.includes('Bisaya') || selectedLanguage.includes('Cebuano')
                ? `Dili available ang miaging unit. Gibalhin ang dispatch sa ${targetDeptName}${distInfo}... Nagpaabot sa responde.`
                : `Previous unit unavailable. Re-routed dispatch to ${targetDeptName}${distInfo}... Waiting for response.`
            );
          } else {
            setRequeueNotice(null);
          }
        }
      }
    });

    return () => {
      if (channel) channel.unsubscribe();
    };
  }, [activeIncident?.id]);

  // 3. Continuous dispatch timer: Automatically rotates to next nearest station and keeps queuing active
  useEffect(() => {
    if (!activeIncident) return;

    if (timeLeft <= 0) {
      handleReattempt();
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, activeIncident]);

  const handleReattempt = () => {
    const prevRejected = activeIncident?.rejected_departments || [];
    const updatedRejected = Array.from(
      new Set([
        ...prevRejected,
        activeIncident?.department_name,
        activeIncident?.station_name,
        activeIncident?.department,
      ])
    ).filter(Boolean) as string[];

    const backupDept = DepartmentService.getNextDepartment(
      activeIncident?.type || 'GENERAL',
      callerLat,
      callerLng,
      updatedRejected
    );

    if (activeIncident) {
      const updated = {
        ...activeIncident,
        department: backupDept.type,
        department_name: backupDept.name,
        station_name: backupDept.station_name,
        department_latitude: backupDept.latitude,
        department_longitude: backupDept.longitude,
        responder_latitude: backupDept.latitude,
        responder_longitude: backupDept.longitude,
        department_address: backupDept.address,
        responder_address: backupDept.address,
        distance_km: backupDept.distance_km,
        eta_minutes: backupDept.eta_minutes,
        status: 'DISPATCHING' as const,
        rejected_departments: updatedRejected,
        created_at: new Date().toISOString(),
      };
      setActiveIncident(updated);
      supabaseService.createIncident(updated);
    }

    setTimeLeft(60);
    setIsTimedOut(false);
    setAttemptCount((prev) => prev + 1);
    AIService.speakGreeting(
      `Inililipat ang dispatch sa susunod na istasyon: ${backupDept.name}.`,
      selectedLanguage
    );
  };

  const handleDispatchSpecificDepartment = (dept: DepartmentInfo) => {
    if (activeIncident) {
      const updated = {
        ...activeIncident,
        department: dept.type,
        department_name: dept.name,
        station_name: dept.station_name,
        department_latitude: dept.latitude,
        department_longitude: dept.longitude,
        responder_latitude: dept.latitude,
        responder_longitude: dept.longitude,
        distance_km: dept.distance_km,
        eta_minutes: dept.eta_minutes,
        status: 'DISPATCHING' as const,
        created_at: new Date().toISOString(),
      };
      setActiveIncident(updated);
      supabaseService.createIncident(updated);
    }

    setTimeLeft(60);
    setIsTimedOut(false);
    setAttemptCount((prev) => prev + 1);
    AIService.speakGreeting(
      `Inililipat ang dispatch sa ${dept.name}. Naghihintay ng pagtanggap ng rescue unit.`,
      selectedLanguage
    );
  };

  const handleCancelSearch = () => {
    agoraConvoAI.handoverToHumanResponder();
    resetIncident();
    router.push('/caller/home');
  };

  if (!activeIncident) {
    return (
      <View className="flex-1 items-center justify-center bg-[#09090B] px-6">
        <Text className="text-white font-bold text-lg">No Active Search</Text>
        <Button title="RETURN HOME" onPress={() => router.push('/caller/home')} className="mt-4" />
      </View>
    );
  }

  const nearbyDepartments = useMemo(() => {
    return DepartmentService.getAllNearbyDepartments(activeIncident?.type, callerLat, callerLng);
  }, [activeIncident?.type, callerLat, callerLng]);

  return (
    <ScrollView contentContainerClassName="flex-grow justify-between bg-[#09090B] px-4 sm:px-6 py-6 pb-44 items-center">
      <View className="w-full max-w-2xl flex-grow justify-between gap-4 sm:gap-5">
        {/* Top Header */}
        <View className="w-full flex-row items-center justify-between gap-2">
          <View className="flex-row items-center gap-2.5 flex-1 min-w-0">
            <Logo size={34} />
            <View className="flex-1 min-w-0">
              <Text className="text-[10px] font-bold uppercase tracking-wider text-sky-400" numberOfLines={1}>
                DISPATCHING • ATTEMPT #{attemptCount}
              </Text>
              <Text className="text-base font-black text-white" numberOfLines={1}>
                {activeIncident.type || 'EMERGENCY'} RESPONSE
              </Text>
            </View>
          </View>
          <View className="shrink-0">
            <ConnectionStatus status={isTimedOut ? 'OFFLINE' : 'LIVE'} />
          </View>
        </View>

        {/* Re-queue & Re-routing Notice Banner */}
        {requeueNotice ? (
          <View className="w-full flex-row items-center gap-3 rounded-2xl bg-amber-500/15 border border-amber-500/40 p-3.5">
            <AlertTriangle size={18} color="#FBBF24" />
            <Text className="flex-1 text-xs font-bold text-amber-300 leading-relaxed">
              {requeueNotice}
            </Text>
          </View>
        ) : null}

        {/* Central Queuing & Radar Card */}
        <View className="w-full gap-3.5 rounded-3xl bg-[#18181B] border border-[#27272A] p-5 items-center text-center shadow-xl">
          {!isTimedOut ? (
            <>
              {/* Compact Live AI Avatar positioned cleanly above */}
              <QueuingRadarIcon
                incidentType={activeIncident.type}
                size={70}
              />

              <View className="items-center gap-1">
                <View className="flex-row items-center gap-1.5 rounded-full bg-sky-500/15 border border-sky-500/40 px-3 py-0.5">
                  <Sparkles size={11} color="#38BDF8" />
                  <Text className="text-[10px] font-black uppercase tracking-widest text-sky-400">
                    {activeIncident.type === 'GENERAL'
                      ? 'CITY RESCUE COMMAND • AI GUIDE ACTIVE'
                      : 'SEARCHING NEAREST RESCUE UNIT'}
                  </Text>
                </View>
                <Text className="text-xl font-black text-white text-center mt-0.5">
                  {deptName}
                </Text>
                <View className="flex-row items-center gap-1.5">
                  <MapPin size={12} color="#FBBF24" />
                  <Text className="text-xs font-bold text-amber-400">
                    Distance: {activeIncident.distance_km || 1.1} km (ETA ~{activeIncident.eta_minutes || 4} mins)
                  </Text>
                </View>

                {/* OpenAI Enhanced Category Tags */}
                {activeIncident.category_tags && activeIncident.category_tags.length > 0 ? (
                  <View className="flex-row flex-wrap justify-center gap-1.5 pt-1">
                    {activeIncident.category_tags.map((tag: string, i: number) => (
                      <View key={i} className="rounded-full bg-sky-500/15 border border-sky-500/30 px-2.5 py-0.5">
                        <Text className="text-[10px] font-black text-sky-400 uppercase tracking-wider">
                          {tag}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>

              {/* 60-Second Countdown Timer */}
              <View className="w-full flex-row items-center justify-between rounded-2xl bg-[#09090B] border border-[#27272A] p-3 px-4 mt-0.5">
                <View className="flex-row items-center gap-2">
                  <Clock size={15} color="#38BDF8" />
                  <Text className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                    SEARCH TIMEOUT IN:
                  </Text>
                </View>
                <Text className="text-xl font-black text-sky-400 font-mono">
                  00:{timeLeft.toString().padStart(2, '0')}
                </Text>
              </View>
            </>
          ) : (
            /* Timed Out View */
            <>
              <View className="w-16 h-16 rounded-full bg-amber-500/10 border-2 border-amber-500/40 items-center justify-center my-1">
                <ShieldAlert size={34} color="#FBBF24" />
              </View>

              <View className="items-center gap-2">
                <View className="flex-row items-center gap-1.5 rounded-full bg-amber-500/15 border border-amber-500/40 px-3 py-1">
                  <Radar size={12} color="#FBBF24" />
                  <Text className="text-[10px] font-black uppercase tracking-widest text-amber-400">
                    RADAR SCANNING • EXPANDED BGC RADIUS
                  </Text>
                </View>
                <Text className="text-xs font-black uppercase tracking-widest text-amber-400">
                  NO RESPONSE WITHIN 1 MINUTE
                </Text>
                <Text className="text-lg font-black text-white text-center leading-snug">
                  Nearest unit at {deptName} is currently occupied.
                </Text>
                <Text className="text-xs text-zinc-400 font-medium text-center max-w-sm leading-relaxed">
                  Our system is actively pinging nearby rescue units around Arthaland Century Pacific Tower and surrounding sectors.
                </Text>
              </View>

              {/* Scanned Nearby Units List */}
              <View className="w-full gap-2 pt-2">
                <View className="flex-row items-center justify-between">
                  <Text className="text-[11px] font-black text-zinc-400 uppercase tracking-wider">
                    SCANNED UNITS ({nearbyDepartments.length} IN DATABASE):
                  </Text>
                  <Text className="text-[10px] font-bold text-sky-400">
                    TAP UNIT TO DISPATCH
                  </Text>
                </View>

                <View className="gap-2 max-h-64 overflow-y-auto">
                  {nearbyDepartments.slice(0, 5).map((dept) => {
                    const isAvailable = dept.status === 'AVAILABLE';
                    return (
                      <View
                        key={dept.id}
                        className={`p-3 rounded-2xl border flex-row items-center justify-between gap-3 ${
                          isAvailable
                            ? 'bg-[#1F1F23] border-emerald-500/40'
                            : 'bg-[#18181B]/80 border-rose-500/30 opacity-80'
                        }`}
                      >
                        <View className="flex-1 min-w-0">
                          <Text className="text-xs font-black text-white" numberOfLines={1}>
                            {dept.name}
                          </Text>
                          <Text className="text-[11px] text-zinc-400 mt-0.5" numberOfLines={1}>
                            {dept.station_name} • {dept.distance_km} km (~{dept.eta_minutes}m ETA)
                          </Text>
                          {!isAvailable && dept.status_reason ? (
                            <Text className="text-[10px] text-rose-400 font-medium mt-1" numberOfLines={1}>
                              ⚠️ {dept.status_reason}
                            </Text>
                          ) : null}
                        </View>

                        <View className="shrink-0 items-end gap-1.5">
                          <View
                            className={`px-2 py-0.5 rounded-full border ${
                              isAvailable
                                ? 'bg-emerald-500/20 border-emerald-500/40'
                                : 'bg-rose-500/20 border-rose-500/40'
                            }`}
                          >
                            <Text
                              className={`text-[9px] font-black uppercase tracking-wider ${
                                isAvailable ? 'text-emerald-400' : 'text-rose-400'
                              }`}
                            >
                              {dept.status || 'OCCUPIED'}
                            </Text>
                          </View>
                          {isAvailable ? (
                            <Pressable
                              onPress={() => handleDispatchSpecificDepartment(dept)}
                              className="bg-emerald-500 hover:bg-emerald-600 px-3 py-1 rounded-lg"
                            >
                              <Text className="text-[10px] font-black text-[#09090B]">
                                DISPATCH
                              </Text>
                            </Pressable>
                          ) : null}
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>

              <View className="w-full gap-2.5 pt-2">
                <Button
                  title="AUTO-DISPATCH NEAREST AVAILABLE BACKUP UNIT"
                  variant="gold"
                  size="lg"
                  icon={<RefreshCw size={18} color="#09090B" />}
                  onPress={handleReattempt}
                  className="w-full py-3.5"
                />

                <Button
                  title="CANCEL SEARCH"
                  variant="outline"
                  size="md"
                  icon={<XCircle size={16} color="#A1A1AA" />}
                  onPress={handleCancelSearch}
                  className="w-full"
                />
              </View>
            </>
          )}
        </View>

        {/* 1. LIVE MAP ROUTING TO NEAREST DEPARTMENT (PROMINENTLY DISPLAYED AT TOP) */}
        <View className="w-full rounded-3xl bg-[#18181B] border border-[#27272A] overflow-hidden shadow-2xl">
          <View className="p-3 sm:p-4 px-4 sm:px-5 border-b border-[#27272A] flex-row items-center justify-between bg-[#1F1F23] gap-2 flex-wrap">
            <View className="flex-row items-center gap-2.5 flex-1 min-w-[170px]">
              <View className="p-2 rounded-xl bg-sky-500/20 shrink-0">
                <Route size={15} color="#38BDF8" />
              </View>
              <View className="flex-1 min-w-0">
                <Text className="text-[10px] font-black uppercase tracking-wider text-sky-400" numberOfLines={1}>
                  LIVE MAP ROUTING • DISPATCH RADAR
                </Text>
                <Text className="text-xs sm:text-sm font-black text-white" numberOfLines={1}>
                  {deptName}
                </Text>
              </View>
            </View>
            <View className="bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-1 rounded-full flex-row items-center gap-1.5 shrink-0">
              <View className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <Text className="text-[9px] font-black text-emerald-400">
                RADAR PING ACTIVE
              </Text>
            </View>
          </View>

          {/* Render the interactive Leaflet + OpenStreetMap + ORS Route */}
          <LiveMapView
            callerLat={callerLat}
            callerLng={callerLng}
            callerAddress={callerAddress}
            responderLat={deptLat}
            responderLng={deptLng}
            responderAddress={deptAddress}
            departmentName={deptName}
            role="CALLER"
            mapHeight={250}
            nearbyDepartments={nearbyDepartments}
            isPingingRadar={true}
          />
        </View>

        {/* 2. HANDS-FREE CALLER VOICE & CALM EMOTION COMPANION (NO TAP BUTTON) */}
        <View className="w-full gap-3.5 rounded-3xl bg-[#18181B] border border-sky-500/30 p-4 sm:p-5 shadow-xl">
          {/* Card Header with Queue Persistence Pill */}
          <View className="flex-row items-center justify-between border-b border-[#27272A] pb-3 gap-2 flex-wrap">
            <View className="flex-row items-center gap-2.5 shrink-0">
              <View className="p-2 rounded-xl bg-sky-500/20">
                <Brain size={16} color="#38BDF8" />
              </View>
              <View>
                <Text className="text-xs font-black text-sky-400 uppercase tracking-wider">
                  AI COMPANION & VOICE TELEMETRY
                </Text>
                <Text className="text-[10px] text-zinc-400 font-medium">
                  Hands-Free Live Voice Guidance
                </Text>
              </View>
            </View>

            {/* Status pills: AI Reader active/paused and queue persistence */}
            <View className="flex-row items-center gap-2 flex-wrap shrink-0">
              {isUserSpeaking || isAIReaderPaused ? (
                <View className="bg-amber-500/20 border border-amber-500/50 px-2.5 py-1 rounded-full flex-row items-center gap-1.5 shrink-0">
                  <VolumeX size={11} color="#FBBF24" />
                  <Text className="text-[9px] font-black text-amber-300 uppercase tracking-wider">
                    AI LISTENING...
                  </Text>
                </View>
              ) : (
                <View className="bg-sky-500/20 border border-sky-500/40 px-2.5 py-1 rounded-full flex-row items-center gap-1.5 shrink-0">
                  <Volume2 size={11} color="#38BDF8" />
                  <Text className="text-[9px] font-black text-sky-300 uppercase tracking-wider">
                    AI READY
                  </Text>
                </View>
              )}

              <View className="bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-1 rounded-full flex-row items-center gap-1.5 shrink-0">
                <View className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <Text className="text-[9px] font-black text-emerald-400">
                  QUEUE ACTIVE
                </Text>
              </View>
            </View>
          </View>

          {/* Hands-Free Passive Listening Banner (No Tap Required) */}
          <View className="p-3.5 rounded-2xl bg-[#09090B] border border-[#27272A] flex-row items-center justify-between gap-3">
            <View className="flex-row items-center gap-3 flex-1 min-w-0">
              <View className="w-10 h-10 rounded-xl bg-sky-500/15 border border-sky-500/40 items-center justify-center shrink-0">
                <Mic size={18} color={isUserSpeaking ? '#FBBF24' : '#38BDF8'} />
              </View>
              <View className="flex-1 min-w-0">
                <Text className="text-xs font-black text-white" numberOfLines={1}>
                  {isUserSpeaking ? 'HEARING YOUR VOICE...' : 'HANDS-FREE VOICE AI ACTIVE'}
                </Text>
                <Text className="text-[11px] text-zinc-400 mt-0.5" numberOfLines={1}>
                  Always listening • Speak freely, dispatch queue continues
                </Text>
              </View>
            </View>

            {audioLevel > 0 && (
              <View className="flex-row items-center gap-1 px-2.5 py-1 rounded-full bg-sky-500/15 shrink-0">
                <Volume2 size={12} color="#38BDF8" />
                <Text className="text-[10px] font-bold text-sky-400">{audioLevel}%</Text>
              </View>
            )}
          </View>

          {/* Simplified, Non-Alarmist Emotional Reassurance Status */}
          <View className="rounded-2xl bg-[#09090B] border border-[#27272A] p-3.5 gap-2">
            <View className="flex-row items-center justify-between gap-2">
              <View className="flex-row items-center gap-2">
                <HeartPulse
                  size={15}
                  color={
                    scenarioPanicGuidance.isPanicking || callerEmotion.emotion === 'PANICKED'
                      ? '#F43F5E'
                      : '#10B981'
                  }
                />
                <Text className="text-xs font-black text-white uppercase tracking-wider">
                  STATUS GUIDANCE:
                </Text>
              </View>
              <View
                className={`px-2.5 py-0.5 rounded-full border ${
                  scenarioPanicGuidance.isPanicking || callerEmotion.emotion === 'PANICKED'
                    ? 'bg-rose-500/15 border-rose-500/40'
                    : 'bg-emerald-500/15 border-emerald-500/40'
                }`}
              >
                <Text
                  className={`text-[10px] font-black uppercase ${
                    scenarioPanicGuidance.isPanicking || callerEmotion.emotion === 'PANICKED'
                      ? 'text-rose-400'
                      : 'text-emerald-300'
                  }`}
                >
                  {scenarioPanicGuidance.isPanicking || callerEmotion.emotion === 'PANICKED'
                    ? 'CRITICAL DISTRESS'
                    : 'CALM & MONITORED'}
                </Text>
              </View>
            </View>

            <Text className="text-xs font-medium text-zinc-300 leading-relaxed italic">
              "{scenarioPanicGuidance.isPanicking || callerEmotion.emotion === 'PANICKED'
                ? scenarioPanicGuidance.reassuranceText
                : callerEmotion.summary || 'Stay on the line. Responders are actively being routed to your coordinates.'}"
            </Text>
          </View>

          {/* Latest Caller Utterance Appended to Incident Brief */}
          {lastUserUtterance ? (
            <View className="rounded-xl bg-[#09090B] border border-sky-500/20 p-3 gap-1">
              <View className="flex-row items-center justify-between">
                <Text className="text-[10px] font-bold text-sky-400 uppercase tracking-wider">
                  LATEST VOICE TELEMETRY SENT:
                </Text>
                <View className="bg-emerald-500/15 px-2 py-0.5 rounded-full border border-emerald-500/30">
                  <Text className="text-[9px] font-black text-emerald-400">
                    APPENDED TO DISPATCH (#{addedVoiceFactsCount})
                  </Text>
                </View>
              </View>
              <Text className="text-xs font-semibold text-zinc-200 italic mt-0.5">
                "{lastUserUtterance}"
              </Text>
            </View>
          ) : null}
        </View>

        {/* Back / Brief Navigation */}
        <View className="w-full pt-1 pb-4">
          <Button
            title="RETURN TO INCIDENT BRIEF"
            variant="outline"
            size="sm"
            icon={<ArrowLeft size={16} color="#A1A1AA" />}
            onPress={() => router.push('/caller/incident')}
          />
        </View>
      </View>
    </ScrollView>
  );
}
