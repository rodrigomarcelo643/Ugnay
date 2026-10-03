import { Image } from 'expo-image';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { Dimensions, StyleSheet, View, Text } from 'react-native';
import Animated, { Easing, Keyframe } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

const LOGO_ASSET = require('@/assets/logo/ugnay_logo.jpg');
const DURATION = 550;

// Immediate prefetching safely on client side
if (typeof window !== 'undefined' && typeof (window as any).Image !== 'undefined') {
  try {
    Image.prefetch(LOGO_ASSET);
  } catch (e) {
    // Ignored
  }
}

export function AnimatedSplashOverlay() {
  const [animate, setAnimate] = useState(false);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    // Fallback safety timer to ensure splash overlay always dismisses cleanly
    const safetyTimer = setTimeout(() => {
      setVisible(false);
    }, 1100);
    return () => clearTimeout(safetyTimer);
  }, []);

  if (!visible) return null;

  const splashKeyframe = new Keyframe({
    0: {
      transform: [{ scale: 1 }],
      opacity: 1,
    },
    40: {
      opacity: 1,
    },
    85: {
      opacity: 0,
      easing: Easing.elastic(0.7),
    },
    100: {
      opacity: 0,
      transform: [{ scale: 0.95 }],
      easing: Easing.elastic(0.7),
    },
  });

  const splashContent = (
    <View style={styles.contentWrapper}>
      {/* Outer Glowing Aura Backdrop */}
      <View style={styles.auraGlow} />

      {/* Main High-Definition Logo Card */}
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

  return animate ? (
    <Animated.View
      pointerEvents="none"
      entering={splashKeyframe.duration(DURATION).withCallback((finished) => {
        'worklet';
        if (finished) {
          scheduleOnRN(setVisible, false);
        }
      })}
      style={styles.splashOverlay}>
      {splashContent}
    </Animated.View>
  ) : (
    <View
      pointerEvents="none"
      onLayout={() => {
        SplashScreen.hideAsync().finally(() => {
          setAnimate(true);
        });
      }}
      style={styles.splashOverlay}>
      {splashContent}
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
  contentWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  auraGlow: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(56, 189, 248, 0.22)',
  },
  logoCardWrapper: {
    padding: 3,
    borderRadius: 14,
    backgroundColor: 'rgba(56, 189, 248, 0.4)',
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 28,
    elevation: 12,
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(24, 24, 27, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginTop: 12,
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
  },
});

