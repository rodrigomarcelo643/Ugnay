import React, { useEffect, useRef, useState } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { Image, ImageSource } from 'expo-image';
import { Radio, Flame, Waves, HeartPulse, ShieldAlert } from 'lucide-react-native';
import { IncidentType } from '@/types/incident';

const DEFAULT_AVATAR_GIF = require('@/assets/ai_avatar/ugnay_ai.gif');

// Pre-fetch avatar asset safely on client
if (typeof window !== 'undefined' && typeof (window as any).Image !== 'undefined') {
  try {
    Image.prefetch(DEFAULT_AVATAR_GIF);
  } catch (e) {}
}

interface QueuingRadarIconProps {
  incidentType?: IncidentType | string;
  size?: number;
  gifSource?: ImageSource | number | string;
  gifUri?: string;
  isPaused?: boolean;
  showRadarRings?: boolean;
}

export const QueuingRadarIcon: React.FC<QueuingRadarIconProps> = ({
  incidentType = 'GENERAL',
  size = 72,
  gifSource,
  gifUri,
  isPaused = false,
  showRadarRings = true,
}) => {
  const [imageError, setImageError] = useState(false);
  const ringScale = useRef(new Animated.Value(1)).current;
  const ringOpacity = useRef(new Animated.Value(0.75)).current;

  useEffect(() => {
    if (isPaused) return;

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(ringScale, {
            toValue: 1.28,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(ringOpacity, {
            toValue: 0,
            duration: 1500,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(ringScale, {
            toValue: 1,
            duration: 0,
            useNativeDriver: true,
          }),
          Animated.timing(ringOpacity, {
            toValue: 0.75,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      ])
    );

    pulse.start();
    return () => pulse.stop();
  }, [isPaused]);

  const getColor = () => {
    switch (incidentType) {
      case 'FIRE':
        return '#F43F5E';
      case 'FLOOD':
      case 'TYPHOON':
        return '#0EA5E9';
      case 'MEDICAL':
        return '#10B981';
      case 'SECURITY':
      case 'ACCIDENT':
        return '#F59E0B';
      default:
        return '#38BDF8';
    }
  };

  const themeColor = getColor();
  const avatarSource = gifSource || (gifUri ? { uri: gifUri } : DEFAULT_AVATAR_GIF);

  return (
    <View style={[styles.container, { width: size + 24, height: size + 24 }]}>
      {/* Smooth Concentric Sonar Ring */}
      {showRadarRings && (
        <Animated.View
          style={[
            styles.pulseRing,
            {
              width: size + 16,
              height: size + 16,
              borderRadius: (size + 16) / 2,
              borderColor: themeColor,
              backgroundColor: `${themeColor}20`,
              transform: [{ scale: ringScale }],
              opacity: ringOpacity,
            },
          ]}
        />
      )}

      {/* Circular Glowing AI Avatar Core */}
      <View
        style={[
          styles.avatarCore,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderColor: themeColor,
            shadowColor: themeColor,
          },
        ]}
      >
        {!imageError ? (
          <Image
            source={avatarSource}
            style={{ width: size, height: size, borderRadius: size / 2 }}
            contentFit="cover"
            priority="high"
            autoplay={true}
            cachePolicy="memory-disk"
            onError={() => setImageError(true)}
          />
        ) : (
          <View style={[styles.fallbackBox, { backgroundColor: '#09090B' }]}>
            <Radio size={Math.round(size * 0.45)} color={themeColor} />
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    alignSelf: 'center',
    marginVertical: 4,
  },
  pulseRing: {
    position: 'absolute',
    borderWidth: 2,
  },
  avatarCore: {
    backgroundColor: '#09090B',
    borderWidth: 2.5,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
  fallbackBox: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
