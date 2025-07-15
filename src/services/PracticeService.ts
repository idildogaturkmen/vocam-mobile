import { supabase } from '../../database/config';
import VocabularyService, { SavedWord } from './VocabularyService';
import SpeechService from './SpeechService';

export interface QuizQuestion {
    id: string;
    type: 'translation' | 'reverse_translation' | 'multiple_choice' | 'listening' | 'typing' | 'context' | 'pronunciation' | 'category_match';
    word: SavedWord;
    options?: string[];
    correctAnswer: string;
    userAnswer?: string;
    isCorrect?: boolean;
    timeSpent?: number;
    contextSentence?: string;
    displayQuestion?: string;
}

export interface PracticeSession {
    id: string;
    userId: string;
    startedAt: Date;
    totalQuestions: number;
    correctAnswers: number;
    currentQuestion: number;
    questions: QuizQuestion[];
    isCompleted: boolean;
}

export interface PracticeStats {
    totalSessions: number;
    totalQuestions: number;
    correctAnswers: number;
    accuracy: number;
    streak: number;
    lastPracticeDate: string | null;
    languageStats: Record<string, { practiced: number; correct: number }>;
}

class PracticeService {
    private currentSession: PracticeSession | null = null;

    /**
     * Get available languages for practice
     */
    async getAvailableLanguages(userId: string): Promise<{ code: string; name: string; wordCount: number }[]> {
        try {
            const vocabulary = await VocabularyService.getUserVocabulary(userId);
            const languageCounts: Record<string, number> = {};
            
            vocabulary.forEach(word => {
                if (word.language) {
                    languageCounts[word.language] = (languageCounts[word.language] || 0) + 1;
                }
            });
            
            return Object.entries(languageCounts)
                .map(([code, count]) => ({
                    code,
                    name: this.getLanguageName(code),
                    wordCount: count
                }))
                .filter(lang => lang.wordCount >= 4) // Need at least 4 words for practice
                .sort((a, b) => b.wordCount - a.wordCount);
        } catch (error) {
            console.error('Error getting available languages:', error);
            return [];
        }
    }

    /**
     * Start a new practice session
     */
    async startPracticeSession(
        userId: string, 
        questionCount: number = 10,
        languageFilter?: string
    ): Promise<PracticeSession | null> {
        try {
            // Get user's vocabulary
            const vocabulary = await VocabularyService.getUserVocabulary(userId, languageFilter);
            
            if (vocabulary.length < 4) {
                console.error('Not enough vocabulary for practice');
                return null;
            }

            // Create session in database
            const { data: sessionData, error } = await supabase
                .from('quiz_sessions')
                .insert({
                    user_id: userId,
                    started_at: new Date().toISOString(),
                    score: 0
                })
                .select()
                .single();

            if (error) {
                console.error('Error creating session:', error);
                return null;
            }

            // Generate questions with variety
            const questions = this.generateVariedQuestions(vocabulary, questionCount);

            this.currentSession = {
                id: sessionData.id,
                userId,
                startedAt: new Date(sessionData.started_at),
                totalQuestions: questionCount,
                correctAnswers: 0,
                currentQuestion: 0,
                questions,
                isCompleted: false
            };

            return this.currentSession;
        } catch (error) {
            console.error('Error starting practice session:', error);
            return null;
        }
    }

