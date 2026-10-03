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
import { Sparkles, Check, PhoneOff, Maximize2, ArrowRight } from 'lucide-react-native';
import { Pressable } from 'react-native';
import { supabaseService } from '@/services/supabase';
import { useAuth } from '@/context/AuthContext';
import { DepartmentService } from '@/services/department-service';

export default function ResponderLiveCall() {
  const router = useRouter();
  const { user } = useAuth();
  const {
    activeIncident,
    resetIncident,
  } = useIncidentStore();

  const [tempToken, setTempToken] = useState<string>('');
  const channelName = activeIncident?.channel_name || `ugnay_emergency_${activeIncident?.id || 'demo'}`;
  const RESPONDER_UID = 2002;

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
  } = useAgoraRtc(channelName, RESPONDER_UID, tempToken);

  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (isCallEnded) {
      resetIncident();
      router.push('/responder/home');
    }
  }, [isCallEnded]);

  useEffect(() => {
    // Subscribe to realtime updates: If caller resolves or re-queues, sync call state
    const channel = supabaseService.subscribeToIncidents((incidents) => {
      const currentActiveId = useIncidentStore.getState().activeIncident?.id;
      if (!currentActiveId) return;

      const matched = incidents.find((i) => i.id === currentActiveId);

      if (!matched || matched.status === 'RESOLVED' || matched.status === 'DISPATCHING') {
        endCall();
        resetIncident();
        router.push('/responder/home');
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

  // Full Incident Resolution: Caller needs satisfied, emergency handled
  const handleResolveResponse = async () => {
    if (activeIncident?.id) {
      await supabaseService.updateIncidentStatus(activeIncident.id, 'RESOLVED');
    }
    await endCall();
    resetIncident();
    router.push('/responder/home');
  };

  // Rejection / Unable to Assist: Cut call for both sides, BUT forward to NEXT department and keep caller in dispatch queue!
  const handleRejectOrRequeueCaller = async () => {
    await endCall();
    if (activeIncident?.id) {
      const prevRejected = activeIncident.rejected_departments || [];
      const updatedRejected = Array.from(
        new Set([
          ...prevRejected,
          activeIncident.department_name,
          activeIncident.station_name,
          activeIncident.department,
          user?.department_name,
          user?.station_name,
          user?.department,
        ])
      ).filter(Boolean) as string[];

      const prevRejectedResponders = activeIncident.rejected_by_responders || [];
      const updatedRejectedResponders = Array.from(
        new Set([
          ...prevRejectedResponders,
          user?.name || user?.username || 'Responder Unit',
          user?.id,
        ])
      ).filter(Boolean) as string[];

      const nextDept = DepartmentService.getNextDepartment(
        activeIncident.type || activeIncident.incident_type || 'GENERAL',
        activeIncident.caller_latitude || 14.5518,
        activeIncident.caller_longitude || 121.0478,
        updatedRejected
      );

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
    }
    resetIncident();
    router.push('/responder/home');
  };

  const isCallerDisconnected = connectionState === 'disconnected' || connectionState === 'failed';

  if (!activeIncident || !activeIncident.id || activeIncident.status === 'RESOLVED') {
    return (
      <View className="flex-1 items-center justify-between bg-[#09090B] px-6 py-8 pb-28">
        <View className="w-full max-w-2xl flex-1 items-center justify-between gap-6">
          <View className="w-full flex-row items-center justify-between">
            <View className="flex-row items-center gap-3">
              <Logo size={36} />
              <View>
                <Text className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                  RESPONDER AGORA RTC CALL
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
                NO ACTIVE VOICE CALL
              </Text>
              <Text className="text-xs text-zinc-400 font-medium text-center leading-relaxed max-w-sm">
                No direct emergency call is currently connected. Accept an incoming dispatch alert to connect directly to the caller via Agora RTC.
              </Text>
            </View>
          </View>

          <View className="w-full pt-2">
            <Button
              title="GO TO DISPATCH MONITOR"
              variant="outline"
              size="lg"
              onPress={() => router.push('/responder/incoming')}
            />
          </View>
        </View>
      </View>
    );
  }

  return (
    <ScrollView contentContainerClassName="flex-grow justify-between bg-[#09090B] px-6 py-8 pb-28 items-center">
      <View className="w-full max-w-2xl flex-grow justify-between gap-6">
        <View className="gap-6">
          {/* Top Header */}
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-3">
              <Logo size={36} />
              <View>
                <Text className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                  RESPONDER AGORA RTC (UID: {RESPONDER_UID})
                </Text>
                <Text className="text-base font-black text-white">
                  Channel: {channelName}
                </Text>
              </View>
            </View>
            <ConnectionStatus status={isCallerDisconnected ? "OFFLINE" : (joined ? "LIVE" : "CONNECTING")} />
          </View>

          {/* Caller Out of Call Status Indicator */}
          {isCallerDisconnected ? (
            <View className="w-full flex-row items-center justify-between gap-3 rounded-2xl bg-amber-500/15 border border-amber-500/40 p-4">
              <View className="flex-1 pr-2">
                <Text className="text-xs font-black text-amber-400 uppercase tracking-wider">
                  CALLER DISCONNECTED / OUT OF CALL
                </Text>
                <Text className="text-xs font-medium text-zinc-300 mt-0.5">
                  Caller left or disconnected. You can reconnect at any time.
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

          {/* Agora Video Box */}
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
            label={activeIncident.caller_name || 'Citizen Caller Feed'}
            sublabel={`${activeIncident.location || 'Pinpoint Location Shared'} • Call Duration: ${formatTime(seconds)}`}
            onToggleVideo={toggleVideo}
            onToggleMute={toggleMute}
            accentColor="#F97316"
          />

          {/* Real-time Interactive Route Map & Geocoded Address Bar */}
          <View className="w-full gap-2">
            <Pressable
              onPress={() => router.push('/responder/map')}
              className="w-full flex-row items-center justify-between bg-emerald-500/15 border border-emerald-500/40 rounded-2xl p-3.5 active:scale-98"
            >
              <View className="flex-row items-center gap-3">
                <View className="p-2 rounded-xl bg-emerald-500/20">
                  <Maximize2 size={16} color="#10B981" />
                </View>
                <View>
                  <Text className="text-xs font-black text-white uppercase">
                    EXPAND FULL SCREEN GPS DISPATCH MAP
                  </Text>
                  <Text className="text-[11px] font-medium text-emerald-300">
                    Big display map with floating caller live video feed
                  </Text>
                </View>
              </View>
              <ArrowRight size={16} color="#10B981" />
            </Pressable>

            <LiveMapView
              callerLat={activeIncident.caller_latitude || 10.2994}
              callerLng={activeIncident.caller_longitude || 123.8890}
              callerAddress={activeIncident.caller_address || activeIncident.location || 'Katipunan Ave, Labangon, Cebu City, 6000 Cebu, Philippines'}
              responderLat={activeIncident.responder_latitude || 10.3157}
              responderLng={activeIncident.responder_longitude || 123.8854}
              responderAddress={activeIncident.responder_address || 'Cebu City DRRMO Central Command, N. Gonzales St, Cebu City'}
              departmentName={activeIncident.department_name || 'Cebu City Emergency Response Unit'}
              etaMinutes={activeIncident.eta_minutes || 3}
              distanceKm={activeIncident.distance_km || 0.9}
              role="RESPONDER"
            />
          </View>

          {/* Real-time Speech & Text Transcript Log of Both Sides */}
          <LiveCallTranscript
            incidentId={activeIncident.id}
            role="RESPONDER"
            senderName={activeIncident.responder_name || user?.name || 'Officer Marcelo Santos'}
            otherPartyName={activeIncident.caller_name || 'Citizen Caller'}
            departmentName={activeIncident.department_name || activeIncident.station_name || user?.department_name || 'Emergency Response Unit'}
            incidentType={activeIncident.type || 'EMERGENCY'}
            location={activeIncident.caller_address || activeIncident.location}
            initialReport={activeIncident.speech_transcript || activeIncident.description || activeIncident.summary}
          />

          {/* Real-time AI Updates During Call */}
          <View className="gap-3 rounded-3xl bg-[#18181B] border border-sky-500/30 p-5 shadow-sm">
            <View className="flex-row items-center gap-2">
              <Sparkles size={20} color="#38BDF8" />
              <Text className="text-xs font-black uppercase tracking-wider text-sky-400">
                AI REAL-TIME ASSISTANT
              </Text>
            </View>

            <View className="gap-2 rounded-2xl bg-[#09090B] p-4 border border-[#27272A]">
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-1.5">
                  <Check size={16} color="#10B981" />
                  <Text className="text-xs font-black text-emerald-400 uppercase">
                    Assigned Station & Location
                  </Text>
                </View>
                {Boolean(activeIncident?.distance_km || activeIncident?.eta_minutes) ? (
                  <Text className="text-xs font-bold text-sky-400">
                    {activeIncident?.distance_km ? `${activeIncident.distance_km} km` : ''} {activeIncident?.eta_minutes ? `(ETA: ${activeIncident.eta_minutes}m)` : ''}
                  </Text>
                ) : null}
              </View>
              <Text className="text-sm font-extrabold text-white">
                {activeIncident?.department_name || activeIncident?.station_name || 'Emergency Unit'}
              </Text>
              <Text className="text-xs text-zinc-400 font-medium">
                {activeIncident?.station_name || 'Station Unit'} • {activeIncident?.location || 'Caller Location'}
              </Text>
            </View>

            <View className="gap-1 pt-1">
              <Text className="text-xs font-extrabold text-zinc-500 uppercase tracking-wider">
                Live Summary Brief
              </Text>
              <Text className="text-xs text-zinc-300 leading-relaxed font-medium">
                {activeIncident?.summary || activeIncident?.description || activeIncident?.transcript || 'Emergency incident in progress.'}
              </Text>
            </View>
          </View>
        </View>

        {/* End Response Controls */}
        <View className="w-full gap-3 pt-4">
          <Button
            title="RESOLVE & END INCIDENT RESPONSE"
            variant="primary"
            size="lg"
            icon={<Check size={20} color="#FFFFFF" />}
            onPress={handleResolveResponse}
            className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500"
          />

          <Button
            title="REJECT / RE-QUEUE CALLER (CANNOT ASSIST)"
            variant="danger"
            size="lg"
            icon={<PhoneOff size={20} color="#FFFFFF" />}
            onPress={handleRejectOrRequeueCaller}
            className="w-full py-3.5 border border-rose-500/50 bg-rose-500/20"
          />
        </View>
      </View>
    </ScrollView>
  );
}
