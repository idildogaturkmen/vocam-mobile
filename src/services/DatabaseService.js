import * as SQLite from 'expo-sqlite';

class DatabaseService {
  constructor() {
    this.db = null;
  }

  async initialize() {
    try {
      this.db = await SQLite.openDatabaseAsync('language_learning.db');
      await this.createTables();
      console.log('✅ Database initialized successfully');
    } catch (error) {
      console.error('❌ Database initialization error:', error);
    }
  }

  async createTables() {
    const createVocabularyTable = `
      CREATE TABLE IF NOT EXISTS vocabulary (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        word_original TEXT NOT NULL,
        word_translated TEXT NOT NULL,
        language_translated TEXT NOT NULL,
        category TEXT DEFAULT 'camera_detection',
        image_path TEXT,
        date_added DATETIME DEFAULT CURRENT_TIMESTAMP,
        source TEXT DEFAULT 'camera'
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

    await this.db.execAsync(createVocabularyTable);
    await this.db.execAsync(createProgressTable);
    await this.db.execAsync(createSessionsTable);
  }

  async addVocabulary(wordData) {
    try {
      // Check if word already exists
      const existing = await this.db.getFirstAsync(
        'SELECT id FROM vocabulary WHERE word_original = ? AND language_translated = ?',
        [wordData.original, wordData.language]
      );

      if (existing) {
        console.log('Word already exists:', wordData.original);
        return existing.id;
      }

      const result = await this.db.runAsync(
        'INSERT INTO vocabulary (word_original, word_translated, language_translated, category, image_path, source) VALUES (?, ?, ?, ?, ?, ?)',
        [wordData.original, wordData.translated, wordData.language, wordData.category, wordData.imagePath, wordData.source]
      );
      
      // Initialize progress tracking
      await this.db.runAsync(
        'INSERT INTO user_progress (vocabulary_id, proficiency_level) VALUES (?, 0)',
        [result.lastInsertRowId]
      );
      
      return result.lastInsertRowId;
    } catch (error) {
      console.error('Error adding vocabulary:', error);
      return null;
    }
  }

  async getAllVocabulary() {
    try {
      const result = await this.db.getAllAsync(`
        SELECT v.*, up.proficiency_level, up.review_count, up.correct_count, up.last_reviewed
        FROM vocabulary v 
        LEFT JOIN user_progress up ON v.id = up.vocabulary_id 
        ORDER BY v.date_added DESC
      `);
      return result || [];
    } catch (error) {
      console.error('Error getting vocabulary:', error);
      return [];
    }
  }

  async updateWordProgress(vocabId, isCorrect) {
    try {
      const currentProgress = await this.db.getFirstAsync(
        'SELECT * FROM user_progress WHERE vocabulary_id = ?',
        [vocabId]
      );

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

      await this.db.runAsync(
        'UPDATE user_progress SET review_count = ?, correct_count = ?, proficiency_level = ?, last_reviewed = CURRENT_TIMESTAMP WHERE vocabulary_id = ?',
        [reviewCount, correctCount, proficiencyLevel, vocabId]
      );

      return true;
    } catch (error) {
      console.error('Error updating word progress:', error);
      return false;
    }
  }

  async createSession() {
    try {
      const result = await this.db.runAsync(
        'INSERT INTO sessions (start_time) VALUES (CURRENT_TIMESTAMP)'
      );
      return result.lastInsertRowId;
    } catch (error) {
      console.error('Error creating session:', error);
      return null;
    }
  }

  async endSession(sessionId, wordsStudied, wordsLearned) {
    try {
      await this.db.runAsync(
        'UPDATE sessions SET end_time = CURRENT_TIMESTAMP, words_studied = ?, words_learned = ? WHERE id = ?',
        [wordsStudied, wordsLearned, sessionId]
      );
      return true;
    } catch (error) {
      console.error('Error ending session:', error);
      return false;
    }
  }

  async getSessionStats(days = 30) {
    try {
      const result = await this.db.getFirstAsync(`
        SELECT 
          COUNT(*) as total_sessions,
          SUM(words_studied) as total_words_studied,
          SUM(words_learned) as total_words_learned,
          AVG(words_studied) as avg_words_per_session
        FROM sessions 
        WHERE start_time >= datetime('now', '-${days} days')
      `);
      
      return result || {};
    } catch (error) {
      console.error('Error getting session stats:', error);
      return {};
    }
  }
}

export default new DatabaseService();