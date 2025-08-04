import { Audio } from 'expo-av';
import { Platform } from 'react-native';

class AudioManager {
  private static instance: AudioManager;
  private currentMode: 'playback' | 'recording' | null = null;
  private isTransitioning: boolean = false;
  
  static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }
  
  async configureForPlayback(): Promise<void> {
    // Prevent concurrent transitions
    if (this.isTransitioning) {
      await new Promise(resolve => setTimeout(resolve, 300));
      return;
    }
    this.isTransitioning = true;
    try {
      // First, completely reset the audio session
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,  // Keep active to maintain settings
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: false,
      });
      // Wait for the system to stabilize
      await new Promise(resolve => setTimeout(resolve, 300));
      // Prime the audio session by playing a short non-silent sound at full volume
      try {
        const primeSound = new Audio.Sound();
        await primeSound.loadAsync(require('../../assets/audio/prime.mp3'));
        await primeSound.setVolumeAsync(0.01);
        await primeSound.playAsync();
        await new Promise(resolve => setTimeout(resolve, 150)); // Let it play briefly
        await primeSound.stopAsync();
        await primeSound.unloadAsync();
      } catch (e) {
        console.warn('Audio priming failed:', e);
      }
      this.currentMode = 'playback';
    } catch (error) {
      console.error('❌ Audio configuration error:', error);
    } finally {
      this.isTransitioning = false;
    }
  }
  
  async configureForRecording(): Promise<void> {
    // Prevent concurrent transitions
    if (this.isTransitioning) {
      await new Promise(resolve => setTimeout(resolve, 300));
      return;
    }
    
    this.isTransitioning = true;
    
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
      
      this.currentMode = 'recording';
    } catch (error) {
      console.error('❌ Audio configuration error:', error);
    } finally {
      this.isTransitioning = false;
    }
  }
  
  getCurrentMode(): 'playback' | 'recording' | null {
    return this.currentMode;
  }
  
  async reset(): Promise<void> {
    this.currentMode = null;
    await this.configureForPlayback();
  }
}

export default AudioManager.getInstance();