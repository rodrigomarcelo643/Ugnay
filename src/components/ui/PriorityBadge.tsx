import React from 'react';
import { View, Text } from 'react-native';
import { Priority } from '@/types/incident';

interface PriorityBadgeProps {
  priority: Priority;
  size?: 'sm' | 'md';
}

export const PriorityBadge: React.FC<PriorityBadgeProps> = ({ priority, size = 'md' }) => {
  let bgClasses = 'bg-rose-50 border-rose-200 text-rose-700';
  let dotColor = 'bg-rose-600';

  if (priority === 'MEDIUM') {
    bgClasses = 'bg-amber-50 border-amber-200 text-amber-700';
    dotColor = 'bg-amber-600';
  } else if (priority === 'LOW') {
    bgClasses = 'bg-emerald-50 border-emerald-200 text-emerald-700';
    dotColor = 'bg-emerald-600';
  }

  const paddingClasses = size === 'sm' ? 'px-2.5 py-0.5 text-xs' : 'px-3.5 py-1 text-xs';

  return (
    <View className={`flex-row items-center gap-1.5 rounded-full border ${paddingClasses} ${bgClasses}`}>
      <View className={`h-2 w-2 rounded-full ${dotColor}`} />
      <Text className="font-extrabold tracking-wider uppercase">{priority} PRIORITY</Text>
    </View>
  );
};