    /**
     * Generate varied questions for engagement
     */
    private generateVariedQuestions(vocabulary: SavedWord[], count: number): QuizQuestion[] {
        const questions: QuizQuestion[] = [];
        const usedWords = new Set<string>();
        
        // Define question type distribution for variety
        const questionTypeDistribution = [
            { type: 'translation' as const, weight: 0.25 },
            { type: 'reverse_translation' as const, weight: 0.25 },
            { type: 'multiple_choice' as const, weight: 0.15 },
            { type: 'listening' as const, weight: 0.15 },
            { type: 'context' as const, weight: 0.1 },
            { type: 'pronunciation' as const, weight: 0.05 },
            { type: 'typing' as const, weight: 0.05 }
        ];

        // Helper to get random question type based on weights
        const getRandomQuestionType = (): QuizQuestion['type'] => {
            const random = Math.random();
            let cumulativeWeight = 0;
            
            for (const { type, weight } of questionTypeDistribution) {
                cumulativeWeight += weight;
                if (random < cumulativeWeight) {
                    return type;
                }
            }
            
            return 'translation'; // Fallback
        };

        for (let i = 0; i < count; i++) {
            // Select a random word that hasn't been used
            let word: SavedWord;
            do {
                word = vocabulary[Math.floor(Math.random() * vocabulary.length)];
            } while (usedWords.has(word.id) && usedWords.size < vocabulary.length);
            
            usedWords.add(word.id);

            // Select question type
            let type = getRandomQuestionType();
            
            // Validate question type for the word
            if (type === 'context' && !word.example) {
                type = 'translation'; // Fallback if no example
            }
            
            if (type === 'typing' && word.translation.length > 20) {
                type = 'multiple_choice'; // Fallback for very long words
            }
            
            const question = this.createQuestion(word, type, vocabulary);
            questions.push(question);
        }

        return questions;
    }

    /**
     * Create a question based on type
     */
    private createQuestion(
        word: SavedWord, 
        type: QuizQuestion['type'], 
        vocabulary: SavedWord[]
    ): QuizQuestion {
        switch (type) {
            case 'translation':
                return this.createTranslationQuestion(word, vocabulary);
            
            case 'reverse_translation':
                return this.createReverseTranslationQuestion(word, vocabulary);
            
            case 'multiple_choice':
                return this.createMultipleChoiceQuestion(word, vocabulary);
            
            case 'listening':
                return this.createListeningQuestion(word, vocabulary);
            
            case 'context':
                return this.createContextQuestion(word, vocabulary);
            
            case 'pronunciation':
                return this.createPronunciationQuestion(word, vocabulary);
            
            case 'typing':
                return this.createTypingQuestion(word);
            
            default:
                return this.createTranslationQuestion(word, vocabulary);
        }
    }

    /**
     * Create translation question (show original, select translation)
     */
    private createTranslationQuestion(word: SavedWord, vocabulary: SavedWord[]): QuizQuestion {
        const options = this.generateOptions(word.translation, vocabulary, 'translation');
        
        return {
            id: `${word.id}_translation`,
            type: 'translation',
            word,
            options,
            correctAnswer: word.translation,
            displayQuestion: `What is "${word.original}" in ${this.getLanguageName(word.language)}?`
        };
    }

    /**
     * Create reverse translation question (show translation, select original)
     */
    private createReverseTranslationQuestion(word: SavedWord, vocabulary: SavedWord[]): QuizQuestion {
        const options = this.generateOptions(word.original, vocabulary, 'original');
        
        return {
            id: `${word.id}_reverse`,
            type: 'reverse_translation',
            word,
            options,
            correctAnswer: word.original,
            displayQuestion: `What is "${word.translation}" in English?`
        };
    }

    /**
     * Create context question using example sentences
     */
    private createContextQuestion(word: SavedWord, vocabulary: SavedWord[]): QuizQuestion {
        const options = this.generateOptions(word.translation, vocabulary, 'translation');
        let contextSentence = '';
        
        if (word.example) {
            const parts = word.example.split('|');
            if (parts.length === 2) {
                const englishExample = parts[1];
                // Safely replace the word with blank
                contextSentence = englishExample.replace(new RegExp(word.original, 'gi'), '_____');
            } else {
                // Use category-specific context
                contextSentence = this.generateContextSentence(word);
            }
        } else {
            // Create category-specific context if no example exists
            contextSentence = this.generateContextSentence(word);
        }
        
        return {
            id: `${word.id}_context`,
            type: 'context',
            word,
            options,
            correctAnswer: word.translation,
            contextSentence,
            displayQuestion: 'Fill in the blank with the correct translation:'
        };
    }

