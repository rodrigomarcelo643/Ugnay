import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { ConnectionStatus } from '@/components/ui/ConnectionStatus';
import { Logo } from '@/components/ui/logo';
import { User, Shield, BookOpen, LogOut } from 'lucide-react-native';

export default function CallerProfile() {
  const router = useRouter();
  const { user, login, logout, resetOnboarding } = useAuth();

  const handleSwitchToResponder = () => {
    login('Marcelo Responder', 'RESPONDER');
    router.replace('/responder/home');
  };

  const handleLogout = () => {
    logout();
    router.replace('/');
  };

  const handleReviewInstructions = () => {
    resetOnboarding();
    router.replace('/');
  };

  return (
    <ScrollView contentContainerClassName="flex-grow justify-between bg-[#09090B] px-6 py-8 pb-28 items-center">
      <View className="w-full max-w-2xl flex-grow justify-between gap-6">
        <View className="gap-6">
          {/* Top Header */}
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-3">
              <Logo size={36} />
              <Text className="text-lg font-black text-white">UGNAY PROFILE</Text>
            </View>
            <ConnectionStatus status="LIVE" />
          </View>

          {/* User Card */}
          <View className="w-full gap-4 rounded-3xl bg-[#18181B] border border-[#27272A] p-6 shadow-sm">
            <View className="flex-row items-center gap-4">
              <View className="h-16 w-16 items-center justify-center rounded-2xl bg-rose-500/10 border border-rose-500/30">
                <User size={32} color="#F43F5E" />
              </View>

              <View className="flex-1 gap-1">
                <Text className="text-xl font-extrabold text-white">
                  {user?.name || 'Citizen User'}
                </Text>
                <View className="flex-row items-center gap-2">
                  <View className="rounded-full bg-rose-500/15 px-3 py-0.5 border border-rose-500/40">
                    <Text className="text-xs font-bold text-rose-400">CALLER MODE</Text>
                  </View>
                  <Text className="text-xs text-zinc-500">• Registered</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Settings & Mode Switch */}
          <View className="w-full gap-3 rounded-3xl bg-[#18181B] border border-[#27272A] p-6 shadow-sm">
            <Text className="text-xs font-bold uppercase tracking-wider text-zinc-500">
              Role & Navigation Settings
            </Text>

            <Button
              title="Switch to Responder Mode"
              variant="outline"
              size="md"
              icon={<Shield size={18} color="#38BDF8" />}
              onPress={handleSwitchToResponder}
            />

            <Button
              title="Re-open Onboarding Instructions"
              variant="secondary"
              size="md"
              icon={<BookOpen size={18} color="#A1A1AA" />}
              onPress={handleReviewInstructions}
            />
          </View>
        </View>

        {/* Logout Action */}
        <View className="w-full gap-3 pt-6">
          <Button
            title="LOG OUT (RETURN TO PUBLIC)"
            variant="danger"
            size="lg"
            icon={<LogOut size={20} color="#FFFFFF" />}
            onPress={handleLogout}
          />
          <Text className="text-center text-xs text-zinc-500 font-medium">
            Logging out returns app to Public state with no tab bar.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}
