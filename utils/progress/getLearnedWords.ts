import { supabase } from '../../database/config';

export async function getLearnedWords(): Promise<Record<string, any>[]> {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return [];
        }

        // Get user's learned words from database
        const { data: words, error } = await supabase
            .from('user_words')
            .select('id, word, proficiency, created_at')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching learned words:', error);
            return [];
        }

        return words?.map(word => ({
            id: word.id,
            word: word.word,
            proficiency: word.proficiency || 1,
            learned_at: word.created_at
        })) || [];
    } catch (error) {
        console.error('Failed to get learned words:', error);
        return [];
    }
}