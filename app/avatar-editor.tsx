import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
    SafeAreaView,
    Dimensions,
    Platform,
    InteractionManager,
    Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { scale, normalizeFont } from '../utils/normalize';
import { useRouter, Stack } from 'expo-router';
import { supabase } from '../database/config';
import HumanAvatar, { 
    HumanAvatarConfig, 
    AvatarStyle,
    AVATAR_OPTIONS,
    BACKGROUND_COLORS,
    SKIN_COLORS,
    HAIR_COLORS,
    CLOTHING_COLORS
} from '../src/components/Avatar';

const { width } = Dimensions.get('window');
const isTablet = width > 768;

// Memoized color option component to prevent re-renders
const ColorOption = React.memo(({ 
    color, 
    isSelected, 
    onPress, 
    checkColor = '#fff' 
}: { 
    color: any; 
    isSelected: boolean; 
    onPress: () => void; 
    checkColor?: string;
}) => {
    const handlePress = useCallback(() => {
        onPress();
    }, [onPress]);

    // Use View with onTouchStart for Android emergency fix
    if (Platform.OS === 'android') {
        return (
            <View
                style={[
                    styles.colorOption,
                    isTablet && styles.colorOptionTablet,
                    { backgroundColor: color.hex },
                    isSelected && styles.selectedColorOption
                ]}
                onTouchStart={handlePress}
                onStartShouldSetResponder={() => true}
                onResponderGrant={handlePress}
            >
                {isSelected && (
                    <Ionicons name="checkmark" size={scale(20)} color={checkColor} />
                )}
            </View>
        );
    }

    return (
        <TouchableOpacity
            style={[
                styles.colorOption,
                isTablet && styles.colorOptionTablet,
                { backgroundColor: color.hex },
                isSelected && styles.selectedColorOption
            ]}
            onPress={handlePress}
            hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
            activeOpacity={0.8}
        >
            {isSelected && (
                <Ionicons name="checkmark" size={scale(20)} color={checkColor} />
            )}
        </TouchableOpacity>
    );
});

// Memoized feature option component to prevent re-renders
const FeatureOption = React.memo(({ 
    feature, 
    isSelected, 
    onPress 
}: { 
    feature: any; 
    isSelected: boolean; 
    onPress: () => void; 
}) => {
    const handlePress = useCallback(() => {
        onPress();
    }, [onPress]);

    // Use View with onTouchStart for Android emergency fix
    if (Platform.OS === 'android') {
        return (
            <View
                style={[
                    styles.featureButton,
                    isTablet && styles.featureButtonTablet,
                    isSelected && styles.selectedFeature
                ]}
                onTouchStart={handlePress}
                onStartShouldSetResponder={() => true}
                onResponderGrant={handlePress}
            >
                <Text style={[
                    styles.featureText,
                    isTablet && styles.featureTextTablet,
                    isSelected && styles.selectedFeatureText
                ]}>
                    {feature.name}
                </Text>
            </View>
        );
    }

    return (
        <TouchableOpacity
            style={[
                styles.featureButton,
                isTablet && styles.featureButtonTablet,
                isSelected && styles.selectedFeature
            ]}
            onPress={handlePress}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            activeOpacity={0.8}
        >
            <Text style={[
                styles.featureText,
                isTablet && styles.featureTextTablet,
                isSelected && styles.selectedFeatureText
            ]}>
                {feature.name}
            </Text>
        </TouchableOpacity>
    );
});

