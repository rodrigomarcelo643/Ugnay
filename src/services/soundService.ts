/**
 * UGNAY Sound & Ringtone Service
 * Plays ringtone call audio (assets/sounds/call_sound.mp3) on incoming emergency calls.
 */

import { Platform } from 'react-native';

class SoundService {
  private audioElement: HTMLAudioElement | null = null;
  private soundInstance: any = null;
  private playTimer: any = null;
  private isPlaying: boolean = false;

  async playRingtone(delayMs: number = 600) {
    // Stop any existing ringtone and clear pending timers first
    this.stopRingtone();

    this.isPlaying = true;

    // Small delay before ringtone audio triggers
    this.playTimer = setTimeout(async () => {
      if (!this.isPlaying) return;

      try {
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          const soundModule = require('../../assets/sounds/call_sound.mp3');
          const audioSrc = typeof soundModule === 'string' ? soundModule : (soundModule?.default || soundModule);

          const audio = new window.Audio(audioSrc);
          audio.loop = true;
          this.audioElement = audio;

          await audio.play().catch((err) => {
            console.warn('Web Ringtone Play Autoplay Blocked/Warning:', err);
          });
        } else {
          // Native fallback using expo-av (if installed)
          try {
            let Audio: any = null;
            try {
              Audio = require('expo-av').Audio;
            } catch (e) {
              Audio = null;
            }

            if (Audio) {
              await Audio.setAudioModeAsync({
                playsInSilentModeIOS: true,
                staysActiveInBackground: true,
              });
              const { sound } = await Audio.Sound.createAsync(
                require('../../assets/sounds/call_sound.mp3'),
                { shouldPlay: true, isLooping: true }
              );
              this.soundInstance = sound;
            }
          } catch (nativeError) {}
        }
      } catch (err) {
        console.warn('SoundService playRingtone error:', err);
      }
    }, delayMs);
  }

  stopRingtone() {
    this.isPlaying = false;
    if (this.playTimer) {
      clearTimeout(this.playTimer);
      this.playTimer = null;
    }

    try {
      if (this.audioElement) {
        this.audioElement.pause();
        this.audioElement.currentTime = 0;
        this.audioElement = null;
      }
      if (this.soundInstance) {
        this.soundInstance.stopAsync?.().catch(() => {});
        this.soundInstance.unloadAsync?.().catch(() => {});
        this.soundInstance = null;
      }
    } catch (err) {
      console.warn('SoundService stopRingtone warning:', err);
    }
  }
}

export const soundService = new SoundService();
