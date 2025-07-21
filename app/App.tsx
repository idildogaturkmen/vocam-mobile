import 'react-native-url-polyfill/auto';
import { useState, useEffect } from 'react';
import { supabase } from '../database/config';
import Auth from '../components/Auth/Auth';
import { View } from 'react-native';
import { Session } from '@supabase/supabase-js';
import { useRouter, useSegments } from 'expo-router';

export default function App() {
    const [session, setSession] = useState<Session | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();
    const segments = useSegments();

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setIsLoading(false);
        });

        const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
            setSession(session);
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
            router.replace('/(tabs)/progress');
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
