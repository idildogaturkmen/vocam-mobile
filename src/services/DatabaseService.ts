import * as SQLite from 'expo-sqlite';

interface VocabularyWord {
  id?: number;
  word_original: string;
  word_translated: string;
  language_translated: string;
  example_sentence?: string;
  example_english?: string;
  category?: string;
  image_path?: string;
  date_added?: string;
  source?: string;
  session_id?: number | null;
}

interface UserProgress {
  id?: number;
  vocabulary_id: number;
  review_count: number;
  correct_count: number;
  proficiency_level: number;
  last_reviewed?: string;
}

interface Session {
  id?: number;
  start_time?: string;
  end_time?: string;
  words_studied: number;
  words_learned: number;
}

class DatabaseService {
  private db: SQLite.SQLiteDatabase | null = null;

  async initialize(): Promise<void> {
    try {
      this.db = await SQLite.openDatabaseAsync('language_learning.db');
      await this.createTables();
      console.log('✅ Database initialized successfully');
    } catch (error) {
      console.error('❌ Database initialization error:', error);
    }
  }

  async createTables(): Promise<void> {
    const createVocabularyTable = `
      CREATE TABLE IF NOT EXISTS vocabulary (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        word_original TEXT NOT NULL,
        word_translated TEXT NOT NULL,
        language_translated TEXT NOT NULL,
        example_sentence TEXT,
        example_english TEXT,
        category TEXT DEFAULT 'camera_detection',
        image_path TEXT,
        date_added DATETIME DEFAULT CURRENT_TIMESTAMP,
        source TEXT DEFAULT 'camera',
        session_id INTEGER
      );
    `;

    const createProgressTable = `
      CREATE TABLE IF NOT EXISTS user_progress (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        vocabulary_id INTEGER,
        review_count INTEGER DEFAULT 0,
        correct_count INTEGER DEFAULT 0,
        proficiency_level INTEGER DEFAULT 0,
        last_reviewed DATETIME,
        FOREIGN KEY (vocabulary_id) REFERENCES vocabulary (id)
      );
    `;

    const createSessionsTable = `
      CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        end_time DATETIME,
        words_studied INTEGER DEFAULT 0,
        words_learned INTEGER DEFAULT 0
      );
    `;

    await this.db!.execAsync(createVocabularyTable);
    await this.db!.execAsync(createProgressTable);
    await this.db!.execAsync(createSessionsTable);
  }

