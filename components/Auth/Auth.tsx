import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, TouchableOpacity, View, useColorScheme } from 'react-native';
import { Button, Input } from 'react-native-elements';
import { createUser, login } from '@/database/login';
import { Text } from 'react-native';

export default function Auth() {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    
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
        if (data && !data.session) {
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
        borderColor: hasError ? 'red' : (isDark ? '#555' : '#ccc'),
        color: isDark ? '#ffffff' : '#000000',
    });

    return (
        <View style={[styles.container, { backgroundColor: isDark ? '#000000' : '#ffffff' }]}>
            {/* Tabs */}
            <View style={styles.tabContainer}>
                <TouchableOpacity
                    style={[styles.tabButton, activeTab === 'signin' && { borderBottomColor: isDark ? '#64B5F6' : '#007bff' }]}
                    onPress={() => setActiveTab('signin')}
                >
                    <Text style={[
                        styles.tabText, 
                        { color: isDark ? '#BDBDBD' : 'gray' },
                        activeTab === 'signin' && { color: isDark ? '#64B5F6' : '#007bff', fontWeight: 'bold' }
                    ]}>
                        Sign In
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tabButton, activeTab === 'signup' && { borderBottomColor: isDark ? '#64B5F6' : '#007bff' }]}
                    onPress={() => setActiveTab('signup')}
                >
                    <Text style={[
                        styles.tabText,
                        { color: isDark ? '#BDBDBD' : 'gray' },
                        activeTab === 'signup' && { color: isDark ? '#64B5F6' : '#007bff', fontWeight: 'bold' }
                    ]}>
                        Sign Up
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Username (only for Sign Up) */}
            {activeTab === 'signup' && (
                <View style={[styles.verticallySpaced, styles.mt20]}>
                    <Input
                        label="Username"
                        labelStyle={{ color: isDark ? '#ffffff' : '#000000' }}
                        leftIcon={{ type: 'font-awesome', name: 'user', color: isDark ? '#BDBDBD' : '#666666' }}
                        onChangeText={setUsername}
                        value={username}
                        placeholder="John Doe"
                        placeholderTextColor={isDark ? '#888888' : '#999999'}
                        inputStyle={getInputStyle(errors.username)}
                        autoCapitalize="words"
                        errorMessage={errors.username ? 'Username is required' : ''}
                        errorStyle={{ color: 'red' }}
                    />
                </View>
            )}

            {/* Email */}
            <View style={[styles.verticallySpaced, activeTab === 'signin' && styles.mt20]}>
                <Input
                    label="Email"
                    labelStyle={{ color: isDark ? '#ffffff' : '#000000' }}
                    leftIcon={{ type: 'font-awesome', name: 'envelope', color: isDark ? '#BDBDBD' : '#666666' }}
                    onChangeText={setEmail}
                    value={email}
                    placeholder="email@address.com"
                    placeholderTextColor={isDark ? '#888888' : '#999999'}
                    inputStyle={getInputStyle(errors.email)}
                    autoCapitalize="none"
                    errorMessage={errors.email ? 'Invalid email' : ''}
                    errorStyle={{ color: 'red' }}
                />
            </View>

            {/* Password */}
            <View style={[styles.verticallySpaced]}>
                <Input
                    label="Password"
                    labelStyle={{ color: isDark ? '#ffffff' : '#000000' }}
                    leftIcon={{ type: 'font-awesome', name: 'lock', color: isDark ? '#BDBDBD' : '#666666' }}
                    onChangeText={setPassword}
                    value={password}
                    secureTextEntry
                    placeholder="Password"
                    placeholderTextColor={isDark ? '#888888' : '#999999'}
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
                    errorStyle={{ color: 'red' }}
                />
            </View>

            {/* Action button */}
            <View style={[styles.verticallySpaced, styles.mt20]}>
                <Button
                    title={activeTab === 'signin' ? 'Sign In' : 'Sign Up'}
                    disabled={loading}
                    onPress={activeTab === 'signin' ? () => handleLogin() : () => handleSignup()}
                    buttonStyle={{ 
                        backgroundColor: isDark ? '#64B5F6' : '#007bff',
                        borderRadius: 5 
                    }}
                />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
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
    tabText: {
        fontSize: 16,
    },
});
