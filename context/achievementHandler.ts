export type Trophy = 'first_login' | '100_words' | 'max_proficiency' | 'streak_3' | 'streak_7' | 'streak_14' | 'streak_30' | 'level_1' | 'level_5' | 'level_10' | 'first_quiz' | 'quiz_10' | 'retry' | 'perfect_score' | 'perfect_3_score' | 'category_3_words' | 'seven_words' | 'submit_word' | 'submit_10_words' | 'capture_word' | 'capture_5_words' | 'translations_3' | string;

export const achievementHandlers: Record<
    Trophy,
    () => Promise<{ title: string; achieved: boolean }>
> = {
    first_login: async () => {
        return { title: 'First Login', achieved: true };
    },
    streak_3: async () => {
        const streak = 3;
        return { title: '3-Day Streak', achieved: streak >= 3 };
    },
    streak_7: async () => {
        const streak = 7;
        return { title: '7-Day Streak', achieved: streak >= 7 };
    },
    streak_14: async () => {
        const streak = 14;
        return { title: '14-Day Streak', achieved: streak >= 14 };
    },
    streak_30: async () => {
        const streak = 30;
        return { title: '30-Day Streak', achieved: streak >= 30 };
    },
    level_1: async () => {
        const level = 1;
        return { title: 'Level 1 Achieved', achieved: level >= 1 };
    },
    level_5: async () => {
        const level = 5;
        return { title: 'Level 5 Achieved', achieved: level >= 5 };
    },
    level_10: async () => {
        const level = 10;
        return { title: 'Level 10 Achieved', achieved: level >= 10 };
    },
    first_quiz: async () => {
        return { title: 'First Quiz Completed', achieved: true };
    },
    quiz_10: async () => {
        const count = 10;
        return { title: '10 Quizzes Completed', achieved: count >= 10 };
    },
    retry: async () => {
        return { title: 'Fail a quiz and perfect it on Retry', achieved: true };
    },
    perfect_score: async () => {
        return { title: 'Perfect Score on a Quiz', achieved: true };
    },
    perfect_3_score: async () => {
        const count = 3;
        return { title: 'Perfect Score on 3 Quizzes', achieved: count >= 3 };
    },
    category_3_words: async () => {
        const count = 3;
        return { title: 'Learn 3 Words in a Category', achieved: count >= 3 };
    },
    seven_words: async () => {
        const count = 7;
        return { title: 'Learn 7 Words', achieved: count >= 7 };
    },
    submit_word: async () => {
        return { title: 'Submit a Word', achieved: true };
    },
    submit_10_words: async () => {
        const count = 10;
        return { title: 'Submit 10 Words', achieved: count >= 10 };
    },
    capture_word: async () => {
        return { title: 'Capture a Word', achieved: true };
    },
    capture_5_words: async () => {
        const count = 5;
        return { title: 'Capture 5 Words', achieved: count >= 5 };
    },
    max_proficiency: async () => {
        return { title: 'First Max Proficiency', achieved: true };
    },
    translations_3: async () => {
        const count = 3;
        return { title: 'Translate a word on 3 different languages', achieved: count >= 3 };
    },
};