import React, { useState, useEffect } from 'react';
import { Text, TextStyle } from 'react-native';

interface TypewriterTextProps {
  text?: string | null;
  speed?: number;
  style?: TextStyle | TextStyle[];
  onComplete?: () => void;
  className?: string;
}

export const TypewriterText: React.FC<TypewriterTextProps> = ({
  text = '',
  speed = 35,
  style,
  onComplete,
  className = '',
}) => {
  const safeText = typeof text === 'string' ? text : (text ? String(text) : '');
  const [displayedText, setDisplayedText] = useState('');

  useEffect(() => {
    setDisplayedText('');
    if (!safeText) return;

    let index = 0;
    const interval = setInterval(() => {
      if (index < safeText.length) {
        setDisplayedText(safeText.slice(0, index + 1));
        index++;
      } else {
        clearInterval(interval);
        if (onComplete) onComplete();
      }
    }, speed);

    return () => clearInterval(interval);
  }, [safeText, speed]);

  return (
    <Text style={style} className={className}>
      {displayedText}
      {Boolean(safeText) && displayedText.length < safeText.length && (
        <Text className="text-sky-400 font-bold opacity-80"> ❚</Text>
      )}
    </Text>
  );
};