    /**
     * Generate context-specific sentences based on word category
     */
    private generateContextSentence(word: SavedWord): string {
        const category = word.category?.toLowerCase() || 'general';
        const original = word.original.toLowerCase();
        
        // Category-specific templates with very specific contexts
        const templates: Record<string, string[]> = {
            food: [
                `The waiter brought me a delicious _____ with tomato sauce and cheese.`,
                `I ordered _____ and a salad for lunch at the Italian restaurant.`,
                `My grandmother's homemade _____ is the best I've ever tasted.`,
                `The chef is preparing fresh _____ in the kitchen right now.`,
                `Would you like to try some _____ from our special menu today?`
            ],
            animal: [
                `The _____ was barking loudly at the mailman this morning.`,
                `I saw a beautiful _____ flying above the trees in the park.`,
                `The farmer has many _____ grazing in the field behind the barn.`,
                `At the zoo, the _____ was sleeping peacefully in its enclosure.`,
                `My neighbor's pet _____ escaped and we helped catch it.`
            ],
            clothing: [
                `She wore her favorite blue _____ to the job interview yesterday.`,
                `I need to buy a warm winter _____ before the snow arrives.`,
                `The _____ perfectly matched her shoes and handbag.`,
                `He forgot to bring his _____ to the gym for basketball practice.`,
                `This silk _____ needs to be dry cleaned, not machine washed.`
            ],
            furniture: [
                `Please help me move this heavy wooden _____ to the other room.`,
                `We bought a comfortable leather _____ for the living room.`,
                `The antique _____ has been in our family for three generations.`,
                `I assembled the new _____ from IKEA in just two hours.`,
                `The _____ is too big to fit through the apartment door.`
            ],
            vehicle: [
                `I parked my red _____ in the underground garage.`,
                `The _____ broke down on the highway during rush hour.`,
                `She's learning to drive her father's old _____ this summer.`,
                `We rented a _____ for our vacation road trip to California.`,
                `The mechanic is repairing the engine of my _____ today.`
            ],
            electronics: [
                `My _____ battery died during the important video call.`,
                `I dropped my new _____ and cracked the screen yesterday.`,
                `The _____ stopped working after the software update.`,
                `Can you help me connect my _____ to the Wi-Fi network?`,
                `I forgot to charge my _____ overnight and now it's dead.`
            ],
            nature: [
                `The tall _____ provides shade for our backyard picnic area.`,
                `Beautiful _____ are blooming in the garden this spring.`,
                `We climbed to the top of the _____ to see the sunset.`,
                `The _____ flows through the valley towards the ocean.`,
                `During autumn, the _____ change color from green to gold.`
            ],
            household: [
                `I used the _____ to cut the vegetables for dinner.`,
                `Please put the dirty dishes in the _____ after eating.`,
                `The _____ is making strange noises and needs repair.`,
                `We keep the _____ in the kitchen drawer with other utensils.`,
                `Mom asked me to turn off the _____ before leaving home.`
            ],
            default: [
                `I need to use the _____ to complete this specific task.`,
                `The store manager said the _____ is currently out of stock.`,
                `Please handle the _____ carefully because it's very fragile.`,
                `We found an old _____ in the attic while cleaning yesterday.`,
                `The instruction manual explains how to operate the _____ properly.`
            ]
        };
        
        // Special handling for specific words that need very clear context
        const specificWordTemplates: Record<string, string[]> = {
            'pen': [
                `I need a _____ to sign this important document.`,
                `The student forgot to bring a _____ to write the exam.`
            ],
            'pencil': [
                `The artist used a _____ to sketch the portrait.`,
                `Please use a _____ so you can erase mistakes.`
            ],
            'book': [
                `I'm reading an interesting _____ about world history.`,
                `The library has thousands of _____ on every subject.`
            ],
            'phone': [
                `My _____ is ringing but I can't find it anywhere.`,
                `She's talking on her _____ with her mother.`
            ],
            'computer': [
                `I need to restart my _____ because it's running slowly.`,
                `The programmer works on her _____ all day long.`
            ],
            'water': [
                `I'm thirsty, can I have a glass of _____ please?`,
                `The plants need _____ every day during summer.`
            ],
            'coffee': [
                `I always drink a cup of _____ in the morning.`,
                `This _____ is too hot, let it cool down first.`
            ],
            'tea': [
                `Would you prefer _____ or coffee with your breakfast?`,
                `British people traditionally drink _____ at 4 o'clock.`
            ],
            'milk': [
                `The baby needs warm _____ from the bottle.`,
                `Please add _____ to my cereal bowl.`
            ],
            'bread': [
                `I bought fresh _____ from the bakery this morning.`,
                `We need _____ to make sandwiches for lunch.`
            ],
            'door': [
                `Please close the _____ when you leave the room.`,
                `Someone is knocking at the front _____.`
            ],
            'window': [
                `Open the _____ to let fresh air into the room.`,
                `The bird flew into the closed _____ by accident.`
            ],
            'table': [
                `Put the dishes on the dining _____ for dinner.`,
                `The students sit around the _____ during class.`
            ],
            'chair': [
                `Pull up a _____ and join us at the table.`,
                `This office _____ has wheels and adjustable height.`
            ],
            'bed': [
                `I'm tired and want to go to _____ early tonight.`,
                `The hotel room has a comfortable king-size _____.`
            ],
            'car': [
                `I drive my _____ to work every morning.`,
                `The _____ won't start because the battery is dead.`
            ],
            'bicycle': [
                `She rides her _____ to school every day.`,
                `My _____ has a flat tire that needs fixing.`
            ],
            'airplane': [
                `The _____ will land at the airport in 20 minutes.`,
                `We boarded the _____ for our flight to Paris.`
            ],
            'train': [
                `The _____ arrives at platform 3 at 10:15 AM.`,
                `We took the fast _____ from London to Edinburgh.`
            ],
            'bus': [
                `The school _____ picks up children at 7:30 AM.`,
                `I missed the _____ and had to wait 30 minutes.`
            ]
        };
        
        // Check if we have specific templates for this word
        if (specificWordTemplates[original]) {
            const templates = specificWordTemplates[original];
            return templates[Math.floor(Math.random() * templates.length)];
        }
        
        // Otherwise use category templates
        const categoryTemplates = templates[category] || templates.default;
        return categoryTemplates[Math.floor(Math.random() * categoryTemplates.length)];
    }

