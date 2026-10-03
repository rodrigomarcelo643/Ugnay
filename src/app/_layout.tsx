import { Buffer } from 'buffer';
import "../global.css";

// Configure NativeWind / react-native-css-interop dark mode to class-based
try {
  const { StyleSheet: interopStyleSheet } = require('react-native-css-interop');
  if (interopStyleSheet && typeof interopStyleSheet.setFlag === 'function') {
    interopStyleSheet.setFlag('darkMode', 'class');
  }
} catch (e) {}

function polyfillUtilInherits(target: any) {
  if (!target) return;
  if (!target.util) target.util = {};
  if (typeof target.util.inherits !== 'function') {
    target.util.inherits = function (ctor: any, superCtor: any) {
      if (superCtor) {
        ctor.super_ = superCtor;
        Object.setPrototypeOf(ctor.prototype, superCtor.prototype);
      }
    };
  }
}

if (typeof globalThis !== 'undefined') {
  const g = globalThis as any;
  if (!g.process) g.process = {};
  if (!g.process.version) g.process.version = 'v18.0.0';
  if (g.process.browser === undefined) g.process.browser = true;
  g.Buffer = g.Buffer || Buffer;
  polyfillUtilInherits(g);
}
if (typeof window !== 'undefined') {
  const w = window as any;
  if (!w.process) w.process = {};
  if (!w.process.version) w.process.version = 'v18.0.0';
  if (w.process.browser === undefined) w.process.browser = true;
  w.Buffer = w.Buffer || Buffer;
  polyfillUtilInherits(w);
}

import { DarkTheme, Slot, ThemeProvider, usePathname, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { AuthProvider, useAuth } from '@/context/AuthContext';

SplashScreen.preventAutoHideAsync();

import { supabaseService } from '@/services/supabase';
import { useIncidentStore } from '@/store/incidentStore';

function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isLoggedIn, isLoading, role } = useAuth();
  const { activeIncident, setActiveIncident } = useIncidentStore();

  useEffect(() => {
    // Do not redirect to login while session loading is in progress!
    if (isLoading) return;

    const isProtectedRoute = pathname.startsWith('/caller') || pathname.startsWith('/responder');
    if (isProtectedRoute && !isLoggedIn) {
      router.replace('/login');
    }
  }, [pathname, isLoggedIn, isLoading]);

  const pathnameRef = React.useRef(pathname);
  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    if (role !== 'CALLER') return;

    const channel = supabaseService.subscribeToIncidents((incidents) => {
      const currentActiveId = useIncidentStore.getState().activeIncident?.id;
      if (!currentActiveId) return;

      const matched = incidents.find(
        (inc) => inc.id === currentActiveId && (inc.status === 'RESPONDER_FOUND' || inc.status === 'EN_ROUTE')
      );

      if (matched) {
        setActiveIncident(matched);
        if (!pathnameRef.current.includes('/caller/live')) {
          router.replace('/caller/live');
        }
      }
    });

    return () => {
      if (channel) channel.unsubscribe();
    };
  }, [role]);

  return <>{children}</>;
}

import { CallProvider } from '@/providers/CallProvider';

function RouteTitleUpdater() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const getTitle = (path: string) => {
      switch (path) {
        case '/':
          return 'UGNAY | Emergency Dispatch Engine';
        case '/login':
          return 'UGNAY | Login';
        case '/explore':
          return 'UGNAY | System Overview & Explore';
        case '/caller/home':
          return 'UGNAY | Caller Emergency Hub';
        case '/caller/voice':
          return 'UGNAY | AI Emergency Voice Assistant';
        case '/caller/analyzing':
          return 'UGNAY | Analyzing Emergency Signal';
        case '/caller/incident':
          return 'UGNAY | Incident Report & Summary';
        case '/caller/waiting':
          return 'UGNAY | Connecting to First Responder';
        case '/caller/map':
          return 'UGNAY | Live Emergency GPS Map';
        case '/caller/live':
          return 'UGNAY | Live Video Call';
        case '/caller/profile':
          return 'UGNAY | Caller Profile & Settings';
        case '/responder/home':
          return 'UGNAY | Responder Command Center';
        case '/responder/incoming':
          return 'UGNAY | Incoming Emergency Alert';
        case '/responder/map':
          return 'UGNAY | Response Navigation Map';
        case '/responder/live':
          return 'UGNAY | Live Responder Video Stream';
        case '/responder/profile':
          return 'UGNAY | Responder Profile & Unit Status';
        default: {
          const parts = path.split('/').filter(Boolean);
          if (parts.length === 0) return 'UGNAY | Emergency Dispatch Engine';
          const formatted = parts
            .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
            .join(' - ');
          return `UGNAY | ${formatted}`;
        }
      }
    };

    document.title = getTitle(pathname);

    // Dynamically set browser tab favicon to the actual UGNAY logo
    try {
      let link: HTMLLinkElement | null = document.querySelector("link[rel*='icon']");
      if (!link) {
        link = document.createElement('link');
        link.rel = 'shortcut icon';
        document.getElementsByTagName('head')[0].appendChild(link);
      }
      const logoAsset = require('@/assets/logo/ugnay_logo.jpg');
      const logoUri = typeof logoAsset === 'string' ? logoAsset : (logoAsset.default || logoAsset);
      if (logoUri && link.href !== logoUri) {
        link.href = logoUri;
      }
    } catch (e) {
      // Ignored
    }
  }, [pathname]);

  return null;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <ThemeProvider value={DarkTheme}>
        <CallProvider>
          <View style={styles.container}>
            <RouteTitleUpdater />
            <AnimatedSplashOverlay />
            <AuthGuard>
              <Slot />
            </AuthGuard>
            <AppTabs />
          </View>
        </CallProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090B',
  },
});
