import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Image } from 'expo-image';

const LOGO_ASSET = require('@/assets/logo/ugnay_logo.jpg');

// Pre-register/prefetch logo asset safely on browser client side
if (typeof window !== 'undefined' && typeof (window as any).Image !== 'undefined') {
  try {
    Image.prefetch(LOGO_ASSET);
  } catch (e) {
    // Ignored in non-browser / SSR environments
  }
}

interface LogoProps {
  size?: number;
  className?: string;
  bordered?: boolean;
}

export const Logo: React.FC<LogoProps> = ({
  size = 40,
  className = '',
  bordered = true,
}) => {
  const containerSize = size;
  const imageSize = size - (bordered ? 6 : 0);

  return (
    <View
      style={[
        styles.container,
        { width: containerSize, height: containerSize },
        bordered && styles.bordered,
      ]}
      className={className}
    >
      <Image
        source={LOGO_ASSET}
        style={{ width: imageSize, height: imageSize, borderRadius: 6 }}
        contentFit="cover"
        priority="high"
        transition={0}
        cachePolicy="memory-disk"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#09090B',
  },
  bordered: {
    borderWidth: 1.5,
    borderColor: '#38BDF8',
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
});

