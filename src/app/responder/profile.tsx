import React from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { ConnectionStatus } from '@/components/ui/ConnectionStatus';
import { Logo } from '@/components/ui/logo';
import { User, ShieldCheck, BookOpen, LogOut, AlertTriangle } from 'lucide-react-native';

export default function ResponderProfile() {
  const router = useRouter();
  const { user, isAvailable, toggleAvailability, login, logout, resetOnboarding } = useAuth();

  const handleSwitchToCaller = () => {
    login('Citizen User', 'CALLER');
    router.replace('/caller/home');
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
              <Text className="text-lg font-black text-white">RESPONDER PROFILE</Text>
            </View>
            <ConnectionStatus status="LIVE" />
          </View>

          {/* User Card */}
          <View className="w-full gap-4 rounded-3xl bg-[#18181B] border border-[#27272A] p-6 shadow-sm">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-4 flex-1">
                <View className="h-16 w-16 items-center justify-center rounded-2xl bg-sky-500/10 border border-sky-500/30">
                  <ShieldCheck size={32} color="#38BDF8" />
                </View>

                <View className="flex-1 gap-1">
                  <Text className="text-xl font-extrabold text-white">
                    {user?.name || 'Marcelo Response'}
                  </Text>
                  <Text className="text-xs font-semibold text-sky-400">
                    Barangay Response Volunteer
                  </Text>
                </View>
              </View>
            </View>

            {/* Status Toggle Button */}
            <Pressable
              onPress={toggleAvailability}
              className={`w-full flex-row items-center justify-between rounded-2xl p-4 border ${
                isAvailable
                  ? 'bg-emerald-500/10 border-emerald-500/30'
                  : 'bg-rose-500/10 border-rose-500/30'
              }`}
            >
              <View className="gap-0.5">
                <Text className="text-xs text-zinc-400 font-bold uppercase">Dispatch Status</Text>
                <Text className={`text-base font-extrabold ${isAvailable ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {isAvailable ? '🟢 AVAILABLE FOR DISPATCH' : '🔴 BUSY / ON CALL'}
                </Text>
              </View>
              <Text className="text-xs font-extrabold text-zinc-300 underline">CHANGE</Text>
            </Pressable>
          </View>

          {/* Settings & Mode Switch */}
          <View className="w-full gap-3 rounded-3xl bg-[#18181B] border border-[#27272A] p-6 shadow-sm">
            <Text className="text-xs font-bold uppercase tracking-wider text-zinc-500">
              Role & Navigation Settings
            </Text>

            <Button
              title="Switch to Citizen Mode"
              variant="outline"
              size="md"
              icon={<AlertTriangle size={18} color="#F43F5E" />}
              onPress={handleSwitchToCaller}
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
