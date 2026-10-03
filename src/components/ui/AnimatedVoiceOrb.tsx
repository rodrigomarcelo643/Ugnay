import React, { useEffect, useRef } from 'react';
import { View, Animated, Easing, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';

const DEFAULT_AVATAR_GIF = require('@/assets/ai_avatar/ugnay_ai.gif');

// Pre-fetch avatar asset safely on client
if (typeof window !== 'undefined' && typeof (window as any).Image !== 'undefined') {
  try {
    Image.prefetch(DEFAULT_AVATAR_GIF);
  } catch (e) {}
}

interface AnimatedVoiceOrbProps {
  onPress?: () => void;
  size?: number;
  ringColor?: string;
  accentColor?: string;
  icon?: React.ReactNode;
  useAvatar?: boolean;
  audioLevel?: number;
  isListening?: boolean;
}

export const AnimatedVoiceOrb: React.FC<AnimatedVoiceOrbProps> = ({
  onPress,
  size = 140,
  ringColor = '#38BDF8',
  accentColor = '#FFFFFF',
  icon,
  useAvatar = false,
  audioLevel = 0,
  isListening = false,
}) => {
  const wave1 = useRef(new Animated.Value(0)).current;
  const wave2 = useRef(new Animated.Value(0)).current;
  const bar1 = useRef(new Animated.Value(0)).current;
  const bar2 = useRef(new Animated.Value(0)).current;
  const bar3 = useRef(new Animated.Value(0)).current;
  const bar4 = useRef(new Animated.Value(0)).current;
  const bar5 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Wave 1 pulse loop
    const loopWave1 = Animated.loop(
      Animated.timing(wave1, {
        toValue: 1,
        duration: 2200,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      })
    );

    // Wave 2 pulse loop (staggered delay)
    let loopWave2: Animated.CompositeAnimation;
    const wave2Timeout = setTimeout(() => {
      loopWave2 = Animated.loop(
        Animated.timing(wave2, {
          toValue: 1,
          duration: 2200,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        })
      );
      loopWave2.start();
    }, 1100);

    // Equalizer bars wave animation loop
    const createBarLoop = (anim: Animated.Value, delay: number, duration: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.timing(anim, {
            toValue: 1,
            duration,
            delay,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: false,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: false,
          }),
        ])
      );
    };

    const b1 = createBarLoop(bar1, 0, 400);
    const b2 = createBarLoop(bar2, 120, 320);
    const b3 = createBarLoop(bar3, 240, 480);
    const b4 = createBarLoop(bar4, 80, 360);
    const b5 = createBarLoop(bar5, 180, 420);

    loopWave1.start();
    b1.start();
    b2.start();
    b3.start();
    b4.start();
    b5.start();

    return () => {
      loopWave1.stop();
      if (loopWave2) loopWave2.stop();
      clearTimeout(wave2Timeout);
      b1.stop();
      b2.stop();
      b3.stop();
      b4.stop();
      b5.stop();
    };
  }, []);

  // Wave 1 scale and opacity (strictly concentric)
  const scale1 = wave1.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.35],
  });
  const opacity1 = wave1.interpolate({
    inputRange: [0, 0.4, 0.8, 1],
    outputRange: [0.65, 0.35, 0.1, 0],
  });

  // Wave 2 scale and opacity (strictly concentric)
  const scale2 = wave2.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.35],
  });
  const opacity2 = wave2.interpolate({
    inputRange: [0, 0.4, 0.8, 1],
    outputRange: [0.65, 0.35, 0.1, 0],
  });

  // Equalizer bar heights scaled with live audio level
  const soundMultiplier = audioLevel > 0 ? Math.min(2.2, 1 + audioLevel / 40) : 1;
  const h1 = bar1.interpolate({ inputRange: [0, 1], outputRange: [8 * soundMultiplier, 30 * soundMultiplier] });
  const h2 = bar2.interpolate({ inputRange: [0, 1], outputRange: [14 * soundMultiplier, 46 * soundMultiplier] });
  const h3 = bar3.interpolate({ inputRange: [0, 1], outputRange: [18 * soundMultiplier, 56 * soundMultiplier] });
  const h4 = bar4.interpolate({ inputRange: [0, 1], outputRange: [12 * soundMultiplier, 42 * soundMultiplier] });
  const h5 = bar5.interpolate({ inputRange: [0, 1], outputRange: [6 * soundMultiplier, 26 * soundMultiplier] });

  const effectiveRingColor = audioLevel > 15 ? '#38BDF8' : isListening ? '#0284C7' : ringColor;

  const orbRadius = size / 2;
  const innerSize = size - 16;
  const innerRadius = innerSize / 2;

  return (
    <View style={[styles.outerWrapper, { width: size * 1.45, height: size * 1.45 }]}>
      {/* Concentric Wave Ring 1 */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.waveRing,
          {
            width: size,
            height: size,
            borderRadius: orbRadius,
            borderColor: effectiveRingColor,
            backgroundColor: `${effectiveRingColor}10`,
            transform: [{ scale: scale1 }],
            opacity: opacity1,
          },
        ]}
      />

      {/* Concentric Wave Ring 2 */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.waveRing,
          {
            width: size,
            height: size,
            borderRadius: orbRadius,
            borderColor: effectiveRingColor,
            backgroundColor: `${effectiveRingColor}10`,
            transform: [{ scale: scale2 }],
            opacity: opacity2,
          },
        ]}
      />

      {/* Main Center Orb Button */}
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.orbContainer,
          {
            width: size,
            height: size,
            borderRadius: orbRadius,
            shadowColor: effectiveRingColor,
          },
          pressed && { opacity: 0.9, transform: [{ scale: 0.96 }] },
        ]}
      >
        <View
          style={[
            styles.orbInner,
            {
              width: innerSize,
              height: innerSize,
              borderRadius: innerRadius,
            },
          ]}
        >
          {icon ? (
            icon
          ) : useAvatar ? (
            <View style={StyleSheet.absoluteFill} className="items-center justify-center overflow-hidden">
              <Image
                source={DEFAULT_AVATAR_GIF}
                style={{
                  width: innerSize,
                  height: innerSize,
                  borderRadius: innerRadius,
                }}
                contentFit="cover"
                priority="high"
                autoplay={true}
                cachePolicy="memory-disk"
              />
            </View>
          ) : (
            <View style={styles.waveformRow}>
              <Animated.View style={[styles.waveLine, { height: h1, backgroundColor: accentColor }]} />
              <Animated.View style={[styles.waveLine, { height: h2, backgroundColor: accentColor }]} />
              <Animated.View style={[styles.waveLine, { height: h3, backgroundColor: accentColor }]} />
              <Animated.View style={[styles.waveLine, { height: h4, backgroundColor: accentColor }]} />
              <Animated.View style={[styles.waveLine, { height: h5, backgroundColor: accentColor }]} />
            </View>
          )}
        </View>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  outerWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    position: 'relative',
  },
  waveRing: {
    position: 'absolute',
    borderWidth: 2,
    alignSelf: 'center',
  },
  orbContainer: {
    backgroundColor: '#18181B',
    borderWidth: 2,
    borderColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 10,
  },
  orbInner: {
    backgroundColor: '#09090B',
    borderWidth: 1,
    borderColor: '#3F3F46',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  waveformRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  avatarWaveOverlay: {
    position: 'absolute',
    bottom: 8,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  waveLine: {
    width: 3.5,
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
  },
});
