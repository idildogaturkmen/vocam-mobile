import 'react-native-url-polyfill/auto';
import { useState, useEffect } from 'react';
import { supabase } from '../database/config';
import Auth from '../components/Auth/Auth';
import { View } from 'react-native';
import { Session } from '@supabase/supabase-js';
import { useRouter, useSegments } from 'expo-router';
import { UserProgressService } from '../src/services/UserProgressService';

export default function App() {
    const [session, setSession] = useState<Session | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();
    const segments = useSegments();

    useEffect(() => {
        supabase.auth.getSession().then(async ({ data: { session } }) => {
            setSession(session);
            
            // Update streak on app startup if user has an existing session
            if (session?.user) {
                try {
                    await UserProgressService.updateStreak(session.user.id);
                } catch (error) {
                    console.error('Error updating streak on app startup:', error);
                }
            }
            
            setIsLoading(false);
        });

        const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
            setSession(session);
            
            // Update streak on auth state change
            if (session?.user && event === 'SIGNED_IN') {
                try {
                    await UserProgressService.updateStreak(session.user.id);
                } catch (error) {
                    console.error('Error updating streak on sign in:', error);
                }
            }
            
            setIsLoading(false);
        });

        return () => {
            authListener.subscription?.unsubscribe();
        };
    }, []);

    useEffect(() => {
        if (isLoading) return;

        const inAuthGroup = segments[0] === '(auth)';

        if (session && !inAuthGroup) {
            router.replace('/(tabs)/detection');
        } else if (!session && inAuthGroup) {
            router.replace('/App');
        }
    }, [session, isLoading, segments]);

    if (isLoading) {
        return null;
    }

    return (
        <View>
            <Auth />
        </View>
    );
}
