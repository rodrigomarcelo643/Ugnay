import React from 'react';
import { Pressable, Text, ActivityIndicator } from 'react-native';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'gold' | 'danger' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  className?: string;
  textClassName?: string;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  className = '',
  textClassName = '',
  icon,
}) => {
  let bgClasses = 'bg-blue-600 active:bg-blue-700';
  let textClasses = 'text-white font-black';

  let borderColor = '#3B82F6';
  if (variant === 'gold') {
    bgClasses = 'bg-amber-500 active:bg-amber-600';
    textClasses = 'text-zinc-950 font-black';
    borderColor = '#F59E0B';
  } else if (variant === 'secondary') {
    bgClasses = 'bg-zinc-800 active:bg-zinc-700';
    textClasses = 'text-zinc-200 font-bold';
    borderColor = '#3F3F46';
  } else if (variant === 'danger') {
    bgClasses = 'bg-rose-600 active:bg-rose-700';
    textClasses = 'text-white font-bold';
    borderColor = '#F43F5E';
  } else if (variant === 'outline') {
    bgClasses = 'bg-transparent active:bg-zinc-800/80';
    textClasses = 'text-zinc-300 font-bold';
    borderColor = '#3F3F46';
  }

  let sizeClasses = 'py-3.5 px-6 text-base rounded-2xl';
  if (size === 'sm') sizeClasses = 'py-2.5 px-4 text-sm rounded-xl';
  if (size === 'lg') sizeClasses = 'py-4 px-8 text-lg rounded-2xl';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={{
        borderWidth: 1.5,
        borderStyle: 'solid',
        borderColor: borderColor,
        overflow: 'hidden',
      }}
      className={`flex-row items-center justify-center gap-2 ${bgClasses} ${sizeClasses} ${
        disabled ? 'opacity-50' : 'active:scale-98'
      } ${className}`}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'gold' ? '#09090B' : '#FFFFFF'} />
      ) : (
        <>
          {icon}
          <Text className={`text-center ${textClasses} ${textClassName}`}>{title}</Text>
        </>
      )}
    </Pressable>
  );
};
