import { supabase } from '@/database/config';
import { Button } from '@rneui/base';
import { useRouter } from 'expo-router';
import { Alert, View } from 'react-native';

export default function LogoutButton(): React.ReactElement {
    const router = useRouter();

    const handleLogout = async () => {
        const { error } = await supabase.auth.signOut({ scope: 'local' });

        if (error) {
            console.error('Logout failed:', error.message);
            return;
        }

        router.replace('/App');
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
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
            <Button
                title="Logout"
                onPress={confirmLogout}
                buttonStyle={{ backgroundColor: 'red', paddingHorizontal: 24 }}
            />
        </View>
    );
}
