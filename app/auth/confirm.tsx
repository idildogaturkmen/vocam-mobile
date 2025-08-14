import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { View, Text, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { supabase } from '../../database/config';
import { writeUserData } from '../../database/crudOperations';
import { UserProgressService } from '../../src/services/UserProgressService';

export default function AuthConfirmScreen() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState('Confirming your email...');

    useEffect(() => {
        handleAuthConfirm();
    }, []);

    const handleAuthConfirm = async () => {
        try {
            // Listen for auth state changes to handle email confirmation
            const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
                if (event === 'SIGNED_IN' && session) {
                    console.log('User confirmed email and signed in:', session.user.email);
                    
                    setStatus('Email confirmed! Setting up your profile...');
                    
                    // Check if user profile already exists
                    const { data: existingProfile } = await supabase
                        .from('profiles')
                        .select('user_id')
                        .eq('user_id', session.user.id)
                        .single();

                    if (!existingProfile) {
                        // Create user profile for new users
                        const { username = '' } = session.user.user_metadata || {};
                        await writeUserData({
                            TableName: 'profiles',
                            Items: [{ 
                                user_id: session.user.id, 
                                email: session.user.email, 
                                username, 
                                streak: 0 
                            }],
                        });

                        // Initialize user progress
                        try {
                            await UserProgressService.updateStreak(session.user.id);
                        } catch (error) {
                            console.error('Error initializing user progress:', error);
                        }
                    }

                    setStatus('Welcome to Vocam! Redirecting...');
                    
                    // Clean up listener
                    authListener.subscription.unsubscribe();
                    
                    // Redirect to main app after successful confirmation
                    setTimeout(() => {
                        router.replace('/(tabs)/detection');
                    }, 1500);

                } else if (event === 'SIGNED_OUT') {
                    setStatus('Email confirmation failed. Please try again.');
                    setLoading(false);
                    
                    setTimeout(() => {
                        Alert.alert(
                            'Confirmation Failed',
                            'Unable to confirm your email. Please check your email link or try signing up again.',
                            [
                                { 
                                    text: 'Try Again', 
                                    onPress: () => router.replace('/') 
                                }
                            ]
                        );
                    }, 2000);
                }
            });

            // Set a timeout in case the confirmation process takes too long
            setTimeout(() => {
                if (loading) {
                    setStatus('Taking longer than expected...');
                    setLoading(false);
                    Alert.alert(
                        'Timeout',
                        'Email confirmation is taking longer than expected. Please try opening the link again.',
                        [
                            { 
                                text: 'Go to Login', 
                                onPress: () => router.replace('/') 
                            }
                        ]
                    );
                }
            }, 10000); // 10 second timeout

        } catch (error) {
            console.error('Error handling auth confirmation:', error);
            setStatus('An error occurred during confirmation.');
            setLoading(false);
            
            Alert.alert(
                'Error',
                'Something went wrong during email confirmation. Please try again.',
                [
                    { 
                        text: 'Back to Login', 
                        onPress: () => router.replace('/') 
                    }
                ]
            );
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.content}>
                <Text style={styles.title}>Email Confirmation</Text>
                <Text style={styles.status}>{status}</Text>
                {loading && (
                    <ActivityIndicator 
                        size="large" 
                        color="#3498db" 
                        style={styles.loader}
                    />
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f9fa',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    content: {
        alignItems: 'center',
        maxWidth: 300,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#2c3e50',
        marginBottom: 20,
        textAlign: 'center',
    },
    status: {
        fontSize: 16,
        color: '#7f8c8d',
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 30,
    },
    loader: {
        marginTop: 20,
    },
});