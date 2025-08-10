import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../database/config';
import { UserProgressService } from '../src/services/UserProgressService';
import { View } from 'react-native';
import Auth from '../components/Auth/Auth';
import SplashScreen from '../components/SplashScreen';

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [showSplash, setShowSplash] = useState(true);
  const [authInitialized, setAuthInitialized] = useState(false);

  useEffect(() => {
    // Simple 2-second splash screen timer
    const splashTimer = setTimeout(() => {
      setShowSplash(false);
    }, 2000);

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
        
        // Update streak in background if session exists
        if (session?.user) {
          UserProgressService.updateStreak(session.user.id).catch(console.error);
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

  // Wait for auth to initialize
  if (!authInitialized) {
    return <SplashScreen />;
  }

  // Show login or main app based on session
  if (!session) {
    return (
      <View style={{ flex: 1 }}>
        <Auth />
      </View>
    );
  }

  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="achievements" options={{ headerShown: false }} />
    </Stack>
  );
}