    /**
     * Create pronunciation question
     */
    private createPronunciationQuestion(word: SavedWord, vocabulary: SavedWord[]): QuizQuestion {
        const options = this.generateOptions(word.original, vocabulary, 'original');
        
        return {
            id: `${word.id}_pronunciation`,
            type: 'pronunciation',
            word,
            options,
            correctAnswer: word.original,
            displayQuestion: 'Listen and select the word you hear:'
        };
    }

    /**
     * Create category matching question
     */
    private createCategoryMatchQuestion(word: SavedWord, vocabulary: SavedWord[]): QuizQuestion {
        // Find other words in the same category
        const sameCategory = vocabulary.filter(w => 
            w.category === word.category && w.id !== word.id
        );
        
        const differentCategory = vocabulary.filter(w => 
            w.category !== word.category && w.category && w.category !== 'other'
        );
        
        const options = [word.translation];
        
        // Add 2 from same category if available
        for (let i = 0; i < 2 && i < sameCategory.length; i++) {
            options.push(sameCategory[i].translation);
        }
        
        // Add 1 from different category
        if (differentCategory.length > 0) {
            options.push(differentCategory[0].translation);
        }
        
        // Fill remaining with random if needed
        while (options.length < 4) {
            const randomWord = vocabulary[Math.floor(Math.random() * vocabulary.length)];
            if (!options.includes(randomWord.translation)) {
                options.push(randomWord.translation);
            }
        }
        
        return {
            id: `${word.id}_category`,
            type: 'category_match',
            word,
            options: options.sort(() => Math.random() - 0.5),
            correctAnswer: word.translation,
            displayQuestion: `Which word is NOT in the category "${word.category}"?`
        };
    }

