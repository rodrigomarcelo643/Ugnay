import React, { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { OnboardingView } from '@/components/onboarding/OnboardingView';

export default function LandingScreen() {
  const router = useRouter();
  const { role, isLoggedIn } = useAuth();

  useEffect(() => {
    if (isLoggedIn) {
      if (role === 'CALLER') {
        router.replace('/caller/home');
      } else if (role === 'RESPONDER') {
        router.replace('/responder/home');
      }
    }
  }, [isLoggedIn, role]);

  // Unauthenticated users opening the app ALWAYS see the onboarding instructions first
  if (!isLoggedIn) {
    return <OnboardingView />;
  }

  return null;
}
