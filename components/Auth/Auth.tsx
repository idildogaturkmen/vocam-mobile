import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Button, Input } from '@rneui/themed';
import { createUser, login } from '@/database/login';
import { Text } from 'react-native';
import { router } from 'expo-router';

export default function Auth() {
    const [activeTab, setActiveTab] = useState<'signin' | 'signup'>('signin');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [username, setUsername] = useState('');
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState({
        email: false,
        username: false,
        password: false,
    });

    // Reset fields when switching tabs
    useEffect(() => {
        setUsername('');
        setEmail('');
        setPassword('');
        setErrors({ email: false, password: false, username: false });
    }, [activeTab]);

    const validateEmail = (email: string) => /\S+@\S+\.\S+/.test(email);

    const handleLogin = async () => {
        const newErrors = {
            email: !validateEmail(email),
            username: false,
            password: password.length < 6,
        };

        setErrors(newErrors);
        const hasAnyError = Object.values(newErrors).some((value) => value === true);

        if (hasAnyError) {
            console.log('Login errors:', newErrors);
            return;
        }
        const data = await login(email, password, setLoading);
        if (data && data.session) router.replace('/(tabs)/detection');
        else if (data && !data.session) {
            setLoading(false);
            Alert.alert('Please check your inbox for email verification!');
        }
    };

    const handleSignup = async () => {
        const newErrors = {
            email: !validateEmail(email),
            username: !username.trim(),
            password: password.length < 6,
        };

        setErrors(newErrors);
        const hasAnyError = Object.values(newErrors).some((value) => value === true);

        if (hasAnyError) {
            console.log('Signup errors:', newErrors);
            return;
        }
        await createUser(email, password, username, setLoading);
    };

    const getInputStyle = (hasError: boolean) => ({
        borderWidth: hasError ? 1 : 0,
        borderColor: hasError ? 'red' : '#ccc',
    });

    return (
        <View style={styles.container}>
            {/* Tabs */}
            <View style={styles.tabContainer}>
                <TouchableOpacity
                    style={[styles.tabButton, activeTab === 'signin' && styles.activeTab]}
                    onPress={() => setActiveTab('signin')}
                >
                    <Text style={[styles.tabText, activeTab === 'signin' && styles.activeTabText]}>
                        Sign In
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tabButton, activeTab === 'signup' && styles.activeTab]}
                    onPress={() => setActiveTab('signup')}
                >
                    <Text style={[styles.tabText, activeTab === 'signup' && styles.activeTabText]}>
                        Sign Up
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Username (only for Sign Up) */}
            {activeTab === 'signup' && (
                <View style={[styles.verticallySpaced, styles.mt20]}>
                    <Input
                        label="Username"
                        leftIcon={{ type: 'font-awesome', name: 'user' }}
                        onChangeText={setUsername}
                        value={username}
                        placeholder="John Doe"
                        inputStyle={getInputStyle(errors.username)}
                        autoCapitalize="words"
                        errorMessage={errors.username ? 'Username is required' : ''}
                    />
                </View>
            )}

            {/* Email */}
            <View style={[styles.verticallySpaced, activeTab === 'signin' && styles.mt20]}>
                <Input
                    label="Email"
                    leftIcon={{ type: 'font-awesome', name: 'envelope' }}
                    onChangeText={setEmail}
                    value={email}
                    placeholder="email@address.com"
                    inputStyle={getInputStyle(errors.email)}
                    autoCapitalize="none"
                    errorMessage={errors.email ? 'Invalid email' : ''}
                />
            </View>

            {/* Password */}
            <View style={[styles.verticallySpaced]}>
                <Input
                    label="Password"
                    leftIcon={{ type: 'font-awesome', name: 'lock' }}
                    onChangeText={setPassword}
                    value={password}
                    secureTextEntry
                    placeholder="Password"
                    inputStyle={getInputStyle(errors.password)}
                    autoCapitalize="none"
                    errorMessage={
                        activeTab === 'signup'
                            ? errors.password
                                ? 'Password must have more than 6 characters'
                                : ''
                            : activeTab === 'signin'
                              ? errors.password
                                  ? 'Invalid password'
                                  : ''
                              : ''
                    }
                />
            </View>

            {/* Action button */}
            <View style={[styles.verticallySpaced, styles.mt20]}>
                <Button
                    title={activeTab === 'signin' ? 'Sign In' : 'Sign Up'}
                    disabled={loading}
                    onPress={activeTab === 'signin' ? () => handleLogin() : () => handleSignup()}
                />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginTop: 40,
        padding: 12,
    },
    verticallySpaced: {
        paddingTop: 4,
        paddingBottom: 4,
    },
    mt20: {
        marginTop: 20,
    },
    tabContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginBottom: 20,
    },
    tabButton: {
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderBottomWidth: 2,
        borderBottomColor: 'transparent',
    },
    activeTab: {
        borderBottomColor: '#007bff',
    },
    tabText: {
        fontSize: 16,
        color: 'gray',
    },
    activeTabText: {
        color: '#007bff',
        fontWeight: 'bold',
    },
});
