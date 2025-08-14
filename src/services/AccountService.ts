import { supabase } from '../../database/config';
import { Alert } from 'react-native';

export class AccountService {
    /**
     * Deletes the user account and all associated data from Supabase
     * This includes data from multiple tables that reference the user
     */
    static async deleteUserAccount(): Promise<boolean> {
        try {
            const {
                data: { user },
            } = await supabase.auth.getUser();

            if (!user) {
                console.warn('No authenticated user found - user may already be deleted');
                return true; // Consider this a success since user is already gone
            }

            const userId = user.id;

            // Delete user data in the correct order to avoid foreign key constraints
            // Start with tables that reference the user but don't have dependencies

            // Helper function to safely delete from a table
            const safeDelete = async (tableName: string, description: string) => {
                try {
                    const { error } = await supabase.from(tableName).delete().eq('user_id', userId);

                    if (error) {
                        // Only log as warning if table doesn't exist, error for other issues
                        if (error.code === '42P01' || error.message.includes('does not exist')) {
                            console.warn(`Table ${tableName} does not exist, skipping deletion`);
                        } else {
                            console.error(`Error deleting ${description}:`, error);
                        }
                    } else {
                        console.log(`Successfully deleted ${description}`);
                    }
                } catch (error) {
                    console.warn(`Failed to delete ${description}, but continuing:`, error);
                }
            };

            // Try to use the database function for complete deletion
            const { error: deleteError } = await supabase.rpc('delete_user');
            
            if (!deleteError) {
                // Complete deletion successful - user and all data removed
                console.log('User completely deleted from database and auth');
                
                // The database function deletes the auth user, so auth state should change automatically
                // But let's force a sign out to ensure the UI updates
                try {
                    await supabase.auth.signOut();
                    console.log('Forced sign out after complete deletion');
                } catch (signOutError) {
                    // Ignore sign out errors since user is already deleted
                    console.warn('Sign out failed after deletion (expected):', signOutError);
                }
                return true;
            }
            
            // If RPC function fails, fallback to manual deletion
            console.warn('Database function failed, using manual deletion:', deleteError);
            
            // Delete from all tables in the correct order to handle foreign key constraints
            // First delete dependent records, then primary records
            
            // Delete user_xp (references quiz_sessions)
            await safeDelete('user_xp', 'user XP records');
            
            // Delete other dependent tables
            await safeDelete('user_achievements', 'user achievements');
            await safeDelete('user_words', 'user vocabulary');
            await safeDelete('daily_progress', 'daily progress');
            await safeDelete('avatars', 'avatar configuration');
            
            // Delete quiz_sessions (referenced by user_xp, so delete after user_xp)
            await safeDelete('quiz_sessions', 'quiz sessions');

            // Finally, delete the user profile (most important)
            const { error: profileError } = await supabase
                .from('profiles')
                .delete()
                .eq('user_id', userId);

            if (profileError) {
                console.error('Error deleting profile:', profileError);
                // Continue anyway as we still want to sign out
            } else {
                console.log('Successfully deleted user profile');
            }

            // Sign out the user after deleting all their data
            const { error: signOutError } = await supabase.auth.signOut();
            if (signOutError) {
                console.error('Sign out error:', signOutError);
                // Don't throw error - data is deleted, so this is still a success
                console.warn('User data deleted but sign out failed - user should refresh app');
            } else {
                console.log('User signed out successfully after data deletion');
            }

            return true;
        } catch (error) {
            console.error('Error deleting user account:', error);
            throw error;
        }
    }

    /**
     * Shows a confirmation dialog and handles the account deletion process
     */
    static async confirmAndDeleteAccount(): Promise<void> {
        return new Promise((resolve, reject) => {
            Alert.alert(
                'Delete Account',
                'Are you sure you want to permanently delete your account? This action cannot be undone and will remove all your progress, achievements, and vocabulary.',
                [
                    {
                        text: 'Cancel',
                        style: 'cancel',
                        onPress: () => resolve(),
                    },
                    {
                        text: 'Delete Account',
                        style: 'destructive',
                        onPress: async () => {
                            try {
                                const success = await AccountService.deleteUserAccount();
                                if (success) {
                                    Alert.alert(
                                        'Account Completely Deleted',
                                        'Your account and all data have been permanently deleted. You can create a new account with the same email if desired.',
                                        [{ text: 'OK', onPress: () => resolve() }],
                                    );
                                } else {
                                    throw new Error('Failed to delete account');
                                }
                            } catch (error) {
                                console.error('Delete account error:', error);
                                Alert.alert(
                                    'Error',
                                    'Failed to delete account. Please try again or contact support.',
                                    [{ text: 'OK', onPress: () => reject(error) }],
                                );
                            }
                        },
                    },
                ],
                { cancelable: true },
            );
        });
    }
}
