import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useIncidentStore } from '@/store/incidentStore';
import { ConnectionStatus } from '@/components/ui/ConnectionStatus';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/ui/logo';
import { LiveVideoBox } from '@/components/ui/LiveVideoBox';
import { LiveMapView } from '@/components/ui/LiveMapView';
import { LiveCallTranscript } from '@/components/ui/LiveCallTranscript';
import { useAgoraRtc } from '@/hooks/useAgoraRtc';
import { PhoneOff, Maximize2, ArrowRight, RotateCcw, CheckCircle2, RefreshCw } from 'lucide-react-native';
import { Pressable } from 'react-native';
import { supabaseService } from '@/services/supabase';
import { AIService } from '@/services/ai';
import { DepartmentService } from '@/services/department-service';

export default function CallerLiveCall() {
  const router = useRouter();
  const {
    activeIncident,
    setActiveIncident,
    resetIncident,
    selectedLanguage,
  } = useIncidentStore();

  const [tempToken, setTempToken] = useState<string>('');
  const channelName = activeIncident?.channel_name || `ugnay_emergency_${activeIncident?.id || 'demo'}`;
  const CALLER_UID = 1001;

  const {
    joined,
    localVideoTrack,
    remoteUser,
    audioLevel,
    remoteAudioLevel,
    isMuted,
    isVideoOn,
    isCallEnded,
    mediaError,
    connectionState,
    toggleMute,
    toggleVideo,
    endCall,
    reconnect,
  } = useAgoraRtc(channelName, CALLER_UID, tempToken);

  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (isCallEnded) {
      const current = useIncidentStore.getState().activeIncident;
      if (current?.status === 'RESOLVED') {
        router.push('/caller/incident');
      } else if (current?.status === 'DISPATCHING' || current?.status === 'NEEDS_RESPONSE') {
        router.push('/caller/waiting');
      } else {
        resetIncident();
        router.push('/caller/home');
      }
    }
  }, [isCallEnded]);

  useEffect(() => {
    // Sync active incident state with real active incidents in Supabase DB
    const syncActiveCall = async () => {
      const activeList = await supabaseService.fetchActiveIncidents();
      const currentActiveId = useIncidentStore.getState().activeIncident?.id;
      const matched = activeList.find(
        (i) => i.id === currentActiveId && i.status !== 'RESOLVED'
      );

      if (matched) {
        setActiveIncident(matched);
      } else if (!currentActiveId || !activeList.some((i) => i.id === currentActiveId)) {
        // If resolved in DB, keep the incident reference and navigate to brief
        const allIncidents = await supabaseService.fetchIncidents();
        const resolvedMatch = allIncidents.find((i) => i.id === currentActiveId);
        if (resolvedMatch && resolvedMatch.status === 'RESOLVED') {
          setActiveIncident(resolvedMatch);
          router.push('/caller/incident');
        } else {
          setActiveIncident(null);
        }
      }
    };

    syncActiveCall();

    // Subscribe to realtime updates to cut call on both lines when resolved or re-queued
    const channel = supabaseService.subscribeToIncidents((incidents) => {
      const currentActiveId = useIncidentStore.getState().activeIncident?.id;
      if (!currentActiveId) return;

      const matched = incidents.find((i) => i.id === currentActiveId);

      if (matched && matched.status === 'RESOLVED') {
        setActiveIncident(matched);
        endCall();
        AIService.speakGreeting(
          'Emergency response resolved. Displaying incident brief report.',
          selectedLanguage
        );
        router.push('/caller/incident');
      } else if (!matched) {
        endCall();
        resetIncident();
        router.push('/caller/home');
      } else if (matched.status === 'DISPATCHING' || matched.status === 'NEEDS_RESPONSE') {
        // Responder rejected / re-queued call: End call for both sides, but CONTINUE QUEUING for caller!
        endCall();
        setActiveIncident(matched);
        AIService.speakGreeting(
          'The responder had to decline or was unavailable. Continuing to queue you for the next available emergency unit.',
          selectedLanguage
        );
        router.push('/caller/waiting');
      } else {
        setActiveIncident(matched);
      }
    });

    return () => {
      if (channel) channel.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!activeIncident || activeIncident.status === 'RESOLVED') return;

    const timer = setInterval(() => {
      setSeconds((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [activeIncident]);

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Full Resolution: User's needs are satisfied and caller is safe
  const handleResolveAndFinish = async () => {
    if (activeIncident?.id) {
      const resolved = { ...activeIncident, status: 'RESOLVED' as const };
      setActiveIncident(resolved);
      await supabaseService.updateIncidentStatus(activeIncident.id, 'RESOLVED');
    }
    await endCall();
    AIService.speakGreeting(
      'Emergency response resolved. Displaying incident brief report.',
      selectedLanguage
    );
    router.push('/caller/incident');
  };

  // Re-queue: User needs NOT satisfied, proceed to next department and continue queuing
  const handleContinueQueuing = async () => {
    await endCall();
    if (activeIncident?.id) {
      const prevRejected = activeIncident.rejected_departments || [];
      const updatedRejected = Array.from(
        new Set([
          ...prevRejected,
          activeIncident.department_name,
          activeIncident.station_name,
          activeIncident.department,
        ])
      ).filter(Boolean) as string[];

      const prevRejectedResponders = activeIncident.rejected_by_responders || [];
      const updatedRejectedResponders = Array.from(
        new Set([
          ...prevRejectedResponders,
          activeIncident.responder_name,
          activeIncident.responder_id,
        ])
      ).filter(Boolean) as string[];

      const nextDept = DepartmentService.getNextDepartment(
        activeIncident.type || activeIncident.incident_type || 'GENERAL',
        activeIncident.caller_latitude || 14.5518,
        activeIncident.caller_longitude || 121.0478,
        updatedRejected
      );

      const requeued = {
        ...activeIncident,
        department: nextDept.type,
        department_name: nextDept.name,
        station_name: nextDept.station_name,
        department_latitude: nextDept.latitude,
        department_longitude: nextDept.longitude,
        responder_latitude: nextDept.latitude,
        responder_longitude: nextDept.longitude,
        department_address: nextDept.address,
        responder_address: nextDept.address,
        distance_km: nextDept.distance_km,
        eta_minutes: nextDept.eta_minutes,
        status: 'DISPATCHING' as const,
        responder_id: undefined,
        responder_name: undefined,
        rejected_departments: updatedRejected,
        rejected_by_responders: updatedRejectedResponders,
      };

      await supabaseService.updateIncidentStatus(activeIncident.id, 'DISPATCHING', {
        department: nextDept.type,
        department_name: nextDept.name,
        station_name: nextDept.station_name,
        department_latitude: nextDept.latitude,
        department_longitude: nextDept.longitude,
        responder_latitude: nextDept.latitude,
        responder_longitude: nextDept.longitude,
        department_address: nextDept.address,
        responder_address: nextDept.address,
        distance_km: nextDept.distance_km,
        eta_minutes: nextDept.eta_minutes,
        responder_id: undefined,
        responder_name: undefined,
        rejected_departments: updatedRejected,
        rejected_by_responders: updatedRejectedResponders,
      });

      setActiveIncident(requeued);
      AIService.speakGreeting(
        `Inililipat ang dispatch sa susunod na istasyon: ${nextDept.name}. Nagpapatuloy sa paghahanap.`,
        selectedLanguage
      );
    }
    router.push('/caller/waiting');
  };

  const isResponderDisconnected = connectionState === 'disconnected' || connectionState === 'failed';

  if (!activeIncident || !activeIncident.id || activeIncident.status === 'RESOLVED') {
    return (
      <View className="flex-1 items-center justify-between bg-[#09090B] px-6 py-8 pb-28">
        <View className="w-full max-w-2xl flex-1 items-center justify-between gap-6">
          <View className="w-full flex-row items-center justify-between">
            <View className="flex-row items-center gap-3">
              <Logo size={36} />
              <View>
                <Text className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                  AGORA RTC LIVE CALL
                </Text>
                <Text className="text-base font-black text-white">
                  Voice & Video Monitor
                </Text>
              </View>
            </View>
            <ConnectionStatus status="LIVE" />
          </View>

          <View className="w-full items-center justify-center gap-4 rounded-3xl bg-[#18181B] border border-[#27272A] p-8 my-auto">
            <View className="w-16 h-16 rounded-full bg-[#09090B] border border-[#27272A] items-center justify-center">
              <PhoneOff size={32} color="#71717A" />
            </View>
            <View className="items-center gap-1.5">
              <Text className="text-xl font-black text-white text-center">
                NO ACTIVE EMERGENCY CALL
              </Text>
              <Text className="text-xs text-zinc-400 font-medium text-center leading-relaxed max-w-sm">
                You are not currently connected to an active call. Start an emergency report to connect with emergency responders via Agora RTC.
              </Text>
            </View>
          </View>

          <View className="w-full pt-2">
            <Button
              title="RETURN TO HOME"
              variant="outline"
              size="lg"
              onPress={() => router.push('/caller/home')}
            />
          </View>
        </View>
      </View>
    );
  }

  return (
    <ScrollView contentContainerClassName="flex-grow justify-between bg-[#09090B] px-6 py-8 pb-28 items-center">
      <View className="w-full max-w-2xl flex-grow justify-between gap-6">
        {/* Top Header */}
        <View className="w-full flex-row items-center justify-between">
          <View className="flex-row items-center gap-3">
            <Logo size={36} />
            <View>
              <Text className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                AGORA RTC 1-TO-1 CALL (UID: {CALLER_UID})
              </Text>
              <Text className="text-base font-black text-white">
                Channel: {channelName}
              </Text>
            </View>
          </View>
          <ConnectionStatus status={isResponderDisconnected ? "OFFLINE" : (joined ? "LIVE" : "CONNECTING")} />
        </View>

        {/* Responder Out of Call / Disconnected Status Indicator */}
        {isResponderDisconnected ? (
          <View className="w-full flex-row items-center justify-between gap-3 rounded-2xl bg-amber-500/15 border border-amber-500/40 p-4">
            <View className="flex-1 pr-2">
              <Text className="text-xs font-black text-amber-400 uppercase tracking-wider">
                RESPONDER DISCONNECTED / OUT OF CALL
              </Text>
              <Text className="text-xs font-medium text-zinc-300 mt-0.5">
                Responder left or disconnected. You can reconnect at any time.
              </Text>
            </View>
            <Button
              title="RECONNECT"
              variant="gold"
              size="sm"
              onPress={reconnect}
            />
          </View>
        ) : null}

        {/* Agora Video & Audio Viewport */}
        <View className="w-full gap-4 my-2">
          <LiveVideoBox
            localVideoTrack={localVideoTrack}
            remoteUser={remoteUser}
            isVideoOn={isVideoOn}
            isMuted={isMuted}
            audioLevel={audioLevel}
            remoteAudioLevel={remoteAudioLevel}
            mediaError={mediaError}
            connectionState={connectionState}
            tempToken={tempToken}
            onTempTokenChange={setTempToken}
            label={activeIncident.responder_name || activeIncident.department_name || 'Emergency Responder'}
            sublabel={`${activeIncident.station_name || 'Local Station'} • Call Duration: ${formatTime(seconds)}`}
            onToggleVideo={toggleVideo}
            onToggleMute={toggleMute}
            accentColor="#38BDF8"
          />

          {/* Real-time Interactive Route Map & Geocoded Address Bar */}
          <View className="w-full gap-2">
            <Pressable
              onPress={() => router.push('/caller/map')}
              className="w-full flex-row items-center justify-between bg-sky-500/15 border border-sky-500/40 rounded-2xl p-3.5 active:scale-98"
            >
              <View className="flex-row items-center gap-3">
                <View className="p-2 rounded-xl bg-sky-500/20">
                  <Maximize2 size={16} color="#38BDF8" />
                </View>
                <View>
                  <Text className="text-xs font-black text-white uppercase">
                    EXPAND FULL SCREEN MAP TRACKING
                  </Text>
                  <Text className="text-[11px] font-medium text-sky-300">
                    Big display map with floating active call overlay
                  </Text>
                </View>
              </View>
              <ArrowRight size={16} color="#38BDF8" />
            </Pressable>

            <LiveMapView
              callerLat={activeIncident.caller_latitude || 14.5518}
              callerLng={activeIncident.caller_longitude || 121.0478}
              callerAddress={activeIncident.caller_address || activeIncident.location || 'Arthaland Century Pacific Tower, 5th Ave cor 30th St, BGC, Taguig'}
              responderLat={activeIncident.responder_latitude || 14.5540}
              responderLng={activeIncident.responder_longitude || 121.0475}
              responderAddress={activeIncident.responder_address || "St. Luke's Emergency & Trauma EMS Bay, 32nd St, BGC, Taguig"}
              departmentName={activeIncident.department_name || "St. Luke's Medical Center Global City EMS"}
              etaMinutes={activeIncident.eta_minutes || 1}
              distanceKm={activeIncident.distance_km || 0.3}
              role="CALLER"
            />
          </View>

          {/* Real-time Speech & Text Transcript Log of Both Sides */}
          <LiveCallTranscript
            incidentId={activeIncident.id}
            role="CALLER"
            senderName={activeIncident.caller_name || 'Citizen Caller'}
          />

          {/* Dynamic Incident Details Brief */}
          <View className="w-full gap-2 rounded-2xl bg-[#18181B] border border-[#27272A] p-4">
            <View className="flex-row items-center justify-between border-b border-[#27272A] pb-2">
              <Text className="text-xs font-black text-emerald-400 uppercase">
                {activeIncident.type || 'EMERGENCY'} • {activeIncident.priority || 'HIGH'} PRIORITY
              </Text>
              {Boolean(activeIncident.distance_km) ? (
                <Text className="text-xs font-bold text-amber-400">
                  {activeIncident.distance_km} km away (ETA: {activeIncident.eta_minutes || 3}m)
                </Text>
              ) : null}
            </View>
            <Text className="text-xs text-zinc-300 font-medium leading-relaxed" numberOfLines={2}>
              {activeIncident.summary || activeIncident.description || 'Emergency dispatch response active.'}
            </Text>
            <Pressable
              onPress={() => router.push('/caller/incident')}
              className="flex-row items-center justify-between pt-1 border-t border-[#27272A]/60"
            >
              <Text className="text-[11px] font-bold text-sky-400">View Full AI Incident Brief & Summary</Text>
              <ArrowRight size={13} color="#38BDF8" />
            </Pressable>
          </View>
        </View>

        {/* Call Management Controls: Continue Queuing vs Resolve */}
        <View className="w-full gap-3 pt-2">
          <Button
            title="CONTINUE QUEUING (NEED MORE HELP)"
            variant="gold"
            size="lg"
            icon={<RefreshCw size={18} color="#FFFFFF" />}
            onPress={handleContinueQueuing}
            className="w-full py-3.5 bg-amber-500 hover:bg-amber-400"
          />

          <Button
            title="EMERGENCY RESOLVED (I'M SAFE)"
            variant="danger"
            size="lg"
            icon={<CheckCircle2 size={18} color="#FFFFFF" />}
            onPress={handleResolveAndFinish}
            className="w-full py-3.5 border border-rose-500/50 bg-rose-500/20"
          />
        </View>
      </View>
    </ScrollView>
  );
}