export default function AvatarEditorScreen() {
    
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [savingAvatar, setSavingAvatar] = useState(false);
    const [isInitializing, setIsInitializing] = useState(true);
    const [renderingAvatar, setRenderingAvatar] = useState(false);
    const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    
    
    // Load user on mount
    React.useEffect(() => {
        const loadUser = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                setUser(user);
                if (user) {
                    // Load config first, then set initialization to false
                    await loadAvatarConfig(user.id);
                    // Add small delay to ensure avatar is fully loaded
                    setTimeout(() => {
                        setIsInitializing(false);
                    }, 100);
                } else {
                    setIsInitializing(false);
                }
            } catch (error) {
                console.error('Error during initialization:', error);
                setIsInitializing(false);
            }
        };
        loadUser();
    }, []);

    // Default avatar configuration - will be overridden once user data loads
    const defaultConfig: HumanAvatarConfig = {
        style: 'personas',
        backgroundColor: 'b6e3f4',
        skinColor: 'e5a07e',
        hairColor: '6c4545',
        hair: 'long',
        eyes: 'open',
        mouth: 'smile',
        nose: 'mediumRound',
        facialHair: 'none',
        body: 'rounded',
        clothingColor: '456dff',
    };
    
    const [, setAvatarConfig] = useState<HumanAvatarConfig>(defaultConfig);
    const [tempAvatarConfig, setTempAvatarConfig] = useState<HumanAvatarConfig>(defaultConfig);
    const [previewConfig, setPreviewConfig] = useState<HumanAvatarConfig>(defaultConfig);
    
    // Only 2 tabs: Colors and Features
    const tabs = useMemo(() => ['colors', 'features'] as const, []);
    const [activeTab, setActiveTab] = useState<'colors' | 'features'>('colors');
    const [isChangingTab, setIsChangingTab] = useState(false);
    
    
    // Debounced handlers to prevent excessive updates
    const handleColorChange = useCallback((type: string, value: string) => {
        setTempAvatarConfig(prev => ({ ...prev, [type]: value }));
    }, []);
    
    const handleFeatureChange = useCallback((type: string, value: string) => {
        setTempAvatarConfig(prev => ({ ...prev, [type]: value }));
    }, []);
    
    const handleTabChange = useCallback((tab: 'colors' | 'features') => {
        if (activeTab !== tab) {
            setIsChangingTab(true);
            setActiveTab(tab);
            // Quick tab transition
            setTimeout(() => {
                setIsChangingTab(false);
            }, 100);
        }
    }, [activeTab]);

    // Optimized preview updates using InteractionManager for better Android performance
    const updatePreview = useCallback((config: HumanAvatarConfig) => {
        // Clear any pending updates
        if (updateTimeoutRef.current) {
            clearTimeout(updateTimeoutRef.current);
        }
        
        // Use a minimal timeout to batch updates without blocking UI
        updateTimeoutRef.current = setTimeout(() => {
            setPreviewConfig(config);
            setRenderingAvatar(false);
        }, 50) as any; // Minimal delay to batch rapid updates
    }, []);

    useEffect(() => {
        if (!isInitializing) {
            setRenderingAvatar(true);
            updatePreview(tempAvatarConfig);
        }
    }, [tempAvatarConfig, isInitializing, updatePreview]);

    // Cleanup timeouts
    useEffect(() => {
        return () => {
            if (updateTimeoutRef.current) {
                clearTimeout(updateTimeoutRef.current);
            }
        };
    }, []);

    const loadAvatarConfig = async (userId: string) => {
        try {
            const { data, error } = await supabase
                .from('avatars')
                .select('avatar_config')
                .eq('user_id', userId)
                .single();

            if (data?.avatar_config && !error) {
                const config = data.avatar_config;
                // Don't merge with default to prevent glitch
                const cleanConfig = { ...config, style: 'personas' as AvatarStyle };
                
                // Update all configs simultaneously in a single batch to prevent flash
                React.startTransition(() => {
                    setAvatarConfig(cleanConfig);
                    setTempAvatarConfig(cleanConfig);
                    setPreviewConfig(cleanConfig);
                });
            } else {
                // If no saved config, use default but ensure all states are consistent
                React.startTransition(() => {
                    setAvatarConfig(defaultConfig);
                    setTempAvatarConfig(defaultConfig);
                    setPreviewConfig(defaultConfig);
                });
            }
        } catch (error) {
            console.error('Error loading avatar config:', error);
            // Fallback to default config on error
            React.startTransition(() => {
                setAvatarConfig(defaultConfig);
                setTempAvatarConfig(defaultConfig);
                setPreviewConfig(defaultConfig);
            });
        }
    };

    const saveAvatarConfig = async () => {
        if (!user) {
            return;
        }
        
        setSavingAvatar(true);
        try {
            // Single optimized database operation
            const { error } = await supabase
                .from('avatars')
                .upsert({
                    user_id: user.id,
                    avatar_config: tempAvatarConfig,
                    updated_at: new Date().toISOString()
                }, {
                    onConflict: 'user_id'
                });

            if (error) {
                Alert.alert('Error', `Failed to save avatar: ${error.message}`);
            } else {
                setAvatarConfig(tempAvatarConfig);
                // Navigate to profile page after saving
                try {
                    router.push('/(tabs)/profile');
                } catch (navError) {
                    console.error('Profile navigation error:', navError);
                }
            }
        } catch (error) {
            console.error('Save error:', error);
            Alert.alert('Error', 'Failed to save avatar');
        } finally {
            setSavingAvatar(false);
        }
    };

    const generateRandomAvatar = useCallback(() => {
        const randomConfig: HumanAvatarConfig = {
            style: 'personas',
            backgroundColor: BACKGROUND_COLORS[Math.floor(Math.random() * BACKGROUND_COLORS.length)].id,
            skinColor: SKIN_COLORS[Math.floor(Math.random() * SKIN_COLORS.length)].id,
            hairColor: HAIR_COLORS[Math.floor(Math.random() * HAIR_COLORS.length)].id,
            clothingColor: CLOTHING_COLORS[Math.floor(Math.random() * CLOTHING_COLORS.length)].id,
            hair: AVATAR_OPTIONS.hair[Math.floor(Math.random() * AVATAR_OPTIONS.hair.length)].id,
            eyes: AVATAR_OPTIONS.eyes[Math.floor(Math.random() * AVATAR_OPTIONS.eyes.length)].id,
            mouth: AVATAR_OPTIONS.mouth[Math.floor(Math.random() * AVATAR_OPTIONS.mouth.length)].id,
            nose: AVATAR_OPTIONS.nose[Math.floor(Math.random() * AVATAR_OPTIONS.nose.length)].id,
            facialHair: AVATAR_OPTIONS.facialHair[Math.floor(Math.random() * AVATAR_OPTIONS.facialHair.length)].id,
            body: AVATAR_OPTIONS.body[Math.floor(Math.random() * AVATAR_OPTIONS.body.length)].id,
        };
        
        setTempAvatarConfig({...randomConfig});
    }, []);

    return (
        <SafeAreaView style={styles.container}>
            <Stack.Screen options={{ 
                title: "Customize Avatar",
                headerTitleStyle: { fontSize: normalizeFont(22) }, // Adjust 20 to your desired size
                headerShown: true,
                headerLeft: () => (
                    Platform.OS === 'android' ? (
                        <View
                            onTouchStart={() => {
                                try {
                                    router.push('/(tabs)/profile');
                                } catch (error) {
                                    console.error('Profile navigation error:', error);
                                }
                            }}
                            onStartShouldSetResponder={() => true}
                            onResponderGrant={() => {
                                try {
                                    router.push('/(tabs)/profile');
                                } catch (error) {
                                    console.error('Profile navigation error:', error);
                                }
                            }}
                            style={styles.headerButton}
                        >
                            <Ionicons name="arrow-back" size={scale(24)} color="#2c3e50" />
                        </View>
                    ) : (
                        <TouchableOpacity 
                            onPress={() => {
                                try {
                                    router.push('/(tabs)/profile');
                                } catch (error) {
                                    console.error('Profile navigation error:', error);
                                }
                            }}
                            style={styles.headerButton}
                            activeOpacity={0.7}
                            hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                        >
                            <Ionicons name="arrow-back" size={scale(24)} color="#2c3e50" />
                        </TouchableOpacity>
                    )
                ),
            }} />

            {/* Avatar Preview */}
            <View style={styles.previewSection}>
                {isInitializing ? (
                    <View style={[styles.loadingContainer, { width: 140, height: 140, borderRadius: 70 }]}>
                        <ActivityIndicator size="large" color="#3498db" />
                    </View>
                ) : (
                    <View style={{ position: 'relative' }}>
                        <HumanAvatar
                            config={previewConfig}
                            size={140}
                            seed={`${user?.email || 'default'}`}
                        />
                        {renderingAvatar && (
                            <View style={[styles.avatarOverlay, { width: 140, height: 140, borderRadius: 70 }]}>
                                <ActivityIndicator size="small" color="#3498db" />
                            </View>
                        )}
                    </View>
                )}
            </View>

            {/* Tab Navigation */}
            <View style={styles.tabContainer}>
                {tabs.map((tab) => (
                    Platform.OS === 'android' ? (
                        <View
                            key={tab}
                            style={[styles.tab, activeTab === tab && styles.activeTab]}
                            onTouchStart={() => handleTabChange(tab)}
                            onStartShouldSetResponder={() => true}
                            onResponderGrant={() => handleTabChange(tab)}
                        >
                            <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
                                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                            </Text>
                        </View>
                    ) : (
                        <TouchableOpacity
                            key={tab}
                            style={[styles.tab, activeTab === tab && styles.activeTab]}
                            onPress={() => handleTabChange(tab)}
                            activeOpacity={0.7}
                        >
                            <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
                                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                            </Text>
                        </TouchableOpacity>
                    )
                ))}
            </View>

            <ScrollView 
                style={styles.optionsContainer} 
                showsVerticalScrollIndicator={false}
                scrollEnabled={!isChangingTab}
                keyboardShouldPersistTaps="handled"
                removeClippedSubviews={true}
                nestedScrollEnabled={true}
                scrollEventThrottle={16}
                decelerationRate="fast"
                bounces={false}
                overScrollMode="never"
                {...(Platform.OS === 'android' && {
                    pagingEnabled: false,
                    directionalLockEnabled: true,
                    scrollsToTop: false,
                    automaticallyAdjustContentInsets: false,
                    contentInsetAdjustmentBehavior: 'never'
                })}
                onScrollBeginDrag={() => {
                    // Emergency fix: prevent gesture conflicts
                    if (Platform.OS === 'android') {
                        setIsChangingTab(false);
                    }
                }}
            >
                {/* Colors Tab */}
                {(() => {
                    if (activeTab === 'colors' && !isChangingTab && !isInitializing) {
                        return (
                            <View style={styles.optionSection}>
                                <Text style={styles.optionLabel}>Background</Text>
                                <View style={styles.colorGrid}>
                                    {BACKGROUND_COLORS.map((color) => (
                                        <ColorOption
                                            key={color.id}
                                            color={color}
                                            isSelected={tempAvatarConfig.backgroundColor === color.id}
                                            onPress={() => handleColorChange('backgroundColor', color.id)}
                                            checkColor="#fff"
                                        />
                                    ))}
                                </View>

                                <Text style={styles.optionLabel}>Skin Tone</Text>
                                <View style={styles.colorGrid}>
                                    {SKIN_COLORS.map((color) => (
                                        <ColorOption
                                            key={color.id}
                                            color={color}
                                            isSelected={tempAvatarConfig.skinColor === color.id}
                                            onPress={() => handleColorChange('skinColor', color.id)}
                                            checkColor="#333"
                                        />
                                    ))}
                                </View>

                                <Text style={styles.optionLabel}>Hair Color</Text>
                                <View style={styles.colorGrid}>
                                    {HAIR_COLORS.map((color) => (
                                        <ColorOption
                                            key={color.id}
                                            color={color}
                                            isSelected={tempAvatarConfig.hairColor === color.id}
                                            onPress={() => handleColorChange('hairColor', color.id)}
                                            checkColor="#fff"
                                        />
                                    ))}
                                </View>

                                <Text style={styles.optionLabel}>Clothing Color</Text>
                                <View style={styles.colorGrid}>
                                    {CLOTHING_COLORS.map((color) => (
                                        <ColorOption
                                            key={color.id}
                                            color={color}
                                            isSelected={tempAvatarConfig.clothingColor === color.id}
                                            onPress={() => handleColorChange('clothingColor', color.id)}
                                            checkColor="#fff"
                                        />
                                    ))}
                                </View>
                            </View>
                        );
                    } else {
                        return null;
                    }
                })()}

                {/* Features Tab */}
                {(() => {
                    if (activeTab === 'features' && !isChangingTab && !isInitializing) {
                        return (
                            <View style={styles.optionSection}>
                                <Text style={styles.optionSectionTitle}>Customize Features</Text>
                                
                                <Text style={styles.optionLabel}>Hair Style</Text>
                                <View style={styles.featureGrid}>
                                    {AVATAR_OPTIONS.hair.map((hair) => (
                                        <FeatureOption
                                            key={hair.id}
                                            feature={hair}
                                            isSelected={tempAvatarConfig.hair === hair.id}
                                            onPress={() => handleFeatureChange('hair', hair.id)}
                                        />
                                    ))}
                                </View>

                                <Text style={styles.optionLabel}>Eyes</Text>
                                <View style={styles.featureGrid}>
                                    {AVATAR_OPTIONS.eyes.map((eye) => (
                                        <FeatureOption
                                            key={eye.id}
                                            feature={eye}
                                            isSelected={tempAvatarConfig.eyes === eye.id}
                                            onPress={() => handleFeatureChange('eyes', eye.id)}
                                        />
                                    ))}
                                </View>

                                <Text style={styles.optionLabel}>Mouth</Text>
                                <View style={styles.featureGrid}>
                                    {AVATAR_OPTIONS.mouth.map((mouth) => (
                                        <FeatureOption
                                            key={mouth.id}
                                            feature={mouth}
                                            isSelected={tempAvatarConfig.mouth === mouth.id}
                                            onPress={() => handleFeatureChange('mouth', mouth.id)}
                                        />
                                    ))}
                                </View>

                                <Text style={styles.optionLabel}>Nose</Text>
                                <View style={styles.featureGrid}>
                                    {AVATAR_OPTIONS.nose.map((nose) => (
                                        <FeatureOption
                                            key={nose.id}
                                            feature={nose}
                                            isSelected={tempAvatarConfig.nose === nose.id}
                                            onPress={() => handleFeatureChange('nose', nose.id)}
                                        />
                                    ))}
                                </View>

                                <Text style={styles.optionLabel}>Facial Hair</Text>
                                <View style={styles.featureGrid}>
                                    {AVATAR_OPTIONS.facialHair.map((facialHair) => (
                                        <FeatureOption
                                            key={facialHair.id}
                                            feature={facialHair}
                                            isSelected={tempAvatarConfig.facialHair === facialHair.id}
                                            onPress={() => handleFeatureChange('facialHair', facialHair.id)}
                                        />
                                    ))}
                                </View>

                                <Text style={styles.optionLabel}>Clothing Style</Text>
                                <View style={styles.featureGrid}>
                                    {AVATAR_OPTIONS.body.map((body) => (
                                        <FeatureOption
                                            key={body.id}
                                            feature={body}
                                            isSelected={tempAvatarConfig.body === body.id}
                                            onPress={() => handleFeatureChange('body', body.id)}
                                        />
                                    ))}
                                </View>
                            </View>
                        );
                    } else {
                        return null;
                    }
                })()}
            </ScrollView>

            {/* Action Buttons */}
            <View style={styles.actionButtons}>
                {Platform.OS === 'android' ? (
                    <View
                        style={[
                            styles.randomButton, 
                            isTablet && styles.randomButtonTablet
                        ]}
                        onTouchStart={generateRandomAvatar}
                        onStartShouldSetResponder={() => true}
                        onResponderGrant={generateRandomAvatar}
                    >
                        <Ionicons name="shuffle" size={scale(20)} color="#fff" />
                        <Text style={styles.randomButtonText}>Random</Text>
                    </View>
                ) : (
                    <TouchableOpacity
                        style={[styles.randomButton, isTablet && styles.randomButtonTablet]}
                        onPress={generateRandomAvatar}
                        hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="shuffle" size={scale(20)} color="#fff" />
                        <Text style={styles.randomButtonText}>Random</Text>
                    </TouchableOpacity>
                )}

                {Platform.OS === 'android' ? (
                    <View
                        style={[
                            styles.saveButton, 
                            savingAvatar && styles.disabledButton
                        ]}
                        onTouchStart={savingAvatar ? undefined : saveAvatarConfig}
                        onStartShouldSetResponder={() => !savingAvatar}
                        onResponderGrant={savingAvatar ? undefined : saveAvatarConfig}
                    >
                        {savingAvatar ? (
                            <>
                                <ActivityIndicator size="small" color="#fff" style={{ marginRight: 8 }} />
                                <Text style={styles.saveButtonText}>Saving...</Text>
                            </>
                        ) : (
                            <>
                                <Ionicons name="checkmark" size={scale(20)} color="#fff" />
                                <Text style={styles.saveButtonText}>Save Avatar</Text>
                            </>
                        )}
                    </View>
                ) : (
                    <TouchableOpacity
                        style={[styles.saveButton, savingAvatar && styles.disabledButton]}
                        onPress={saveAvatarConfig}
                        disabled={savingAvatar}
                        activeOpacity={0.8}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        {savingAvatar ? (
                            <>
                                <ActivityIndicator size="small" color="#fff" style={{ marginRight: 8 }} />
                                <Text style={styles.saveButtonText}>Saving...</Text>
                            </>
                        ) : (
                            <>
                                <Ionicons name="checkmark" size={scale(20)} color="#fff" />
                                <Text style={styles.saveButtonText}>Save Avatar</Text>
                            </>
                        )}
                    </TouchableOpacity>
                )}
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f9fa',
    },
    headerButton: {
        padding: scale(8),
    },
    previewSection: {
        alignItems: 'center',
        paddingVertical: isTablet ? scale(20) : scale(15),
        backgroundColor: 'white',
        marginBottom: scale(1),
        position: 'relative',
    },
    loadingOverlay: {
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: [{ translateX: -50 }, { translateY: -50 }],
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        padding: scale(10),
        borderRadius: scale(8),
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: scale(2) },
        shadowOpacity: 0.1,
        shadowRadius: scale(4),
    },
    loadingText: {
        fontSize: normalizeFont(12),
        color: '#3498db',
        marginTop: scale(5),
        fontWeight: '500',
    },
    loadingContainer: {
        backgroundColor: '#f8f9fa',
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        backgroundColor: 'rgba(248, 249, 250, 0.8)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1,
    },
    tabContainer: {
        flexDirection: 'row',
        backgroundColor: 'white',
        borderBottomWidth: scale(1),
        borderBottomColor: '#f0f0f0',
        paddingHorizontal: isTablet ? scale(40) : scale(20),
        justifyContent: 'center',
    },
    tab: {
        paddingHorizontal: isTablet ? scale(30) : scale(20),
        paddingVertical: isTablet ? scale(15) : scale(12),
        marginHorizontal: isTablet ? scale(10) : scale(5),
    },
    activeTab: {
        borderBottomWidth: scale(3),
        borderBottomColor: '#3498db',
    },
    tabText: {
        fontSize: normalizeFont(14),
        color: '#7f8c8d',
        fontWeight: '500',
    },
    activeTabText: {
        color: '#3498db',
        fontWeight: '600',
    },
    optionsContainer: {
        flex: 1,
        backgroundColor: '#f8f9fa',
        paddingHorizontal: isTablet ? scale(40) : scale(20),
        paddingTop: isTablet ? scale(15) : scale(10),
    },
    optionSection: {
        paddingBottom: isTablet ? scale(20) : scale(15),
    },
    optionSectionTitle: {
        fontSize: normalizeFont(16),
        fontWeight: '600',
        color: '#2c3e50',
        marginBottom: scale(15),
    },
    optionLabel: {
        fontSize: isTablet ? normalizeFont(16) : normalizeFont(14),
        fontWeight: '600',
        color: '#2c3e50',
        marginBottom: isTablet ? scale(15) : scale(10),
        marginTop: isTablet ? scale(20) : scale(15),
    },
    colorGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginBottom: isTablet ? scale(20) : scale(10),
        justifyContent: isTablet ? 'flex-start' : 'flex-start',
    },
    colorOption: {
        width: isTablet ? scale(60) : scale(45),
        height: isTablet ? scale(60) : scale(45),
        borderRadius: isTablet ? scale(30) : scale(22.5),
        margin: isTablet ? scale(8) : scale(5),
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: scale(3),
        borderColor: 'transparent',
        // Android performance optimizations
        ...(Platform.OS === 'android' && {
            elevation: 0,
            shadowColor: 'transparent',
            renderToHardwareTextureAndroid: true,
            shouldRasterizeIOS: false,
            needsOffscreenAlphaCompositing: false,
        }),
    },
    colorOptionTablet: {
        width: scale(60),
        height: scale(60),
        borderRadius: scale(30),
        margin: scale(8),
    },
    selectedColorOption: {
        borderColor: '#2c3e50',
    },
    featureGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginBottom: isTablet ? scale(25) : scale(15),
        justifyContent: 'flex-start',
    },
    featureButton: {
        backgroundColor: '#f8f9fa',
        borderRadius: isTablet ? scale(16) : scale(12),
        paddingHorizontal: isTablet ? scale(16) : scale(12),
        paddingVertical: isTablet ? scale(12) : scale(8),
        marginRight: isTablet ? scale(12) : scale(8),
        marginBottom: isTablet ? scale(12) : scale(8),
        borderWidth: scale(2),
        borderColor: 'transparent',
        minWidth: isTablet ? scale(120) : scale(80),
        // Android performance optimizations
        ...(Platform.OS === 'android' && {
            elevation: 0,
            shadowColor: 'transparent',
            renderToHardwareTextureAndroid: true,
            shouldRasterizeIOS: false,
            needsOffscreenAlphaCompositing: false,
        }),
    },
    featureButtonTablet: {
        borderRadius: scale(16),
        paddingHorizontal: scale(16),
        paddingVertical: scale(12),
        marginRight: scale(12),
        marginBottom: scale(12),
        minWidth: scale(120),
    },
    selectedFeature: {
        backgroundColor: '#3498db',
        borderColor: '#2980b9',
    },
    featureText: {
        fontSize: isTablet ? normalizeFont(15) : normalizeFont(13),
        color: '#2c3e50',
        fontWeight: '500',
        textAlign: 'center',
    },
    featureTextTablet: {
        fontSize: normalizeFont(15),
    },
    selectedFeatureText: {
        color: 'white',
        fontWeight: '600',
    },
    actionButtons: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: isTablet ? scale(40) : scale(20),
        paddingVertical: isTablet ? scale(30) : scale(20),
        backgroundColor: 'white',
        borderTopWidth: scale(1),
        borderTopColor: '#f0f0f0',
        paddingBottom: isTablet ? scale(60) : scale(50),
        paddingTop: isTablet ? scale(20) : scale(15),
    },
    randomButton: {
        backgroundColor: '#9b59b6',
        padding: isTablet ? scale(20) : scale(15),
        borderRadius: isTablet ? scale(16) : scale(12),
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        flex: 0.48,
    },
    randomButtonTablet: {
        padding: scale(20),
        borderRadius: scale(16),
    },
    randomButtonText: {
        color: 'white',
        fontSize: normalizeFont(14),
        fontWeight: '600',
        marginLeft: scale(6),
    },
    saveButton: {
        backgroundColor: '#27ae60',
        padding: scale(15),
        borderRadius: scale(12),
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        flex: 0.48,
    },
    disabledButton: {
        backgroundColor: '#95a5a6',
    },
    saveButtonText: {
        color: 'white',
        fontSize: normalizeFont(14),
        fontWeight: '600',
        marginLeft: scale(6),
    },
});