    /**
     * Create multiple choice question
     */
    private createMultipleChoiceQuestion(word: SavedWord, vocabulary: SavedWord[]): QuizQuestion {
        const options = this.generateOptions(word.translation, vocabulary, 'translation');
        
        return {
            id: `${word.id}_multiple`,
            type: 'multiple_choice',
            word,
            options,
            correctAnswer: word.translation,
            displayQuestion: `Select the ${this.getLanguageName(word.language)} translation for "${word.original}":`
        };
    }

    /**
     * Create listening question
     */
    private createListeningQuestion(word: SavedWord, vocabulary: SavedWord[]): QuizQuestion {
        const options = this.generateOptions(word.original, vocabulary, 'original');
        
        return {
            id: `${word.id}_listening`,
            type: 'listening',
            word,
            options,
            correctAnswer: word.original,
            displayQuestion: 'Listen and select the correct word:'
        };
    }

    /**
     * Create typing question
     */
    private createTypingQuestion(word: SavedWord): QuizQuestion {
        return {
            id: `${word.id}_typing`,
            type: 'typing',
            word,
            correctAnswer: word.translation,
            displayQuestion: `Type "${word.original}" in ${this.getLanguageName(word.language)}:`
        };
    }

    /**
     * Generate options for multiple choice questions
     */
    private generateOptions(
        correct: string, 
        vocabulary: SavedWord[], 
        field: 'original' | 'translation'
    ): string[] {
        const options = [correct];
        const used = new Set([correct.toLowerCase()]);
        
        // Get words in the same language for better distractors
        const sameLanguageWords = vocabulary.filter(w => 
            field === 'translation' ? w.language === vocabulary[0].language : true
        );
        
        // Add 3 wrong options
        while (options.length < 4 && sameLanguageWords.length > options.length) {
            const randomWord = sameLanguageWords[Math.floor(Math.random() * sameLanguageWords.length)];
            const option = randomWord[field];
            
            if (!used.has(option.toLowerCase())) {
                options.push(option);
                used.add(option.toLowerCase());
            }
        }
        
        // Shuffle options
        return options.sort(() => Math.random() - 0.5);
    }

    /**
     * Get language name from code
     */
    private getLanguageName(code: string): string {
        const languages: Record<string, string> = {
            'ar': 'Arabic',
            'bn': 'Bengali',
            'bg': 'Bulgarian',
            'zh-CN': 'Chinese (Simplified)',
            'zh-TW': 'Chinese (Traditional)',
            'hr': 'Croatian',
            'cs': 'Czech',
            'da': 'Danish',
            'nl': 'Dutch',
            'tl': 'Filipino',
            'fi': 'Finnish',
            'fr': 'French',
            'de': 'German',
            'el': 'Greek',
            'gu': 'Gujarati',
            'he': 'Hebrew',
            'hi': 'Hindi',
            'hu': 'Hungarian',
            'is': 'Icelandic',
            'id': 'Indonesian',
            'it': 'Italian',
            'ja': 'Japanese',
            'ko': 'Korean',
            'la': 'Latin',
            'ms': 'Malay',
            'no': 'Norwegian',
            'fa': 'Persian (Farsi)',
            'pl': 'Polish',
            'pt': 'Portuguese',
            'pa': 'Punjabi',
            'ro': 'Romanian',
            'ru': 'Russian',
            'sr': 'Serbian',
            'sk': 'Slovak',
            'es': 'Spanish',
            'sw': 'Swahili',
            'sv': 'Swedish',
            'ta': 'Tamil',
            'te': 'Telugu',
            'th': 'Thai',
            'tr': 'Turkish',
            'uk': 'Ukrainian',
            'ur': 'Urdu',
            'vi': 'Vietnamese'
        };
        
        return languages[code] || code;
    }

