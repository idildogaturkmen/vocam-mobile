import { supabase } from '@/database/config';
import { Button } from '@rneui/base';
import { useRouter } from 'expo-router';
import { Alert, View } from 'react-native';
import { useTranslation } from 'react-i18next';

export default function LogoutButton(): React.ReactElement {
    const { t } = useTranslation();
    const router = useRouter();

    const handleLogout = async () => {
        const { error } = await supabase.auth.signOut();

        if (error) {
            console.error('Logout failed:', error.message);
            return;
        }

        router.replace('/');
    };

    const confirmLogout = async () => {
        Alert.alert(
            t('auth.confirmLogout'),
            t('auth.logoutMessage'),
            [
                { text: t('common.cancel'), style: 'cancel' },
                {
                    text: t('auth.logout'),
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
                title={t('auth.logout')}
                onPress={confirmLogout}
                buttonStyle={{ backgroundColor: 'red', paddingHorizontal: 24 }}
            />
        </View>
    );
}
