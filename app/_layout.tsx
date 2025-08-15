import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../database/config';
import { UserProgressService } from '../src/services/UserProgressService';
import { View } from 'react-native';
import Auth from '../components/Auth/Auth';


export default function RootLayout() {
    const [session, setSession] = useState<Session | null>(null);
    const [showSplash, setShowSplash] = useState(true);
    const [authInitialized, setAuthInitialized] = useState(false);
    const [profileProcessed, setProfileProcessed] = useState<Set<string>>(new Set());

    useEffect(() => {
        let isMounted = true;

        // Simple 2-second splash screen timer
        const splashTimer = setTimeout(() => {
            if (isMounted) {
                setShowSplash(false);
            }
        }, 2000);

        // Fallback timer to ensure auth initializes even if something goes wrong
        const authFallbackTimer = setTimeout(() => {
            if (isMounted) {
                console.warn('Auth initialization taking too long, forcing initialization');
                setAuthInitialized(true);
            }
        }, 5000); // 5 second fallback

        // Initialize auth separately with fallback
        const initAuth = async () => {
            try {
                console.log('Starting auth initialization...');
                const {
                    data: { session },
                } = await supabase.auth.getSession();

                console.log('Auth session obtained:', session?.user?.email || 'No session');

                if (isMounted) {
                    setSession(session);
                    setAuthInitialized(true);
                    clearTimeout(authFallbackTimer);

                    // Update streak in background if session exists
                    if (session?.user) {
                        UserProgressService.updateStreak(session.user.id).catch(console.error);
                    }
                }
            } catch (error) {
                console.error('Auth initialization error:', error);
                if (isMounted) {
                    setAuthInitialized(true);
                    clearTimeout(authFallbackTimer);
                }
            }
        };

        initAuth();

        // Set up auth listener
        const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (!isMounted) return;

            console.log('Auth state changed:', event, session?.user?.email);

            // Always update session and mark as initialized
            setSession(session);
            setAuthInitialized(true);
            clearTimeout(authFallbackTimer);

            if (event === 'SIGNED_IN' && session?.user) {
                // Prevent repeated processing for the same user
                if (!profileProcessed.has(session.user.id)) {
                    // Handle email confirmation or login in background
                    setProfileProcessed((prev) => new Set(prev).add(session.user.id));
                    
                    // Don't await this - do it in background to avoid blocking UI
                    (async () => {
                        try {
                            // Check if user profile exists, create if not
                            const { data: profile, error: profileFetchError } = await supabase
                                .from('profiles')
                                .select('user_id')
                                .eq('user_id', session.user.id)
                                .single();

                            if (!profile) {
                                // Create profile for new users
                                const { username = '' } = session.user.user_metadata || {};
                                const { error: profileError } = await supabase.from('profiles').insert({
                                    user_id: session.user.id,
                                    email: session.user.email,
                                    username: username || session.user.email?.split('@')[0] || '',
                                    streak: 0,
                                    level: 1,
                                    exp: 0,
                                    total_xp: 0,
                                });

                                if (profileError) {
                                    // Handle different error types
                                    if (profileError.code === '23503') {
                                        // Foreign key constraint - user auth record missing
                                        console.log('User auth record missing, signing out immediately...');
                                        if (isMounted) {
                                            setSession(null);
                                            setAuthInitialized(true);
                                        }
                                        await supabase.auth.signOut();
                                        return;
                                    } else if (profileError.code === '23505') {
                                        // Profile already exists (duplicate key) - this is actually OK
                                        console.log('Profile already exists for user:', session.user.email);
                                    } else {
                                        console.error('Error creating profile:', profileError);
                                    }
                                } else {
                                    console.log('Profile created successfully for user:', session.user.email);
                                }
                            }

                            // Update streak in background
                            UserProgressService.updateStreak(session.user.id).catch(console.error);
                        } catch (error) {
                            console.error('Error handling user login:', error);
                        }
                    })();
                }
            }

            // Handle sign out event
            if (event === 'SIGNED_OUT') {
                console.log('User signed out, clearing session...');
                if (isMounted) {
                    setSession(null);
                    setProfileProcessed(new Set());
                }
            }
        });

        return () => {
            isMounted = false;
            clearTimeout(splashTimer);
            clearTimeout(authFallbackTimer);
            authListener.subscription?.unsubscribe();
        };
    }, []);

    // Show splash screen for 2 seconds


    // Wait for auth to initialize


    // Show login or main app based on session
    if (!session) {
        console.log('Showing login screen (no session)');
        return (
            <View style={{ flex: 1 }}>
                <Auth />
            </View>
        );
    }

    console.log('Showing main app (session exists):', session.user?.email);

    return (
        <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="achievements" options={{ headerShown: false }} />
        </Stack>
    );
}