    /**
     * Submit answer for current question
     */
    async submitAnswer(answer: string): Promise<boolean> {
        if (!this.currentSession || this.currentSession.isCompleted) {
            return false;
        }

        const currentQuestion = this.currentSession.questions[this.currentSession.currentQuestion];
        currentQuestion.userAnswer = answer;
        currentQuestion.isCorrect = answer.toLowerCase().trim() === currentQuestion.correctAnswer.toLowerCase().trim();
        
        if (currentQuestion.isCorrect) {
            this.currentSession.correctAnswers++;
            
            // Update word proficiency
            const newProficiency = Math.min(100, currentQuestion.word.proficiency + 10);
            await VocabularyService.updateProficiency(currentQuestion.word.id, newProficiency);
        } else {
            // Decrease proficiency slightly for wrong answers
            const newProficiency = Math.max(0, currentQuestion.word.proficiency - 5);
            await VocabularyService.updateProficiency(currentQuestion.word.id, newProficiency);
        }

        return currentQuestion.isCorrect;
    }

    /**
     * Move to next question
     */
    nextQuestion(): QuizQuestion | null {
        if (!this.currentSession) return null;
        
        this.currentSession.currentQuestion++;
        
        if (this.currentSession.currentQuestion >= this.currentSession.totalQuestions) {
            this.completeSession();
            return null;
        }
        
        return this.currentSession.questions[this.currentSession.currentQuestion];
    }

    /**
     * Complete the current session
     */
    private async completeSession() {
        if (!this.currentSession) return;
        
        this.currentSession.isCompleted = true;
        
        // Update session in database
        await supabase
            .from('quiz_sessions')
            .update({
                score: this.currentSession.correctAnswers
            })
            .eq('id', this.currentSession.id);
        
        // Update user streak
        await this.updateUserStreak(this.currentSession.userId);
    }

    /**
     * Update user's practice streak
     */
    private async updateUserStreak(userId: string) {
        const { data: profile } = await supabase
            .from('profiles')
            .select('last_login, streak')
            .eq('user_id', userId)
            .single();
        
        if (profile) {
            const lastLogin = new Date(profile.last_login);
            const today = new Date();
            const daysDiff = Math.floor((today.getTime() - lastLogin.getTime()) / (1000 * 60 * 60 * 24));
            
            let newStreak = profile.streak || 0;
            if (daysDiff === 1) {
                newStreak++;
            } else if (daysDiff > 1) {
                newStreak = 1;
            }
            
            await supabase
                .from('profiles')
                .update({
                    streak: newStreak,
                    last_login: today.toISOString()
                })
                .eq('user_id', userId);
        }
    }

    /**
     * Get user's practice statistics
     */
    async getUserStats(userId: string): Promise<PracticeStats> {
        const { data: sessions } = await supabase
            .from('quiz_sessions')
            .select('*')
            .eq('user_id', userId)
            .order('started_at', { ascending: false });
        
        const { data: profile } = await supabase
            .from('profiles')
            .select('streak, last_login')
            .eq('user_id', userId)
            .single();
        
        // Calculate language-specific stats
        const vocabulary = await VocabularyService.getUserVocabulary(userId);
        const languageStats: Record<string, { practiced: number; correct: number }> = {};
        
        let totalQuestions = 0;
        let correctAnswers = 0;
        
        sessions?.forEach(session => {
            correctAnswers += session.score || 0;
            // Assuming average 10 questions per session
            totalQuestions += 10;
        });
        
        return {
            totalSessions: sessions?.length || 0,
            totalQuestions,
            correctAnswers,
            accuracy: totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 0,
            streak: profile?.streak || 0,
            lastPracticeDate: profile?.last_login || null,
            languageStats
        };
    }

    /**
     * Get current session
     */
    getCurrentSession(): PracticeSession | null {
        return this.currentSession;
    }

    /**
     * Get current question
     */
    getCurrentQuestion(): QuizQuestion | null {
        if (!this.currentSession) return null;
        return this.currentSession.questions[this.currentSession.currentQuestion];
    }
}

export default new PracticeService();