import { supabase } from '../../database/config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from '../i18n/i18n';

export class LanguageService {
    /**
     * Load user's language preference from database and apply it
     */
    static async loadUserLanguage(userId: string): Promise<void> {
        try {
            // Get user's language preference from database
            const { data: profile, error } = await supabase
                .from('profiles')
                .select('app_language')
                .eq('user_id', userId)
                .single();

            if (error) {
                console.error('Error fetching user language preference:', error);
                return;
            }

            const dbLanguage = profile?.app_language;
            
            if (dbLanguage) {
                // Update local storage
                await AsyncStorage.setItem('user_language', dbLanguage);
                
                // Change app language if different
                if (i18n.language !== dbLanguage) {
                    await i18n.changeLanguage(dbLanguage);
                    console.log('Language changed to:', dbLanguage);
                }
            }
        } catch (error) {
            console.error('Error in loadUserLanguage:', error);
        }
    }

    /**
     * Save user's language preference to database
     */
    static async saveUserLanguage(userId: string, languageCode: string): Promise<boolean> {
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ app_language: languageCode })
                .eq('user_id', userId);

            if (error) {
                console.error('Error saving user language preference:', error);
                return false;
            }

            console.log('Successfully saved user language preference:', languageCode);
            return true;
        } catch (error) {
            console.error('Error in saveUserLanguage:', error);
            return false;
        }
    }
}