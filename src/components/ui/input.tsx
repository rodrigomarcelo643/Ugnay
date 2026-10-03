import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TextInputProps,
  Animated,
  StyleSheet,
  Pressable,
  Platform,
} from 'react-native';

interface FloatingInputProps extends TextInputProps {
  label?: string;
  required?: boolean;
  icon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  onRightIconPress?: () => void;
  error?: string;
}

export const Input: React.FC<FloatingInputProps> = ({
  label = '',
  required = false,
  icon,
  rightIcon,
  onRightIconPress,
  error,
  value = '',
  onFocus,
  onBlur,
  style,
  ...props
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const animatedValue = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: isFocused || (value && value.length > 0) ? 1 : 0,
      duration: 180,
      useNativeDriver: false,
    }).start();
  }, [isFocused, value]);

  const handleFocus = (e: any) => {
    setIsFocused(true);
    if (onFocus) onFocus(e);
  };

  const handleBlur = (e: any) => {
    setIsFocused(false);
    if (onBlur) onBlur(e);
  };

  const labelTranslateY = useRef(
    animatedValue.interpolate({
      inputRange: [0, 1],
      outputRange: [10, -10],
    })
  ).current;

  const labelFontSize = useRef(
    animatedValue.interpolate({
      inputRange: [0, 1],
      outputRange: [15, 12],
    })
  ).current;

  const labelColor = useRef(
    animatedValue.interpolate({
      inputRange: [0, 1],
      outputRange: ['#71717A', '#38BDF8'],
    })
  ).current;

  return (
    <View style={styles.outerContainer}>
      <View
        style={[
          styles.inputContainer,
          isFocused ? styles.inputContainerFocused : styles.inputContainerUnfocused,
          error ? styles.inputContainerError : null,
        ]}
      >
        {/* Leading Icon */}
        {icon && <View style={styles.iconWrapper}>{icon}</View>}

        {/* Input & Floating Label area */}
        <View style={styles.textContainer}>
          <Animated.Text
            pointerEvents="none"
            style={[
              styles.floatingLabel,
              {
                transform: [{ translateY: labelTranslateY }],
                fontSize: labelFontSize,
                color: labelColor,
              },
            ]}
          >
            {label} {required && <Text style={styles.asterisk}>*</Text>}
          </Animated.Text>

          <TextInput
            value={value}
            onFocus={handleFocus}
            onBlur={handleBlur}
            style={[styles.textInput, style]}
            placeholder=""
            placeholderTextColor="transparent"
            {...props}
          />
        </View>

        {/* Trailing Icon (e.g. Eye toggle) */}
        {rightIcon && (
          <Pressable onPress={onRightIconPress} style={styles.rightIconWrapper}>
            {rightIcon}
          </Pressable>
        )}
      </View>

      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    width: '100%',
    marginBottom: 20,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: 2,
    backgroundColor: '#18181B',
    borderRadius: 12,
    minHeight: 60,
  },
  inputContainerUnfocused: {
    borderBottomColor: '#27272A',
  },
  inputContainerFocused: {
    borderBottomColor: '#38BDF8',
  },
  inputContainerError: {
    borderBottomColor: '#F43F5E',
  },
  iconWrapper: {
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
    position: 'relative',
    height: 44,
  },
  floatingLabel: {
    position: 'absolute',
    left: 0,
    top: 8,
    fontWeight: '600',
    zIndex: 1,
  },
  asterisk: {
    color: '#F43F5E',
  },
  textInput: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    padding: 0,
    marginTop: 14,
    height: 28,
    width: '100%',
    ...Platform.select({
      web: {
        outlineStyle: 'none' as any,
      },
    }),
  },
  rightIconWrapper: {
    marginLeft: 12,
    padding: 6,
    marginTop: 6,
  },
  errorText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#F43F5E',
    marginTop: 4,
    marginLeft: 4,
  },
});
