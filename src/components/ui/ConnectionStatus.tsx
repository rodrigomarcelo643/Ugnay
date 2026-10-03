import React from 'react';
import { View, Text } from 'react-native';

export type ConnectionState = 'LIVE' | 'WEAK' | 'BURST' | 'OFFLINE' | 'CONNECTING';

interface ConnectionStatusProps {
  status?: ConnectionState;
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({ status = 'LIVE' }) => {
  let label = 'LIVE VOICE';
  let dotColor = 'bg-emerald-500';
  let badgeBg = 'bg-emerald-50 border-emerald-200 text-emerald-800';

  if (status === 'CONNECTING') {
    label = 'CONNECTING...';
    dotColor = 'bg-sky-500';
    badgeBg = 'bg-sky-50 border-sky-200 text-sky-800';
  } else if (status === 'WEAK') {
    label = 'CONNECTION WEAK';
    dotColor = 'bg-amber-500';
    badgeBg = 'bg-amber-50 border-amber-200 text-amber-800';
  } else if (status === 'BURST') {
    label = 'VOICE BURST MODE';
    dotColor = 'bg-orange-500';
    badgeBg = 'bg-orange-50 border-orange-200 text-orange-800';
  } else if (status === 'OFFLINE') {
    label = 'OFFLINE MODE';
    dotColor = 'bg-rose-500';
    badgeBg = 'bg-rose-50 border-rose-200 text-rose-800';
  }

  return (
    <View className={`flex-row items-center gap-2 rounded-full border px-3.5 py-1 ${badgeBg}`}>
      <View className={`h-2.5 w-2.5 rounded-full ${dotColor}`} />
      <Text className="text-xs font-bold tracking-wide">{label}</Text>
    </View>
  );
};
