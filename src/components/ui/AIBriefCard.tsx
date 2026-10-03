import React from 'react';
import { View, Text } from 'react-native';
import { Incident } from '@/types/incident';
import { PriorityBadge } from './PriorityBadge';
import { Sparkles, Check, HelpCircle } from 'lucide-react-native';

import { sanitizeTranscript } from '@/services/ai';

interface AIBriefCardProps {
  incident: Incident;
}

export const AIBriefCard: React.FC<AIBriefCardProps> = ({ incident }) => {
  const cleanedKnownFacts = (incident.known_facts || [])
    .map((fact) => sanitizeTranscript(fact))
    .filter((fact) => fact.length > 0);

  return (
    <View className="w-full gap-4 rounded-3xl bg-[#18181B] border border-[#27272A] p-5 shadow-sm">
      <View className="flex-row items-center justify-between border-b border-[#27272A] pb-3">
        <View className="flex-row items-center gap-1.5">
          <Sparkles size={16} color="#FBBF24" />
          <Text className="text-xs font-black uppercase tracking-wider text-amber-400">
            AI INCIDENT BRIEF
          </Text>
        </View>
        <PriorityBadge priority={incident.priority} size="sm" />
      </View>

      <View className="gap-1.5">
        <Text className="text-2xl font-black text-white">
          {incident.type} RESCUE
        </Text>
        <Text className="text-sm leading-relaxed text-zinc-400 font-medium">
          {incident.description}
        </Text>
      </View>

      {/* Matched Nearest Department Dispatch Banner */}
      <View className="rounded-2xl bg-sky-500/10 border border-sky-500/30 p-3.5 gap-1">
        <View className="flex-row items-center justify-between">
          <Text className="text-xs font-black uppercase tracking-wider text-sky-400">
            MATCHED NEAREST DEPARTMENT
          </Text>
          <Text className="text-xs font-extrabold text-emerald-400">
            {incident.distance_km ? `${incident.distance_km} km away` : 'Nearest Station'}
          </Text>
        </View>
        <Text className="text-sm font-black text-white">
          {incident.department_name || 'Emergency Response Department'}
        </Text>
        <View className="flex-row items-center justify-between pt-0.5">
          <Text className="text-xs font-semibold text-zinc-400">
            {incident.station_name || 'Nearest Local Station'}
          </Text>
          <Text className="text-xs font-extrabold text-amber-400">
            ETA: {incident.eta_minutes || 3} mins
          </Text>
        </View>
      </View>

      {/* Grid Summary Tags */}
      <View className="flex-row flex-wrap gap-2 pt-1">
        <View className="rounded-xl bg-[#09090B] px-3 py-1.5 border border-[#27272A]">
          <Text className="text-xs text-sky-400 font-medium">
            Person: <Text className="text-white font-bold">{incident.person && incident.person !== 'null' ? incident.person : 'Unspecified'}</Text>
          </Text>
        </View>
        <View className="rounded-xl bg-[#09090B] px-3 py-1.5 border border-[#27272A]">
          <Text className="text-xs text-sky-400 font-medium">
            Situation: <Text className="text-white font-bold">{incident.situation && incident.situation !== 'null' ? incident.situation : 'Emergency reported via voice interface'}</Text>
          </Text>
        </View>
        {Boolean(incident.floor && incident.floor !== 'null' && incident.floor !== 'undefined') ? (
          <View className="rounded-xl bg-[#09090B] px-3 py-1.5 border border-[#27272A]">
            <Text className="text-xs text-sky-400 font-medium">Floor: <Text className="text-white font-bold">{incident.floor}</Text></Text>
          </View>
        ) : null}
        {Boolean(incident.location && incident.location !== 'null' && incident.location !== 'undefined') ? (
          <View className="w-full max-w-full rounded-xl bg-[#09090B] px-3 py-2 border border-[#27272A]">
            <Text className="text-xs text-sky-400 font-medium leading-relaxed">
              Location: <Text className="text-white font-bold">{incident.location}</Text>
            </Text>
          </View>
        ) : null}
      </View>

      {/* Known vs Missing Info */}
      <View className="gap-3 pt-3 border-t border-[#27272A]">
        {Boolean(cleanedKnownFacts.length > 0) ? (
          <View className="gap-2">
            <Text className="text-xs font-black text-emerald-400 uppercase tracking-wider">
              WHAT WE KNOW
            </Text>
            {cleanedKnownFacts.map((fact, idx) => (
              <View key={idx} className="flex-row items-start gap-2 pl-1 pr-2">
                <Check size={14} color="#10B981" style={{ marginTop: 2 }} />
                <Text className="flex-1 text-xs text-zinc-300 font-semibold leading-relaxed">{fact}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {Boolean(incident.missing_information && incident.missing_information.length > 0) ? (
          <View className="gap-2 pt-1">
            <Text className="text-xs font-black text-amber-400 uppercase tracking-wider">
              STILL NEEDED
            </Text>
            {incident.missing_information?.map((info, idx) => (
              <View key={idx} className="flex-row items-start gap-2 pl-1 pr-2">
                <HelpCircle size={14} color="#FBBF24" style={{ marginTop: 2 }} />
                <Text className="flex-1 text-xs text-amber-300 font-semibold leading-relaxed">{info}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
};
