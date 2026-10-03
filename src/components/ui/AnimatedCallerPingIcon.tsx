import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { MapPin } from 'lucide-react-native';

interface AnimatedCallerPingIconProps {
  size?: number;
  color?: string;
  pingColor?: string;
}

export const AnimatedCallerPingIcon: React.FC<AnimatedCallerPingIconProps> = ({
  size = 16,
  color = '#38BDF8',
  pingColor = 'rgba(56, 189, 248, 0.45)',
}) => {
  const pingAnim1 = useRef(new Animated.Value(0)).current;
  const pingAnim2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const createPingAnimation = (anim: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: 1,
            duration: 1600,
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ])
      );
    };

    const anim1 = createPingAnimation(pingAnim1, 0);
    const anim2 = createPingAnimation(pingAnim2, 800);

    anim1.start();
    anim2.start();

    return () => {
      anim1.stop();
      anim2.stop();
    };
  }, [pingAnim1, pingAnim2]);

  const scale1 = pingAnim1.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 2.3],
  });

  const opacity1 = pingAnim1.interpolate({
    inputRange: [0, 0.4, 1],
    outputRange: [0.8, 0.4, 0],
  });

  const scale2 = pingAnim2.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 2.6],
  });

  const opacity2 = pingAnim2.interpolate({
    inputRange: [0, 0.4, 1],
    outputRange: [0.8, 0.3, 0],
  });

  return (
    <View style={styles.container}>
      {/* Staggered Expanding Radar Ping Ring 1 */}
      <Animated.View
        style={[
          styles.pingRing,
          {
            backgroundColor: pingColor,
            transform: [{ scale: scale1 }],
            opacity: opacity1,
          },
        ]}
      />

      {/* Staggered Expanding Radar Ping Ring 2 */}
      <Animated.View
        style={[
          styles.pingRing,
          {
            backgroundColor: pingColor,
            transform: [{ scale: scale2 }],
            opacity: opacity2,
          },
        ]}
      />

      {/* Core MapPin Icon Badge */}
      <View style={styles.coreIconWrapper}>
        <MapPin size={size} color={color} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  pingRing: {
    position: 'absolute',
    width: 26,
    height: 26,
    borderRadius: 13,
  },
  coreIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
    borderWidth: 1.5,
    borderColor: '#38BDF8',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
});
