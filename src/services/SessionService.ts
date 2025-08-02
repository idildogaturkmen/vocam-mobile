import { supabase } from '../../database/config';

interface SessionData {
    id: string;
    user_id: string;
    started_at: string;
    ended_at?: string;
    words_studied: number;
    words_learned: number;
}

class SessionService {
    private currentSession: SessionData | null = null;

    /**
     * Start a new learning session
     */
    async startSession(userId: string): Promise<string | null> {
        try {
            const { data, error } = await supabase
                .from('quiz_sessions')
                .insert({
                    user_id: userId,
                    started_at: new Date().toISOString(),
                    score: 0 // Will be used as words_learned count
                })
                .select()
                .single();

            if (error) {
                console.error('Error starting session:', error);
                return null;
            }

            this.currentSession = {
                id: data.id,
                user_id: userId,
                started_at: data.started_at,
                words_studied: 0,
                words_learned: 0
            };

            return data.id;
        } catch (error) {
            console.error('Error starting session:', error);
            return null;
        }
    }

    /**
     * End the current session
     */
    async endSession(): Promise<boolean> {
        if (!this.currentSession) {
            console.warn('No active session to end');
            return false;
        }

        try {
            const { error } = await supabase
                .from('quiz_sessions')
                .update({
                    score: this.currentSession.words_learned // Using score field for words learned
                })
                .eq('id', this.currentSession.id);

            if (error) {
                console.error('Error ending session:', error);
                return false;
            }

            this.currentSession = null;
            return true;
        } catch (error) {
            console.error('Error ending session:', error);
            return false;
        }
    }

    /**
     * Increment words studied/learned in current session
     */
    incrementSessionStats(studied: number = 0, learned: number = 0) {
        if (this.currentSession) {
            this.currentSession.words_studied += studied;
            this.currentSession.words_learned += learned;
        }
    }

    /**
     * Get current session
     */
    getCurrentSession(): SessionData | null {
        return this.currentSession;
    }

    /**
     * Get user's session history
     */
    async getSessionHistory(userId: string, limit: number = 10): Promise<SessionData[]> {
        try {
            const { data, error } = await supabase
                .from('quiz_sessions')
                .select('*')
                .eq('user_id', userId)
                .order('started_at', { ascending: false })
                .limit(limit);

            if (error) {
                console.error('Error fetching session history:', error);
                return [];
            }

            return data.map(session => ({
                id: session.id,
                user_id: session.user_id,
                started_at: session.started_at,
                words_studied: 0, // Not tracked in current schema
                words_learned: session.score || 0
            }));
        } catch (error) {
            console.error('Error fetching session history:', error);
            return [];
        }
    }

    /**
     * Update user's streak
     */
    async updateStreak(userId: string): Promise<boolean> {
        try {
            // Get user's last login
            const { data: profile, error: fetchError } = await supabase
                .from('profiles')
                .select('last_login, streak')
                .eq('user_id', userId)
                .single();

            if (fetchError) {
                console.error('Error fetching profile:', fetchError);
                return false;
            }

            const now = new Date();
            const lastLogin = profile?.last_login ? new Date(profile.last_login) : null;
            let newStreak = profile?.streak || 0;

            if (lastLogin) {
                const daysDiff = Math.floor((now.getTime() - lastLogin.getTime()) / (1000 * 60 * 60 * 24));
                
                if (daysDiff === 1) {
                    // Consecutive day - increment streak
                    newStreak += 1;
                } else if (daysDiff > 1) {
                    // Missed days - reset streak
                    newStreak = 1;
                }
                // If daysDiff === 0, same day - keep current streak
            } else {
                // First login
                newStreak = 1;
            }

            // Update profile
            const { error: updateError } = await supabase
                .from('profiles')
                .update({
                    last_login: now.toISOString(),
                    streak: newStreak
                })
                .eq('user_id', userId);

            if (updateError) {
                console.error('Error updating streak:', updateError);
                return false;
            }

            return true;
        } catch (error) {
            console.error('Error updating streak:', error);
            return false;
        }
    }

    /**
     * Get user statistics
     */
    async getUserStats(userId: string) {
        try {
            // Get total words learned
            const { data: userWords, error: wordsError } = await supabase
                .from('user_words')
                .select('proficiency')
                .eq('user_id', userId);

            if (wordsError) {
                console.error('Error fetching user words:', wordsError);
                return null;
            }

            const totalWords = userWords?.length || 0;
            const masteredWords = userWords?.filter(w => w.proficiency >= 80).length || 0;
            const averageProficiency = totalWords > 0 
                ? userWords.reduce((sum, w) => sum + (w.proficiency || 0), 0) / totalWords 
                : 0;

            // Get user profile
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('streak')
                .eq('user_id', userId)
                .single();

            if (profileError) {
                console.error('Error fetching profile:', profileError);
            }

            return {
                totalWords,
                masteredWords,
                averageProficiency: Math.round(averageProficiency),
                currentStreak: profile?.streak || 0
            };
        } catch (error) {
            console.error('Error getting user stats:', error);
            return null;
        }
    }
}

export default new SessionService();