import React, { useEffect, useState } from 'react';
import { Image } from 'expo-image';
import { StyleSheet, View, Text } from 'react-native';

const LOGO_ASSET = require('@/assets/logo/ugnay_logo.jpg');

// Pre-register and pre-decode image at client module load for ZERO delay on refresh
if (typeof window !== 'undefined' && typeof (window as any).Image !== 'undefined') {
  try {
    Image.prefetch(LOGO_ASSET);
    const webPreload = new (window as any).Image();
    webPreload.src = typeof LOGO_ASSET === 'string' ? LOGO_ASSET : (LOGO_ASSET.default || LOGO_ASSET);
  } catch (e) {
    // Ignored in SSR
  }
}

export function AnimatedSplashOverlay() {
  const [visible, setVisible] = useState(true);
  const [opacity, setOpacity] = useState(1);

  useEffect(() => {
    // Fast, responsive splash overlay display
    const fadeTimer = setTimeout(() => {
      setOpacity(0);
    }, 600);

    const hideTimer = setTimeout(() => {
      setVisible(false);
    }, 900);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <View
      style={[styles.splashOverlay, { opacity }]}
      pointerEvents="none"
    >
      {/* Outer Glowing Cyan Ambient Aura Backdrop */}
      <View style={styles.auraGlow} />

      {/* Ultra High-Definition Logo Card */}
      <View style={styles.logoCardWrapper}>
        <View style={styles.logoCard}>
          <Image
            style={styles.logoImage}
            source={LOGO_ASSET}
            priority="high"
            transition={0}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        </View>
      </View>

      {/* Brand Typography & Tagline */}
      <View style={styles.textColumn}>
        <Text style={styles.brandTitle}>UGNAY</Text>
        <View style={styles.taglineBadge}>
          <Text style={styles.brandSubtitle}>SPEAK • CONNECT • RESPOND</Text>
        </View>
      </View>

      {/* System Status Loading Pill */}
      <View style={styles.statusPill}>
        <View style={styles.statusDot} />
        <Text style={styles.statusText}>EMERGENCY DISPATCH ENGINE • ONLINE</Text>
      </View>
    </View>
  );
}

export function AnimatedIcon() {
  return (
    <View style={styles.iconContainer}>
      <View style={styles.logoCardSmall}>
        <Image
          style={styles.logoImageSmall}
          source={LOGO_ASSET}
          priority="high"
          transition={0}
          contentFit="cover"
          cachePolicy="memory-disk"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  splashOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#09090B',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 99999,
    gap: 24,
    transitionProperty: 'opacity',
    transitionDuration: '300ms',
  },
  auraGlow: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(56, 189, 248, 0.22)',
    filter: 'blur(40px)',
  },
  logoCardWrapper: {
    padding: 3,
    borderRadius: 14,
    backgroundColor: 'linear-gradient(135deg, rgba(56, 189, 248, 0.8), rgba(14, 165, 233, 0.2))',
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 28,
  },
  logoCard: {
    width: 130,
    height: 130,
    borderRadius: 12,
    backgroundColor: '#09090B',
    borderWidth: 2,
    borderColor: '#38BDF8',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logoImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  textColumn: {
    alignItems: 'center',
    gap: 10,
  },
  brandTitle: {
    fontSize: 42,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 8,
    textShadowColor: 'rgba(56, 189, 248, 0.4)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 12,
  },
  taglineBadge: {
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.35)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 5,
  },
  brandSubtitle: {
    fontSize: 11,
    fontWeight: '900',
    color: '#38BDF8',
    letterSpacing: 2.5,
    textTransform: 'uppercase',
  },
  statusPill: {
    position: 'absolute',
    bottom: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(24, 24, 27, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#10B981',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#A1A1AA',
    letterSpacing: 0.8,
  },
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 90,
    height: 90,
  },
  logoCardSmall: {
    width: 80,
    height: 80,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#38BDF8',
    backgroundColor: '#09090B',
  },
  logoImageSmall: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
});

