import React from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { useDeviceLocation } from '@/hooks/useDeviceLocation';
import { MapPin, RefreshCw, Navigation, AlertCircle } from 'lucide-react-native';
import { AnimatedCallerPingIcon } from './AnimatedCallerPingIcon';

interface LocationDisplayProps {
  label?: string;
  className?: string;
}

export const LocationDisplay: React.FC<LocationDisplayProps> = ({
  label = 'Device Location',
  className = '',
}) => {
  const { locationString, addressString, status, refetch } = useDeviceLocation();

  if (status === 'detecting') {
    return (
      <View className={`w-full flex-row items-center justify-between rounded-2xl bg-[#09090B] border border-sky-500/40 p-3 ${className}`}>
        <View className="flex-row items-center gap-2.5">
          <ActivityIndicator size="small" color="#38BDF8" />
          <View className="gap-0.5">
            <Text className="text-[10px] font-black uppercase tracking-wider text-sky-400">
              ACQUIRING REAL-TIME GPS & ADDRESS
            </Text>
            <Text className="text-xs font-bold text-white animate-pulse">
              Locating device street address...
            </Text>
          </View>
        </View>
      </View>
    );
  }

  if (status === 'denied' || status === 'error') {
    return (
      <View className={`w-full flex-row items-center justify-between rounded-2xl bg-[#09090B] border border-amber-500/40 p-3 ${className}`}>
        <View className="flex-row items-center gap-2">
          <AlertCircle size={16} color="#FBBF24" />
          <View className="gap-0.5">
            <Text className="text-[10px] font-black uppercase tracking-wider text-amber-400">
              GPS STATUS
            </Text>
            <Text className="text-xs font-bold text-white">{addressString}</Text>
          </View>
        </View>

        <Pressable
          onPress={refetch}
          className="bg-amber-500/15 border border-amber-500/30 rounded-xl px-2.5 py-1.5 active:opacity-80"
        >
          <Text className="text-xs font-bold text-amber-400">RETRY GPS</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className={`w-full flex-row items-center justify-between rounded-2xl bg-[#09090B] border border-[#27272A] p-3.5 ${className}`}>
      <View className="flex-row items-center gap-3 flex-1 pr-2">
        <AnimatedCallerPingIcon size={18} color="#38BDF8" />
        <View className="flex-1 gap-1">
          <Text className="text-[10px] font-black uppercase tracking-wider text-sky-400">
            {label}
          </Text>
          <Text className="text-xs font-black text-white leading-snug" numberOfLines={2}>
            {addressString}
          </Text>
          <Text className="text-[10px] font-bold text-zinc-400">
            {locationString}
          </Text>
        </View>
      </View>

      <Pressable
        onPress={refetch}
        className="p-2 rounded-xl bg-[#18181B] border border-[#27272A] active:opacity-80 my-auto"
      >
        <RefreshCw size={14} color="#94A3B8" />
      </Pressable>
    </View>
  );
};
