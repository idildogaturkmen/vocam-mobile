import { supabase } from '@/database/config';
import { Button } from 'react-native-elements';
import { useRouter } from 'expo-router';
import { Alert, View } from 'react-native';
import { scale, normalizeFont } from '../../utils/normalize';

export default function LogoutButton(): React.ReactElement {
    const router = useRouter();

    const handleLogout = async () => {
        const { error } = await supabase.auth.signOut();

        if (error) {
            console.error('Logout failed:', error.message);
            return;
        }

        // No need to navigate - the auth state change will automatically show the login screen
    };

    const confirmLogout = async () => {
        Alert.alert(
            'Confirm Logout',
            'Are you sure you want to log out?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Logout',
                    style: 'destructive',
                    onPress: () => {
                        handleLogout();
                    },
                },
            ],
            { cancelable: true },
        );
    };

    return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: scale(20) }}>
            <Button
                title="Logout"
                onPress={confirmLogout}
                buttonStyle={{ backgroundColor: 'red', paddingHorizontal: scale(24), paddingVertical: scale(12) }}
                titleStyle={{ fontSize: normalizeFont(16) }}
            />
        </View>
    );
}
