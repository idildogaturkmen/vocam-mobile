import LogoutButton from '../../components/Auth/Logout';
import MicrophoneTest from '../../src/components/MicrophoneTest';
import { Text, View, StyleSheet, ScrollView } from 'react-native';

export default function SettingsScreen() {
    return (
        <ScrollView style={styles.container}>
            <View style={styles.content}>
                <Text style={styles.title}>Settings</Text>
                
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Audio & Microphone</Text>
                    <Text style={styles.sectionDescription}>
                        Test your microphone to ensure voice recording works properly for pronunciation practice.
                    </Text>
                    <MicrophoneTest style={styles.micTest} />
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Account</Text>
                    <LogoutButton />
                </View>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    content: {
        padding: 20,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        marginBottom: 15,
        textAlign: 'center',
        marginTop: 40,
        color: '#333',
    },
    section: {
        backgroundColor: 'white',
        borderRadius: 12,
        padding: 20,
        marginBottom: 20,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 3.84,
        elevation: 5,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 8,
        color: '#333',
    },
    sectionDescription: {
        fontSize: 14,
        color: '#666',
        marginBottom: 16,
        lineHeight: 20,
    },
    micTest: {
        marginTop: 8,
    },
});
