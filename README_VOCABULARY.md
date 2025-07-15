# Vocam Vocabulary Feature Documentation

## Core Features

- **Smart duplicate detection** - prevents saving the same word multiple times in the same language
- **Language-specific saving** - allows the same word to be saved in different languages
- **Batch saving** for multiple words at once
- **Proficiency tracking** with visual indicators
- **Category organization** (food, animals, objects, etc.)
- **Flashcard mode** for vocabulary practice
- **Audio pronunciation** using native device text-to-speech
- **Example sentences** for context-based learning
- **Progress tracking** with user statistics and streaks

## Architecture

### File Structure
```
src/
├── services/
│   ├── VocabularyService.ts    # Database operations for vocabulary
│   ├── ObjectDetectionService.js # Google Vision API integration
│   ├── TranslationService.ts    # Translation API integration
│   ├── SpeechService.js         # Text-to-speech functionality
│   └── SessionService.ts        # User session and statistics
├── components/
│   └── detection/
│       ├── PhotoResult.js       # Displays detection results
│       ├── DetectionItem.js     # Individual detection card
│       └── CameraControls.js    # Camera UI controls

app
    ├── detection.tsx            # Main camera/detection screen
    └── vocabulary.tsx           # Vocabulary list and flashcards
```

### Database Schema (Supabase)

#### Tables

**words**
- `word_id` (UUID, primary key)
- `original` (text, unique)
- `created_at` (timestamp)

**translations**
- `word_id` (UUID, foreign key)
- `language_code` (text)
- `translated_text` (text)
- `example` (text) - Format: "translated|english"
- Unique constraint: (word_id, language_code)

**user_words**
- `id` (UUID, primary key)
- `user_id` (UUID, foreign key)
- `word_id` (UUID, foreign key)
- `proficiency` (integer, 0-100)
- `learned_at` (timestamp)

## Key Components

### VocabularyService

Handles all database operations for vocabulary management:

```typescript
// Save multiple words with duplicate prevention
saveMultipleWords(words, language, userId): Promise<BatchSaveResult>

// Get user's vocabulary with optional language filter
getUserVocabulary(userId, languageFilter?): Promise<SavedWord[]>

// Update word proficiency
updateProficiency(userWordId, newProficiency): Promise<boolean>

// Delete word from user's vocabulary
deleteWord(userWordId): Promise<boolean>
```

### TranslationService

Provides multi-language translation capabilities:

```typescript
// Translate text to target language
translateText(text, targetLanguage, sourceLanguage?): Promise<string>

// Get example sentence with translation
getExampleSentence(word, targetLanguage): Promise<ExampleSentence>
```

## Usage Flow

### 1. Detection Flow
1. User opens camera screen
2. Takes photo of objects
3. App resizes image and sends to Google Vision API
4. Detected objects are displayed with bounding boxes
5. Each object is automatically translated to selected language
6. Example sentences are generated for context

### 2. Saving Flow
1. User selects detected words to save
2. App checks for duplicates in the specific language
3. New words are saved to global word database
4. Translations are added for the specific language
5. Words are linked to user's vocabulary
6. User receives feedback on save status

### 3. Learning Flow
1. User accesses vocabulary screen
2. Can filter by language or search for specific words
3. View words in card format with:
   - Original word and translation
   - Proficiency level indicator
   - Audio pronunciation button
   - Example sentences
4. Switch to flashcard mode for practice
5. Track progress through statistics

## Configuration

### Required API Keys

Add to `app.config.js`:
```javascript
extra: {
  googleVisionApiKey: process.env.GOOGLE_CLOUD_VISION_API_KEY,
  googleCloudApiKey: process.env.GOOGLE_CLOUD_API_KEY,
}
```

## Key Features Implementation

### Duplicate Prevention
The system prevents duplicate saves by:
1. Checking if user already has the word in the specific language
2. Allowing the same word in different languages
3. Handling batch operations with proper deduplication

### Performance Optimizations
- Image resizing before API calls (800px max dimension)
- Batch database operations for multiple words
- Caching for translations
- 30-second timeout for API calls

### Error Handling
- Fallback translation service if primary fails
- Graceful handling of API errors
- User-friendly error messages
- Automatic retry logic for network issues

## Supported Languages

The system supports 45+ languages including:
- Major European languages (Spanish, French, German, Italian, etc.)
- Asian languages (Chinese, Japanese, Korean, Hindi, etc.)
- Middle Eastern languages (Arabic, Hebrew, Persian)
- And many more...

## User Experience Features

### Visual Feedback
- Confidence scores for detected objects
- Color-coded proficiency levels
- Loading states for all async operations
- Success/error notifications

### Accessibility
- Text-to-speech for all translations
- High contrast UI elements
- Clear typography
- Intuitive touch targets

## Future Enhancements
- Offline mode with cached vocabulary
- Spaced repetition algorithm
- Social features for sharing vocabulary
- Advanced analytics and insights
- Custom categories and tags