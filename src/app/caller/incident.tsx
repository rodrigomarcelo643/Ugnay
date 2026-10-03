import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useIncidentStore } from '@/store/incidentStore';
import { AIBriefCard } from '@/components/ui/AIBriefCard';
import { Button } from '@/components/ui/button';
import { ConnectionStatus } from '@/components/ui/ConnectionStatus';
import { Logo } from '@/components/ui/logo';
import { supabaseService } from '@/services/supabase';
import { Incident } from '@/types/incident';
import {
  HelpCircle,
  ArrowRight,
  Mic,
  CheckCircle2,
  History,
  ChevronDown,
  PhoneCall,
  Route,
  Sparkles,
  ShieldCheck,
} from 'lucide-react-native';

export default function CallerIncident() {
  const router = useRouter();
  const {
    activeIncident,
    setActiveIncident,
    setIsListening,
    resolveAllMissingInfo,
  } = useIncidentStore();

  const [incidentHistory, setIncidentHistory] = useState<Incident[]>([]);
  const [showHistoryMenu, setShowHistoryMenu] = useState(false);

  useEffect(() => {
    // Fetch active incidents from Supabase DB
    supabaseService.fetchIncidents().then((incidents) => {
      setIncidentHistory(incidents);
      const activeOnly = incidents.filter((i) => i.status !== 'RESOLVED');
      if (!activeIncident && activeOnly.length > 0) {
        setActiveIncident(activeOnly[0]);
      } else if (activeIncident?.status === 'RESOLVED') {
        setActiveIncident(null);
      }
    });

    // Subscribe to realtime updates for responder acceptance
    const channel = supabaseService.subscribeToIncidents((updated) => {
      setIncidentHistory(updated);
      const currentActiveId = useIncidentStore.getState().activeIncident?.id;
      if (!currentActiveId) return;

      const current = updated.find((i) => i.id === currentActiveId);
      if (current && (current.status === 'RESPONDER_FOUND' || current.status === 'EN_ROUTE' || current.status === 'LIVE')) {
        setActiveIncident(current);
      }
    });

    return () => {
      if (channel) channel.unsubscribe();
    };
  }, []);

  if (!activeIncident) {
    return (
      <View className="flex-1 items-center justify-center bg-[#09090B] px-6">
        <Text className="text-white font-bold">No active incident</Text>
        <Button title="Go Home" onPress={() => router.push('/caller/home')} className="mt-4" />
      </View>
    );
  }

  const isAccepted =
    activeIncident.status === 'RESPONDER_FOUND' ||
    activeIncident.status === 'EN_ROUTE' ||
    activeIncident.status === 'LIVE' ||
    activeIncident.status === 'ON_SCENE';

  const handleActivateVoiceAgain = () => {
    setIsListening(true);
    router.push('/caller/voice');
  };

  const handleCompleteAll = () => {
    resolveAllMissingInfo();
    const updated = useIncidentStore.getState().activeIncident;
    if (updated) {
      supabaseService.createIncident(updated);
      if (isAccepted) {
        router.push('/caller/live');
      } else {
        router.push('/caller/waiting');
      }
    }
  };

  const hasMissingInfo = activeIncident.missing_information && activeIncident.missing_information.length > 0;

  return (
    <ScrollView contentContainerClassName="flex-grow items-center justify-between bg-[#09090B] px-6 py-8 pb-32">
      <View className="w-full max-w-2xl gap-6">
        {/* Top Header */}
        <View className="w-full flex-row items-center justify-between">
          <View className="flex-row items-center gap-3">
            <Logo size={36} />
            <View>
              <Text className="text-xs font-bold uppercase tracking-wider text-amber-400">
                INCIDENT SUMMARY & BRIEF
              </Text>
              <Text className="text-base font-black text-white">
                {activeIncident.id}
              </Text>
            </View>
          </View>
          <ConnectionStatus status={isAccepted ? 'LIVE' : 'LIVE'} />
        </View>

        {/* Previous Reported Incidents History Selector */}
        {Boolean(incidentHistory.length > 0) ? (
          <View className="w-full">
            <Pressable
              onPress={() => setShowHistoryMenu(!showHistoryMenu)}
              className="w-full flex-row items-center justify-between bg-[#18181B] border border-[#27272A] rounded-2xl px-4 py-3 active:bg-zinc-800"
            >
              <View className="flex-row items-center gap-2">
                <History size={16} color="#38BDF8" />
                <Text className="text-xs font-bold text-sky-400 uppercase tracking-wider">
                  Reported Incidents History ({incidentHistory.length})
                </Text>
              </View>
              <ChevronDown size={16} color="#A1A1AA" />
            </Pressable>

            {Boolean(showHistoryMenu) ? (
              <View className="mt-2 w-full bg-[#18181B] border border-[#27272A] rounded-2xl p-2 gap-1.5 shadow-xl z-20">
                {incidentHistory.map((inc) => (
                  <Pressable
                    key={inc.id}
                    onPress={() => {
                      setActiveIncident(inc);
                      setShowHistoryMenu(false);
                    }}
                    className={`flex-row items-center justify-between p-3 rounded-xl ${
                      inc.id === activeIncident.id ? 'bg-sky-500/15 border border-sky-500/40' : 'bg-[#09090B]'
                    }`}
                  >
                    <View className="flex-1 pr-2 gap-0.5">
                      <Text className="text-xs font-black text-white">{inc.id} • {inc.type} RESCUE</Text>
                      <Text className="text-xs text-zinc-400 font-medium" numberOfLines={1}>
                        {inc.summary || inc.description}
                      </Text>
                    </View>
                    <Text className="text-xs font-bold text-amber-400">{inc.status}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}

        {/* CALL ACCEPTED & DISPATCHED BANNER (Shown when responder has accepted) */}
        {isAccepted ? (
          <View className="w-full gap-3 rounded-3xl bg-emerald-500/15 border border-emerald-500/40 p-5 shadow-lg">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2.5">
                <View className="w-9 h-9 rounded-full bg-emerald-500/20 items-center justify-center">
                  <ShieldCheck size={20} color="#10B981" />
                </View>
                <View>
                  <Text className="text-xs font-black uppercase tracking-wider text-emerald-400">
                    CALL ACCEPTED • DISPATCH CONNECTED
                  </Text>
                  <Text className="text-sm font-black text-white">
                    {activeIncident.responder_name || activeIncident.department_name || 'Emergency Unit En Route'}
                  </Text>
                </View>
              </View>
              <View className="bg-emerald-500/20 px-3 py-1 rounded-full border border-emerald-500/40">
                <Text className="text-[10px] font-black text-emerald-300 uppercase">EN ROUTE</Text>
              </View>
            </View>

            <View className="flex-row items-center justify-between pt-1">
              <Text className="text-xs text-zinc-300">
                Unit from <Text className="font-bold text-white">{activeIncident.station_name || 'Central Command'}</Text> is en route.
              </Text>
              <Text className="text-xs font-black text-amber-400">
                ETA: ~{activeIncident.eta_minutes || 3} mins
              </Text>
            </View>

            <Button
              title="JOIN LIVE CALL WITH RESPONDER"
              variant="gold"
              size="lg"
              icon={<PhoneCall size={18} color="#09090B" />}
              onPress={() => router.push('/caller/live')}
              className="mt-2 w-full"
            />
          </View>
        ) : (
          /* Still Dispatching / Queued Banner */
          <View className="w-full flex-row items-center justify-between bg-sky-500/15 border border-sky-500/30 rounded-2xl p-4">
            <View className="flex-1 pr-3">
              <Text className="text-xs font-black uppercase tracking-wider text-sky-400">
                DISPATCH QUEUED • SEARCHING UNIT
              </Text>
              <Text className="text-xs text-zinc-300 mt-0.5">
                Route mapped from station to your location.
              </Text>
            </View>
            <Button
              title="VIEW LIVE MAP"
              variant="gold"
              size="sm"
              icon={<Route size={16} color="#09090B" />}
              onPress={() => router.push('/caller/waiting')}
            />
          </View>
        )}

        {/* AI Brief Card with Incident Summary */}
        <AIBriefCard incident={activeIncident} />

        {/* Missing Info Prompt Card — VOICE ONLY, NO TYPING */}
        {hasMissingInfo && !isAccepted ? (
          <View className="w-full gap-4 rounded-3xl bg-[#18181B] border border-amber-500/40 p-5 shadow-sm">
            <View className="flex-row items-center justify-between border-b border-[#27272A] pb-3">
              <View className="flex-row items-center gap-2">
                <HelpCircle size={18} color="#FBBF24" />
                <Text className="text-xs font-black text-amber-400 uppercase tracking-wider">
                  VOICE-ONLY EMERGENCY INTAKE
                </Text>
              </View>
              <Text className="text-xs font-bold text-amber-300">
                {activeIncident.missing_information?.length} detail(s) pending
              </Text>
            </View>

            <Text className="text-sm font-semibold text-zinc-300">
              Provide additional emergency details using voice:
            </Text>

            {/* Voice-First Action Only */}
            <Button
              title="Activate Voice to Add Details"
              variant="gold"
              size="lg"
              icon={<Mic size={20} color="#09090B" />}
              onPress={handleActivateVoiceAgain}
              className="w-full py-3.5"
            />

            {/* Quick Skip / Mark Complete without typing */}
            <Pressable
              onPress={handleCompleteAll}
              className="flex-row items-center justify-center gap-2 bg-[#09090B] border border-[#27272A] rounded-xl py-3 active:bg-zinc-800"
            >
              <CheckCircle2 size={16} color="#10B981" />
              <Text className="text-xs font-extrabold text-emerald-400">Proceed Directly to Dispatch Queue</Text>
            </Pressable>
          </View>
        ) : null}

        {/* Bottom Navigation */}
        <View className="w-full gap-3 pt-2">
          {isAccepted ? (
            <Button
              title="RETURN TO LIVE CALL"
              variant="gold"
              size="lg"
              icon={<PhoneCall size={18} color="#09090B" />}
              onPress={() => router.push('/caller/live')}
              className="w-full py-3.5"
            />
          ) : (
            <Button
              title="RETURN TO WAITING RADAR & MAP"
              variant="outline"
              size="lg"
              icon={<Route size={18} color="#38BDF8" />}
              onPress={() => router.push('/caller/waiting')}
              className="w-full py-3.5"
            />
          )}
        </View>
      </View>
    </ScrollView>
  );
}
