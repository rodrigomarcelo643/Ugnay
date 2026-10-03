import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, Animated, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { AlertTriangle, Phone, PhoneOff, MapPin, ShieldAlert, Radio, Building2 } from 'lucide-react-native';
import { ConnectionStatus } from '@/components/ui/ConnectionStatus';
import { Logo } from '@/components/ui/logo';
import { LocationDisplay } from '@/components/ui/LocationDisplay';
import { useDeviceLocation } from '@/hooks/useDeviceLocation';
import { useIncidentStore } from '@/store/incidentStore';
import { supabaseService } from '@/services/supabase';
import { useAuth } from '@/context/AuthContext';
import { AIService } from '@/services/ai';
import { soundService } from '@/services/soundService';
import { doesResponderMatchIncident, DepartmentService } from '@/services/department-service';
// Emergency Responder Incoming Call Screen
export default function ResponderIncoming() {
  const router = useRouter();
  const { user, isAvailable } = useAuth();
  const { activeIncident, setActiveIncident, acceptIncident } = useIncidentStore();
  const { locationString } = useDeviceLocation();

  // Pulse animation for call ring effect
  const [pulseAnim] = useState(new Animated.Value(1));

  // Immediate guard: If responder is toggled to unavailable, do NOT show incoming call
  useEffect(() => {
    if (!isAvailable || (user?.availability && user.availability !== 'AVAILABLE')) {
      soundService.stopRingtone();
      setActiveIncident(null);
      router.replace('/responder/home');
    }
  }, [isAvailable, user?.availability]);

  useEffect(() => {
    // Continuous pulse ring animation
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.25,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();

    return () => animation.stop();
  }, [pulseAnim]);

  // Handle call sound ringtone and 1-minute (60s) accept timeout logic
  useEffect(() => {
    if (!activeIncident || !activeIncident.id || activeIncident.status === 'RESOLVED') {
      soundService.stopRingtone();
      return;
    }

    // Play call sound ringtone with a smooth 600ms delay until accepted / rejected / timed out
    soundService.playRingtone(600);

    // 1-minute (60,000ms) background timeout to accept incoming call (no countdown UI shown)
    const timeoutTimer = setTimeout(() => {
      handleTimeoutDecline();
    }, 60000);

    return () => {
      clearTimeout(timeoutTimer);
      soundService.stopRingtone();
    };
  }, [activeIncident?.id, activeIncident?.status]);

  useEffect(() => {
    if (!isAvailable) {
      soundService.stopRingtone();
      setActiveIncident(null);
      router.replace('/responder/home');
      return;
    }

    const effectiveUser = user
      ? { ...user, availability: isAvailable ? ('AVAILABLE' as const) : ('BUSY' as const) }
      : null;

    // Sync active incident with real Supabase active dispatches strictly matching this responder's category
    const syncActiveIncident = async () => {
      const activeList = await supabaseService.fetchActiveIncidents();
      const pendingDispatch = activeList.find(
        (i) =>
          (i.status === 'DISPATCHING' || i.status === 'NEEDS_RESPONSE' || i.status === 'NEW') &&
          doesResponderMatchIncident(effectiveUser, i)
      );

      if (pendingDispatch) {
        setActiveIncident(pendingDispatch);
      } else {
        soundService.stopRingtone();
        setActiveIncident(null);
        router.replace('/responder/home');
      }
    };

    syncActiveIncident();

    // Subscribe to Realtime incident changes
    const channel = supabaseService.subscribeToIncidents((incidents) => {
      const activeList = incidents.filter((i) => i.status !== 'RESOLVED');
      const pendingDispatch = activeList.find(
        (i) =>
          (i.status === 'DISPATCHING' || i.status === 'NEEDS_RESPONSE' || i.status === 'NEW') &&
          doesResponderMatchIncident(effectiveUser, i)
      );

      if (pendingDispatch) {
        setActiveIncident(pendingDispatch);
      } else {
        soundService.stopRingtone();
        setActiveIncident(null);
        router.replace('/responder/home');
      }
    });

    return () => {
      if (channel) channel.unsubscribe();
    };
  }, [user?.department, user?.role, user?.station_name, isAvailable]);

  const handleTimeoutDecline = async () => {
    soundService.stopRingtone();
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
    setActiveIncident(null);
    AIService.speakGreeting('Incoming call missed after 1 minute. Re-routing dispatch to next unit.');
    router.push('/responder/home');
  };

  const handleAcceptCall = async () => {
    soundService.stopRingtone();
    if (activeIncident?.id) {
      const effectiveUser = user
        ? { ...user, availability: isAvailable ? ('AVAILABLE' as const) : ('BUSY' as const) }
        : null;
      if (!doesResponderMatchIncident(effectiveUser, activeIncident)) {
        router.replace('/responder/home');
        return;
      }
      const responderName = user?.name || user?.department_name || 'Emergency Responder Unit';
      await supabaseService.acceptIncident(activeIncident.id, responderName);
      acceptIncident(responderName);
      AIService.speakGreeting('Call accepted. Connecting live audio and video with caller.');
      router.push('/responder/live');
    }
  };

  const handleRejectCall = async () => {
    soundService.stopRingtone();
    if (activeIncident?.id) {
      // 1. Record this responder & department as rejected
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

      // 2. Automatically find and route to the NEXT department that has NOT rejected
      const nextDept = DepartmentService.getNextDepartment(
        activeIncident.type || activeIncident.incident_type || 'GENERAL',
        activeIncident.caller_latitude || 14.5518,
        activeIncident.caller_longitude || 121.0478,
        updatedRejected
      );

      // 3. Re-route dispatch to next department in Supabase
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
    setActiveIncident(null);
    AIService.speakGreeting('Dispatch declined. Re-routing dispatch to the next nearest unit.');
    router.push('/responder/home');
  };

  if (!activeIncident || !activeIncident.id || activeIncident.status === 'RESOLVED') {
    return (
      <View className="flex-1 items-center justify-between bg-[#09090B] px-6 py-8 pb-28">
        <View className="w-full max-w-2xl flex-1 items-center justify-between gap-6">
          <View className="w-full flex-row items-center justify-between">
            <View className="flex-row items-center gap-3">
              <Logo size={36} />
              <View>
                <Text className="text-xs font-bold uppercase tracking-wider text-rose-500">
                  INCOMING DISPATCH CALL
                </Text>
                <Text className="text-base font-black text-white">
                  Responder Line Standby
                </Text>
              </View>
            </View>
            <ConnectionStatus status="LIVE" />
          </View>

          <View className="w-full items-center justify-center gap-4 rounded-3xl bg-[#18181B] border border-[#27272A] p-8 my-auto">
            <View className="w-20 h-20 rounded-full bg-[#09090B] border border-[#27272A] items-center justify-center">
              <PhoneOff size={36} color="#71717A" />
            </View>
            <View className="items-center gap-1.5">
              <Text className="text-xl font-black text-white text-center">
                NO INCOMING CALL AT THE MOMENT
              </Text>
              <Text className="text-xs text-zinc-400 font-medium text-center leading-relaxed max-w-sm">
                Listening for emergency call dispatches from citizens. Incoming calls will ring here automatically.
              </Text>
            </View>
          </View>

          <View className="w-full pt-2">
            <Pressable
              onPress={() => router.push('/responder/home')}
              className="w-full bg-[#18181B] border border-[#27272A] rounded-2xl py-4 items-center justify-center"
            >
              <Text className="text-xs font-black text-white uppercase tracking-wider">
                RETURN TO DISPATCH DASHBOARD
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  const deptName = activeIncident.department_name || activeIncident.station_name || user?.department_name || 'Emergency Department';

  return (
    <ScrollView contentContainerClassName="flex-grow justify-between bg-[#09090B] px-6 py-8 pb-28 items-center">
      <View className="w-full max-w-2xl flex-grow justify-between gap-6">
        {/* Top Header */}
        <View className="w-full flex-row items-center justify-between">
          <View className="flex-row items-center gap-3">
            <Logo size={36} />
            <View>
              <Text className="text-xs font-bold uppercase tracking-wider text-rose-400">
                INCOMING EMERGENCY CALL
              </Text>
              <Text className="text-base font-black text-white">
                {activeIncident.id}
              </Text>
            </View>
          </View>
          <ConnectionStatus status="LIVE" />
        </View>

        {/* Incoming Call Ringing Interface */}
        <View className="w-full items-center gap-6 rounded-3xl bg-[#18181B] border-2 border-rose-500/80 p-8 shadow-2xl my-auto">
          {/* Pulsing Call Ring Avatar */}
          <Animated.View
            style={{ transform: [{ scale: pulseAnim }] }}
            className="w-28 h-28 rounded-full bg-rose-500/15 border-4 border-rose-500 items-center justify-center my-2 shadow-lg"
          >
            <View className="w-20 h-20 rounded-full bg-rose-600 items-center justify-center">
              <Phone size={42} color="#FFFFFF" />
            </View>
          </Animated.View>

          {/* Incoming Call Details */}
          <View className="items-center gap-2 text-center">
            <View className="flex-row items-center gap-2 rounded-full bg-rose-500/20 border border-rose-500/40 px-3 py-1">
              <Radio size={14} color="#F43F5E" />
              <Text className="text-xs font-black text-rose-400 uppercase tracking-widest">
                INCOMING EMERGENCY CALL...
              </Text>
            </View>

            <Text className="text-2xl font-black text-white text-center leading-tight mt-1">
              {activeIncident.type || activeIncident.incident_type || 'EMERGENCY'} ALARM
            </Text>

            <Text className="text-sm font-extrabold text-amber-400 text-center">
              Target Station: {deptName}
            </Text>
          </View>

          {/* Incident Summary Card */}
          <View className="w-full gap-2.5 rounded-2xl bg-[#09090B] border border-[#27272A] p-4">
            <View className="flex-row items-center justify-between border-b border-[#27272A] pb-2">
              <View className="flex-row items-center gap-1.5">
                <ShieldAlert size={14} color="#F43F5E" />
                <Text className="text-xs font-black text-rose-400 uppercase">
                  {activeIncident.priority || 'HIGH'} PRIORITY
                </Text>
              </View>
              {activeIncident.distance_km ? (
                <Text className="text-xs font-bold text-amber-400">
                  {activeIncident.distance_km} km away (ETA ~{activeIncident.eta_minutes || 3}m)
                </Text>
              ) : null}
            </View>

            <Text className="text-xs text-zinc-300 font-medium leading-relaxed" numberOfLines={3}>
              {activeIncident.summary || activeIncident.description || 'Emergency incident reported by citizen.'}
            </Text>
          </View>

          <LocationDisplay label={activeIncident.location || 'Reported Incident Location'} />

          {/* Accept / Reject Phone Buttons */}
          <View className="w-full flex-row items-center justify-around pt-4 border-t border-[#27272A]">
            {/* DECLINE / REJECT BUTTON (RED PHONE) */}
            <View className="items-center gap-2">
              <Pressable
                onPress={handleRejectCall}
                className="w-16 h-16 rounded-full bg-rose-600 active:bg-rose-700 items-center justify-center border-2 border-rose-400 shadow-xl"
              >
                <PhoneOff size={28} color="#FFFFFF" />
              </Pressable>
              <Text className="text-xs font-black text-rose-400 uppercase tracking-wider">
                REJECT
              </Text>
            </View>

            {/* ACCEPT / ANSWER BUTTON (GREEN PHONE) */}
            <View className="items-center gap-2">
              <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                <Pressable
                  onPress={handleAcceptCall}
                  className="w-20 h-20 rounded-full bg-emerald-500 active:bg-emerald-600 items-center justify-center border-2 border-emerald-300 shadow-2xl"
                >
                  <Phone size={34} color="#FFFFFF" />
                </Pressable>
              </Animated.View>
              <Text className="text-xs font-black text-emerald-400 uppercase tracking-wider">
                ACCEPT CALL
              </Text>
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}
