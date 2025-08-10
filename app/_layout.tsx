import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../database/config';
import { UserProgressService } from '../src/services/UserProgressService';
import { LanguageService } from '../src/services/LanguageService';
import { View } from 'react-native';
import Auth from '../components/Auth/Auth';
import SplashScreen from '../components/SplashScreen';
import LanguageSelectionScreen from '../components/LanguageSelection/LanguageSelectionScreen';
import AsyncStorage from '@react-native-async-storage/async-storage';
import I18nWrapper from '../components/I18nWrapper';
import '../src/i18n/i18n';

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [showSplash, setShowSplash] = useState(true);
  const [authInitialized, setAuthInitialized] = useState(false);
  const [showLanguageSelection, setShowLanguageSelection] = useState(false);
  const [languageCheckComplete, setLanguageCheckComplete] = useState(false);

  useEffect(() => {
    // Simple 2-second splash screen timer
    const splashTimer = setTimeout(() => {
      setShowSplash(false);
    }, 2000);

    // Check if language selection has been completed
    const checkLanguageSelection = async () => {
      try {
        const languageSelected = await AsyncStorage.getItem('language_selection_completed');
        if (!languageSelected) {
          setShowLanguageSelection(true);
        }
        setLanguageCheckComplete(true);
      } catch (error) {
        console.error('Error checking language selection:', error);
        setLanguageCheckComplete(true);
      }
    };

    checkLanguageSelection();

    // Initialize auth separately with fallback
    const initAuth = () => {
      // Force initialization after 3 seconds if supabase hangs
      const fallbackTimer = setTimeout(() => {
        setAuthInitialized(true);
      }, 3000);

      supabase.auth.getSession().then(({ data: { session } }) => {
        clearTimeout(fallbackTimer);
        setSession(session);
        setAuthInitialized(true);
        
        // Update streak and load language in background if session exists
        if (session?.user) {
          UserProgressService.updateStreak(session.user.id).catch(console.error);
          LanguageService.loadUserLanguage(session.user.id).catch(console.error);
        }
      }).catch((error) => {
        console.error('Auth initialization error:', error);
        clearTimeout(fallbackTimer);
        setAuthInitialized(true);
      });
    };

    initAuth();

    // Set up auth listener
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setAuthInitialized(true);
      
      if (session?.user && event === 'SIGNED_IN') {
        UserProgressService.updateStreak(session.user.id).catch(console.error);
        LanguageService.loadUserLanguage(session.user.id).catch(console.error);
      }
    });

    return () => {
      clearTimeout(splashTimer);
      authListener.subscription?.unsubscribe();
    };
  }, []);

  // Show splash screen for 2 seconds
  if (showSplash) {
    return <SplashScreen />;
  }

  // Wait for auth and language check to initialize
  if (!authInitialized || !languageCheckComplete) {
    return <SplashScreen />;
  }

  // Show language selection if not completed
  if (showLanguageSelection) {
    return (
      <I18nWrapper>
        <LanguageSelectionScreen
          onLanguageSelected={() => setShowLanguageSelection(false)}
        />
      </I18nWrapper>
    );
  }

  // Show login or main app based on session
  if (!session) {
    return (
      <I18nWrapper>
        <View style={{ flex: 1 }}>
          <Auth />
        </View>
      </I18nWrapper>
    );
  }

  return (
    <I18nWrapper>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="achievements" options={{ headerShown: false }} />
      </Stack>
    </I18nWrapper>
  );
}