  // Main method that index.tsx calls
  async saveVocabularyWord(
    wordTranslated: string, 
    wordOriginal: string, 
    languageTranslated: string, 
    exampleSentence: string = '', 
    exampleEnglish: string = '', 
    category: string = 'camera_detection', 
    sessionId: number | null = null
  ): Promise<number | null> {
    try {
      console.log('💾 Saving vocabulary word:', {
        wordOriginal,
        wordTranslated,
        languageTranslated,
        category
      });

      // Check if word already exists
      const existing = await this.db!.getFirstAsync(
        'SELECT id FROM vocabulary WHERE word_original = ? AND language_translated = ?',
        [wordOriginal, languageTranslated]
      ) as { id: number } | null;

      if (existing) {
        console.log('Word already exists:', wordOriginal);
        return existing.id;
      }

      const result = await this.db!.runAsync(
        `INSERT INTO vocabulary 
         (word_original, word_translated, language_translated, example_sentence, example_english, category, session_id) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [wordOriginal, wordTranslated, languageTranslated, exampleSentence, exampleEnglish, category, sessionId]
      );
      
      // Initialize progress tracking
      if (result.lastInsertRowId) {
        await this.db!.runAsync(
          'INSERT INTO user_progress (vocabulary_id, proficiency_level) VALUES (?, 0)',
          [result.lastInsertRowId]
        );
      }
      
      console.log('✅ Vocabulary word saved with ID:', result.lastInsertRowId);
      return result.lastInsertRowId;
    } catch (error) {
      console.error('❌ Error saving vocabulary word:', error);
      return null;
    }
  }

  async addVocabulary(wordData: any): Promise<number | null> {
    try {
      // Check if word already exists
      const existing = await this.db!.getFirstAsync(
        'SELECT id FROM vocabulary WHERE word_original = ? AND language_translated = ?',
        [wordData.original, wordData.language]
      ) as { id: number } | null;

      if (existing) {
        console.log('Word already exists:', wordData.original);
        return existing.id;
      }

      const result = await this.db!.runAsync(
        'INSERT INTO vocabulary (word_original, word_translated, language_translated, category, image_path, source) VALUES (?, ?, ?, ?, ?, ?)',
        [wordData.original, wordData.translated, wordData.language, wordData.category, wordData.imagePath, wordData.source]
      );
      
      // Initialize progress tracking
      await this.db!.runAsync(
        'INSERT INTO user_progress (vocabulary_id, proficiency_level) VALUES (?, 0)',
        [result.lastInsertRowId]
      );
      
      return result.lastInsertRowId;
    } catch (error) {
      console.error('Error adding vocabulary:', error);
      return null;
    }
  }

  async getAllVocabulary(): Promise<VocabularyWord[]> {
    try {
      const result = await this.db!.getAllAsync(`
        SELECT v.*, up.proficiency_level, up.review_count, up.correct_count, up.last_reviewed
        FROM vocabulary v 
        LEFT JOIN user_progress up ON v.id = up.vocabulary_id 
        ORDER BY v.date_added DESC
      `) as VocabularyWord[];
      return result || [];
    } catch (error) {
      console.error('Error getting vocabulary:', error);
      return [];
    }
  }

  async updateWordProgress(vocabId: number, isCorrect: boolean): Promise<boolean> {
    try {
      const currentProgress = await this.db!.getFirstAsync(
        'SELECT * FROM user_progress WHERE vocabulary_id = ?',
        [vocabId]
      ) as UserProgress | null;

      let reviewCount = (currentProgress?.review_count || 0) + 1;
      let correctCount = (currentProgress?.correct_count || 0) + (isCorrect ? 1 : 0);
      
      // Calculate proficiency (0-5 scale)
      let proficiencyLevel = 0;
      if (reviewCount > 0) {
        const accuracy = correctCount / reviewCount;
        if (accuracy >= 0.9 && reviewCount >= 5) proficiencyLevel = 5;
        else if (accuracy >= 0.8 && reviewCount >= 4) proficiencyLevel = 4;
        else if (accuracy >= 0.6 && reviewCount >= 3) proficiencyLevel = 3;
        else if (accuracy >= 0.4 && reviewCount >= 2) proficiencyLevel = 2;
        else if (accuracy >= 0.2) proficiencyLevel = 1;
      }

      await this.db!.runAsync(
        'UPDATE user_progress SET review_count = ?, correct_count = ?, proficiency_level = ?, last_reviewed = CURRENT_TIMESTAMP WHERE vocabulary_id = ?',
        [reviewCount, correctCount, proficiencyLevel, vocabId]
      );

      return true;
    } catch (error) {
      console.error('Error updating word progress:', error);
      return false;
    }
  }

  async createSession(): Promise<number | null> {
    try {
      const result = await this.db!.runAsync(
        'INSERT INTO sessions (start_time) VALUES (CURRENT_TIMESTAMP)'
      );
      console.log('✅ Session created with ID:', result.lastInsertRowId);
      return result.lastInsertRowId;
    } catch (error) {
      console.error('Error creating session:', error);
      return null;
    }
  }

  async endSession(sessionId: number, wordsStudied: number, wordsLearned: number): Promise<boolean> {
    try {
      await this.db!.runAsync(
        'UPDATE sessions SET end_time = CURRENT_TIMESTAMP, words_studied = ?, words_learned = ? WHERE id = ?',
        [wordsStudied, wordsLearned, sessionId]
      );
      console.log('✅ Session ended successfully');
      return true;
    } catch (error) {
      console.error('Error ending session:', error);
      return false;
    }
  }

  async getSessionStats(limit: number = 10): Promise<Session[]> {
    try {
      const result = await this.db!.getAllAsync(
        'SELECT * FROM sessions WHERE end_time IS NOT NULL ORDER BY start_time DESC LIMIT ?',
        [limit]
      ) as Session[];
      return result || [];
    } catch (error) {
      console.error('Error getting session stats:', error);
      return [];
    }
  }

  async getVocabularyCount(): Promise<number> {
    try {
      const result = await this.db!.getFirstAsync('SELECT COUNT(*) as count FROM vocabulary') as { count: number };
      return result.count || 0;
    } catch (error) {
      console.error('Error getting vocabulary count:', error);
      return 0;
    }
  }
}

export default new DatabaseService();