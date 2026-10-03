import React from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { AlertTriangle } from 'lucide-react-native';

interface RoutingLoadingModalProps {
  visible: boolean;
  departmentName?: string;
  onSendNow?: () => void;
  onCancel?: () => void;
}

export const RoutingLoadingModal: React.FC<RoutingLoadingModalProps> = ({
  visible,
  departmentName,
  onSendNow,
  onCancel,
}) => {
  if (!visible) return null;

  return (
    <View className="absolute inset-0 bg-black/80 backdrop-blur-md items-center justify-center p-6 z-50">
      <View className="w-full max-w-sm rounded-3xl bg-[#18181B] border border-[#27272A] p-6 items-center gap-6 shadow-2xl">
        {/* Header Alert Label */}
        <View className="flex-row items-center gap-2">
          <AlertTriangle size={18} color="#F43F5E" />
          <Text className="text-sm font-black text-rose-500 uppercase tracking-widest">
            Emergency
          </Text>
        </View>

        {/* Title Text requested by user */}
        <View className="items-center gap-1">
          <Text className="text-lg font-black text-white text-center leading-snug">
            Routing nearest available department...
          </Text>
          {Boolean(departmentName) ? (
            <Text className="text-xs font-bold text-sky-400 text-center">
              Target: {departmentName}
            </Text>
          ) : null}
        </View>

        {/* Circular Loading Ring Spinner without number counting */}
        <View className="items-center justify-center my-2">
          <View className="w-24 h-24 rounded-full border-4 border-[#27272A] border-t-rose-500 border-r-rose-500 items-center justify-center animate-spin">
            <ActivityIndicator size="large" color="#F43F5E" />
          </View>
        </View>

        {/* Action Buttons */}
        <View className="w-full gap-3">
          <Pressable
            onPress={onSendNow}
            className="w-full bg-rose-500 rounded-2xl py-3.5 items-center active:bg-rose-600 shadow-lg"
          >
            <Text className="text-base font-black text-white">Send now</Text>
          </Pressable>

          <Pressable
            onPress={onCancel}
            className="w-full py-2 items-center"
          >
            <Text className="text-sm font-bold text-zinc-400">Cancel</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
};
