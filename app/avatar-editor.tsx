import React, { useState, useCallback, useMemo, useEffect } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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

const { width, height } = Dimensions.get('window');
const isTablet = width > 768;

export default function AvatarEditorScreen() {
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [savingAvatar, setSavingAvatar] = useState(false);
    
    // Load user on mount
    React.useEffect(() => {
        const loadUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            setUser(user);
            if (user) {
                loadAvatarConfig(user.id);
            }
        };
        loadUser();
    }, []);

    // Default avatar configuration
    const [avatarConfig, setAvatarConfig] = useState<HumanAvatarConfig>({
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
    });
    
    const [tempAvatarConfig, setTempAvatarConfig] = useState<HumanAvatarConfig>(avatarConfig);
    const [previewConfig, setPreviewConfig] = useState<HumanAvatarConfig>(avatarConfig);
    
    // Only 2 tabs: Colors and Features
    const tabs = ['colors', 'features'] as const;
    const [activeTab, setActiveTab] = useState<'colors' | 'features'>('colors');

    // Much faster debounce for better UX
    useEffect(() => {
        const timer = setTimeout(() => {
            setPreviewConfig(tempAvatarConfig);
        }, 100); // Reduced to 100ms for faster response

        return () => clearTimeout(timer);
    }, [tempAvatarConfig]);

    const loadAvatarConfig = async (userId: string) => {
        try {
            const { data, error } = await supabase
                .from('avatars')
                .select('avatar_config')
                .eq('user_id', userId)
                .single();

            if (data?.avatar_config && !error) {
                const config = data.avatar_config;
                const cleanConfig = { ...avatarConfig, ...config, style: 'personas' as AvatarStyle };
                setAvatarConfig(cleanConfig);
                setTempAvatarConfig(cleanConfig);
                setPreviewConfig(cleanConfig);
            }
        } catch (error) {
            console.error('Error loading avatar config:', error);
        }
    };

    const saveAvatarConfig = async () => {
        if (!user) return;
        
        setSavingAvatar(true);
        try {
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
                console.error('Error saving avatar:', error);
                Alert.alert('Error', `Failed to save avatar: ${error.message}`);
            } else {
                setAvatarConfig(tempAvatarConfig);
                Alert.alert('Success', 'Avatar saved successfully!', [
                    { text: 'OK', onPress: () => router.back() }
                ]);
            }
        } catch (error) {
            console.error('Error saving avatar:', error);
            Alert.alert('Error', 'Failed to save avatar');
        } finally {
            setSavingAvatar(false);
        }
    };

    const generateRandomAvatar = () => {
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
    };

    return (
        <SafeAreaView style={styles.container}>
            <Stack.Screen options={{ 
                title: "Customize Avatar",
                headerShown: true,
                headerLeft: () => (
                    <TouchableOpacity 
                        onPress={() => router.back()}
                        style={styles.headerButton}
                    >
                        <Ionicons name="arrow-back" size={24} color="#2c3e50" />
                    </TouchableOpacity>
                ),
            }} />

            {/* Avatar Preview */}
            <View style={styles.previewSection}>
                <HumanAvatar
                    config={previewConfig}
                    size={140}
                    seed={`${user?.email || 'default'}-${JSON.stringify(previewConfig)}`}
                />
                {/* Show loading indicator when preview is updating */}
                {JSON.stringify(tempAvatarConfig) !== JSON.stringify(previewConfig) && (
                    <View style={styles.loadingOverlay}>
                        <ActivityIndicator size="small" color="#3498db" />
                        <Text style={styles.loadingText}>Updating preview...</Text>
                    </View>
                )}
            </View>

            {/* Tab Navigation */}
            <View style={styles.tabContainer}>
                {tabs.map((tab) => (
                    <TouchableOpacity
                        key={tab}
                        style={[styles.tab, activeTab === tab && styles.activeTab]}
                        onPress={() => setActiveTab(tab)}
                    >
                        <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
                            {tab.charAt(0).toUpperCase() + tab.slice(1)}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            <ScrollView style={styles.optionsContainer} showsVerticalScrollIndicator={false}>
                {/* Colors Tab */}
                {activeTab === 'colors' && (
                    <View style={styles.optionSection}>
                        <Text style={styles.optionLabel}>Background</Text>
                        <View style={styles.colorGrid}>
                            {BACKGROUND_COLORS.map((color) => (
                                <TouchableOpacity
                                    key={color.id}
                                    style={[
                                        styles.colorOption,
                                        isTablet && styles.colorOptionTablet,
                                        { backgroundColor: color.hex },
                                        tempAvatarConfig.backgroundColor === color.id && styles.selectedColorOption
                                    ]}
                                    onPress={() => {
                                        console.log('Background color pressed:', color.id);
                                        setTempAvatarConfig(prev => ({ ...prev, backgroundColor: color.id }));
                                    }}
                                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                    activeOpacity={0.7}
                                >
                                    {tempAvatarConfig.backgroundColor === color.id && (
                                        <Ionicons name="checkmark" size={20} color="#fff" />
                                    )}
                                </TouchableOpacity>
                            ))}
                        </View>

                        <Text style={styles.optionLabel}>Skin Tone</Text>
                        <View style={styles.colorGrid}>
                            {SKIN_COLORS.map((color) => (
                                <TouchableOpacity
                                    key={color.id}
                                    style={[
                                        styles.colorOption,
                                        isTablet && styles.colorOptionTablet,
                                        { backgroundColor: color.hex },
                                        tempAvatarConfig.skinColor === color.id && styles.selectedColorOption
                                    ]}
                                    onPress={() => {
                                        console.log('Skin color pressed:', color.id);
                                        setTempAvatarConfig(prev => ({ ...prev, skinColor: color.id }));
                                    }}
                                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                    activeOpacity={0.7}
                                >
                                    {tempAvatarConfig.skinColor === color.id && (
                                        <Ionicons name="checkmark" size={20} color="#333" />
                                    )}
                                </TouchableOpacity>
                            ))}
                        </View>

                        <Text style={styles.optionLabel}>Hair Color</Text>
                        <View style={styles.colorGrid}>
                            {HAIR_COLORS.map((color) => (
                                <TouchableOpacity
                                    key={color.id}
                                    style={[
                                        styles.colorOption,
                                        isTablet && styles.colorOptionTablet,
                                        { backgroundColor: color.hex },
                                        tempAvatarConfig.hairColor === color.id && styles.selectedColorOption
                                    ]}
                                    onPress={() => {
                                        console.log('Hair color pressed:', color.id);
                                        setTempAvatarConfig(prev => ({ ...prev, hairColor: color.id }));
                                    }}
                                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                    activeOpacity={0.7}
                                >
                                    {tempAvatarConfig.hairColor === color.id && (
                                        <Ionicons name="checkmark" size={20} color="#fff" />
                                    )}
                                </TouchableOpacity>
                            ))}
                        </View>

                        <Text style={styles.optionLabel}>Clothing Color</Text>
                        <View style={styles.colorGrid}>
                            {CLOTHING_COLORS.map((color) => (
                                <TouchableOpacity
                                    key={color.id}
                                    style={[
                                        styles.colorOption,
                                        isTablet && styles.colorOptionTablet,
                                        { backgroundColor: color.hex },
                                        tempAvatarConfig.clothingColor === color.id && styles.selectedColorOption
                                    ]}
                                    onPress={() => {
                                        console.log('Clothing color pressed:', color.id);
                                        setTempAvatarConfig(prev => ({ ...prev, clothingColor: color.id }));
                                    }}
                                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                    activeOpacity={0.7}
                                >
                                    {tempAvatarConfig.clothingColor === color.id && (
                                        <Ionicons name="checkmark" size={20} color="#fff" />
                                    )}
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                )}

                {/* Features Tab */}
                {activeTab === 'features' && (
                    <View style={styles.optionSection}>
                        <Text style={styles.optionSectionTitle}>Customize Features</Text>
                        
                        <Text style={styles.optionLabel}>Hair Style</Text>
                        <View style={styles.featureGrid}>
                            {AVATAR_OPTIONS.hair.map((hair) => (
                                <TouchableOpacity
                                    key={hair.id}
                                    style={[
                                        styles.featureButton,
                                        isTablet && styles.featureButtonTablet,
                                        tempAvatarConfig.hair === hair.id && styles.selectedFeature
                                    ]}
                                    onPress={() => {
                                        console.log('Hair feature pressed:', hair.id);
                                        setTempAvatarConfig(prev => ({ ...prev, hair: hair.id }));
                                    }}
                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                    activeOpacity={0.7}
                                >
                                    <Text style={[
                                        styles.featureText,
                                        isTablet && styles.featureTextTablet,
                                        tempAvatarConfig.hair === hair.id && styles.selectedFeatureText
                                    ]}>
                                        {hair.name}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <Text style={styles.optionLabel}>Eyes</Text>
                        <View style={styles.featureGrid}>
                            {AVATAR_OPTIONS.eyes.map((eye) => (
                                <TouchableOpacity
                                    key={eye.id}
                                    style={[
                                        styles.featureButton,
                                        isTablet && styles.featureButtonTablet,
                                        tempAvatarConfig.eyes === eye.id && styles.selectedFeature
                                    ]}
                                    onPress={() => {
                                        console.log('Eyes feature pressed:', eye.id);
                                        setTempAvatarConfig(prev => ({ ...prev, eyes: eye.id }));
                                    }}
                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                    activeOpacity={0.7}
                                >
                                    <Text style={[
                                        styles.featureText,
                                        isTablet && styles.featureTextTablet,
                                        tempAvatarConfig.eyes === eye.id && styles.selectedFeatureText
                                    ]}>
                                        {eye.name}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <Text style={styles.optionLabel}>Mouth</Text>
                        <View style={styles.featureGrid}>
                            {AVATAR_OPTIONS.mouth.map((mouth) => (
                                <TouchableOpacity
                                    key={mouth.id}
                                    style={[
                                        styles.featureButton,
                                        isTablet && styles.featureButtonTablet,
                                        tempAvatarConfig.mouth === mouth.id && styles.selectedFeature
                                    ]}
                                    onPress={() => {
                                        console.log('Mouth feature pressed:', mouth.id);
                                        setTempAvatarConfig(prev => ({ ...prev, mouth: mouth.id }));
                                    }}
                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                    activeOpacity={0.7}
                                >
                                    <Text style={[
                                        styles.featureText,
                                        isTablet && styles.featureTextTablet,
                                        tempAvatarConfig.mouth === mouth.id && styles.selectedFeatureText
                                    ]}>
                                        {mouth.name}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <Text style={styles.optionLabel}>Nose</Text>
                        <View style={styles.featureGrid}>
                            {AVATAR_OPTIONS.nose.map((nose) => (
                                <TouchableOpacity
                                    key={nose.id}
                                    style={[
                                        styles.featureButton,
                                        isTablet && styles.featureButtonTablet,
                                        tempAvatarConfig.nose === nose.id && styles.selectedFeature
                                    ]}
                                    onPress={() => {
                                        console.log('Nose feature pressed:', nose.id);
                                        setTempAvatarConfig(prev => ({ ...prev, nose: nose.id }));
                                    }}
                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                    activeOpacity={0.7}
                                >
                                    <Text style={[
                                        styles.featureText,
                                        isTablet && styles.featureTextTablet,
                                        tempAvatarConfig.nose === nose.id && styles.selectedFeatureText
                                    ]}>
                                        {nose.name}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <Text style={styles.optionLabel}>Facial Hair</Text>
                        <View style={styles.featureGrid}>
                            {AVATAR_OPTIONS.facialHair.map((facialHair) => (
                                <TouchableOpacity
                                    key={facialHair.id}
                                    style={[
                                        styles.featureButton,
                                        isTablet && styles.featureButtonTablet,
                                        tempAvatarConfig.facialHair === facialHair.id && styles.selectedFeature
                                    ]}
                                    onPress={() => {
                                        console.log('Facial hair feature pressed:', facialHair.id);
                                        setTempAvatarConfig(prev => ({ ...prev, facialHair: facialHair.id }));
                                    }}
                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                    activeOpacity={0.7}
                                >
                                    <Text style={[
                                        styles.featureText,
                                        isTablet && styles.featureTextTablet,
                                        tempAvatarConfig.facialHair === facialHair.id && styles.selectedFeatureText
                                    ]}>
                                        {facialHair.name}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <Text style={styles.optionLabel}>Clothing Style</Text>
                        <View style={styles.featureGrid}>
                            {AVATAR_OPTIONS.body.map((body) => (
                                <TouchableOpacity
                                    key={body.id}
                                    style={[
                                        styles.featureButton,
                                        isTablet && styles.featureButtonTablet,
                                        tempAvatarConfig.body === body.id && styles.selectedFeature
                                    ]}
                                    onPress={() => {
                                        console.log('Body feature pressed:', body.id);
                                        setTempAvatarConfig(prev => ({ ...prev, body: body.id }));
                                    }}
                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                    activeOpacity={0.7}
                                >
                                    <Text style={[
                                        styles.featureText,
                                        isTablet && styles.featureTextTablet,
                                        tempAvatarConfig.body === body.id && styles.selectedFeatureText
                                    ]}>
                                        {body.name}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                )}
            </ScrollView>

            {/* Action Buttons */}
            <View style={styles.actionButtons}>
                <TouchableOpacity
                    style={[styles.randomButton, isTablet && styles.randomButtonTablet]}
                    onPress={() => {
                        console.log('Random button pressed');
                        generateRandomAvatar();
                    }}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    activeOpacity={0.8}
                >
                    <Ionicons name="shuffle" size={20} color="#fff" />
                    <Text style={styles.randomButtonText}>Random</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.saveButton, savingAvatar && styles.disabledButton]}
                    onPress={saveAvatarConfig}
                    disabled={savingAvatar}
                >
                    {savingAvatar ? (
                        <>
                            <ActivityIndicator size="small" color="#fff" style={{ marginRight: 8 }} />
                            <Text style={styles.saveButtonText}>Saving...</Text>
                        </>
                    ) : (
                        <>
                            <Ionicons name="checkmark" size={20} color="#fff" />
                            <Text style={styles.saveButtonText}>Save Avatar</Text>
                        </>
                    )}
                </TouchableOpacity>
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
        padding: 8,
    },
    previewSection: {
        alignItems: 'center',
        paddingVertical: isTablet ? 20 : 15,
        backgroundColor: 'white',
        marginBottom: 1,
        position: 'relative',
    },
    loadingOverlay: {
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: [{ translateX: -50 }, { translateY: -50 }],
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        padding: 10,
        borderRadius: 8,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    loadingText: {
        fontSize: 12,
        color: '#3498db',
        marginTop: 5,
        fontWeight: '500',
    },
    tabContainer: {
        flexDirection: 'row',
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
        paddingHorizontal: isTablet ? 40 : 20,
        justifyContent: 'center',
    },
    tab: {
        paddingHorizontal: isTablet ? 30 : 20,
        paddingVertical: isTablet ? 15 : 12,
        marginHorizontal: isTablet ? 10 : 5,
    },
    activeTab: {
        borderBottomWidth: 3,
        borderBottomColor: '#3498db',
    },
    tabText: {
        fontSize: 14,
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
        paddingHorizontal: isTablet ? 40 : 20,
        paddingTop: isTablet ? 15 : 10,
    },
    optionSection: {
        paddingBottom: isTablet ? 20 : 15,
    },
    optionSectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#2c3e50',
        marginBottom: 15,
    },
    optionLabel: {
        fontSize: isTablet ? 16 : 14,
        fontWeight: '600',
        color: '#2c3e50',
        marginBottom: isTablet ? 15 : 10,
        marginTop: isTablet ? 20 : 15,
    },
    colorGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginBottom: isTablet ? 20 : 10,
        justifyContent: isTablet ? 'flex-start' : 'flex-start',
    },
    colorOption: {
        width: isTablet ? 60 : 45,
        height: isTablet ? 60 : 45,
        borderRadius: isTablet ? 30 : 22.5,
        margin: isTablet ? 8 : 5,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3,
        borderColor: 'transparent',
    },
    colorOptionTablet: {
        width: 60,
        height: 60,
        borderRadius: 30,
        margin: 8,
    },
    selectedColorOption: {
        borderColor: '#2c3e50',
    },
    featureGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginBottom: isTablet ? 25 : 15,
        justifyContent: 'flex-start',
    },
    featureButton: {
        backgroundColor: '#f8f9fa',
        borderRadius: isTablet ? 16 : 12,
        paddingHorizontal: isTablet ? 16 : 12,
        paddingVertical: isTablet ? 12 : 8,
        marginRight: isTablet ? 12 : 8,
        marginBottom: isTablet ? 12 : 8,
        borderWidth: 2,
        borderColor: 'transparent',
        minWidth: isTablet ? 120 : 80,
    },
    featureButtonTablet: {
        borderRadius: 16,
        paddingHorizontal: 16,
        paddingVertical: 12,
        marginRight: 12,
        marginBottom: 12,
        minWidth: 120,
    },
    selectedFeature: {
        backgroundColor: '#3498db',
        borderColor: '#2980b9',
    },
    featureText: {
        fontSize: isTablet ? 15 : 13,
        color: '#2c3e50',
        fontWeight: '500',
        textAlign: 'center',
    },
    featureTextTablet: {
        fontSize: 15,
    },
    selectedFeatureText: {
        color: 'white',
        fontWeight: '600',
    },
    actionButtons: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: isTablet ? 40 : 20,
        paddingVertical: isTablet ? 30 : 20,
        backgroundColor: 'white',
        borderTopWidth: 1,
        borderTopColor: '#f0f0f0',
    },
    randomButton: {
        backgroundColor: '#9b59b6',
        padding: isTablet ? 20 : 15,
        borderRadius: isTablet ? 16 : 12,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        flex: 0.48,
    },
    randomButtonTablet: {
        padding: 20,
        borderRadius: 16,
    },
    randomButtonText: {
        color: 'white',
        fontSize: 14,
        fontWeight: '600',
        marginLeft: 6,
    },
    saveButton: {
        backgroundColor: '#27ae60',
        padding: 15,
        borderRadius: 12,
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
        fontSize: 14,
        fontWeight: '600',
        marginLeft: 6,
    },
});