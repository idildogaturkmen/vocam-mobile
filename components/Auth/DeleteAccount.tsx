import { useState } from 'react';
import { Button } from 'react-native-elements';
import { View, Alert } from 'react-native';
import { AccountService } from '../../src/services/AccountService';

export default function DeleteAccountButton(): React.ReactElement {
    const [isDeleting, setIsDeleting] = useState(false);
    
    const handleDeleteAccount = async () => {
        if (isDeleting) {
            return; // Prevent multiple deletion attempts
        }
        
        setIsDeleting(true);
        try {
            await AccountService.confirmAndDeleteAccount();
            // The AccountService handles sign out and the auth state change
            // will automatically show the login screen - no manual navigation needed
        } catch (error) {
            console.error('Delete account failed:', error);
            // Only show error if it's not "user already deleted"
            if (!(error as any)?.message?.includes('No authenticated user found')) {
                Alert.alert('Error', 'Failed to delete account. Please try again or contact support.');
            }
            // If user was already deleted, the auth state change will handle the UI
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
            <Button
                title={isDeleting ? "Deleting..." : "Delete Account"}
                onPress={handleDeleteAccount}
                buttonStyle={{ backgroundColor: 'red', paddingHorizontal: 24 }}
                disabled={isDeleting}
            />
        </View>
    );
}
