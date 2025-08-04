# Vocam Practice Tab Documentation 📚


## 🎯 Key Features

### Question Types
- **Translation Questions** - Show original word, select translation
- **Reverse Translation** - Show translation, select original word  
- **Multiple Choice** - Select correct answer from 4 options
- **Context/Fill-in-the-Blank** - Complete sentences with missing words
- **Listening Questions** - Audio-based recognition
- **Typing Practice** - Type the correct translation
- **Pronunciation Recording** - Record and evaluate pronunciation
- **Audio Pronunciation** - Practice with native speech synthesis

### Adaptive Learning System
- **Smart Question Distribution** - Weighted variety across question types
- **Proficiency Tracking** - Words get easier/harder based on performance
- **Spaced Repetition** - Lower proficiency words appear more frequently
- **Progress Persistence** - All progress saved to user profile

### Gamification Elements
- **XP System** - Earn points for correct answers (10 XP per correct + bonuses)
- **Completion Bonuses** - Extra XP for finishing full sessions (20 XP for 10 questions, 100 XP for 20)
- **Streak Tracking** - Daily practice streaks maintained
- **Real-time Feedback** - Immediate haptic and visual feedback

## 🚀 Getting Started

### Prerequisites
- User must be authenticated (login required)
- At least 4 saved words in selected language
- Microphone permissions for recording features
- Speaker/audio enabled for listening questions

### Starting a Practice Session

1. **Select Language**: Choose from available languages based on saved vocabulary
2. **Choose Session Length**: 5, 10, or 20 questions
3. **Begin Practice**: System generates varied question types automatically
4. **Complete Session**: View results and earn XP

## 📱 User Interface

### Main Practice Screen
```
┌─ Progress Bar ─────────────────────────┐
├─ Question X of Y ──────────────── [×] ─┤
│                                        │
│  [Question Content]                    │
│  - Text prompt                         │
│  - Audio controls (if applicable)      │
│  - Hint system (expandable)            │
│                                        │
│  [Answer Options/Input Area]           │
│  - Multiple choice buttons             │
│  - Text input field                    │
│  - Recording controls                  │
│                                        │
│  [Next Question Button]                │
│  (appears after answering)             │
└────────────────────────────────────────┘
```

### Results Modal
```
┌─ Practice Complete! 🎉 ──────────────────┐
│                                          │
│       Score: 8/10 (80% Accuracy)        │
│           +100 XP Earned                 │
│                                          │
│  ✓ Correct: 8    ✗ Incorrect: 2         │
│                                          │
│            [Continue]                    │
└──────────────────────────────────────────┘
```

## 🔧 Technical Implementation

### Core Architecture

#### Main Components
```
practice.tsx                    # Main practice screen component
PracticeService.ts             # Business logic and session management
PracticeQuestionRenderer.tsx   # Question type rendering logic
PracticeStartScreen.tsx        # Language/session selection
```

#### Service Dependencies
```
SpeechService.ts              # Text-to-speech functionality  
RecordingService.ts           # Audio recording and evaluation
VocabularyService.ts          # Word data and proficiency updates
TranslationService.ts         # Translation API integration
AudioManager.ts               # Audio playback management
```

### Database Schema

#### Quiz Sessions
```sql
quiz_sessions:
  - id (UUID)
  - user_id (UUID)
  - started_at (timestamp)
  - score (integer)
  - total_questions (integer)
```

#### User XP Tracking
```sql
user_xp:
  - user_id (UUID)
  - xp_earned (integer)
  - source (text: 'practice')
  - session_id (UUID)
  - created_at (timestamp)
```

#### User Profiles
```sql
profiles:
  - user_id (UUID)
  - streak (integer)
  - last_login (timestamp)
  - total_xp (integer)
```

### Question Generation Algorithm

The system uses intelligent question distribution:

```typescript
const questionTypeDistribution = [
    { type: 'translation', weight: 0.2 },
    { type: 'reverse_translation', weight: 0.2 },
    { type: 'multiple_choice', weight: 0.15 },
    { type: 'listening', weight: 0.1 },
    { type: 'context', weight: 0.2 },
    { type: 'pronunciation', weight: 0.05 },
    { type: 'typing', weight: 0.05 },
    { type: 'recording', weight: 0.05 }
];
```

## 📊 Question Types Details

### 1. Translation Questions
- **Purpose**: Test recognition of target language words
- **Format**: Show English word → Select foreign language translation
- **Features**: 4 multiple choice options, audio pronunciation buttons
- **Difficulty**: Adaptive based on word proficiency

### 2. Reverse Translation  
- **Purpose**: Test comprehension of foreign language
- **Format**: Show/hear foreign word → Select English meaning
- **Features**: Auto-plays audio, multiple choice with distractors
- **Learning**: Strengthens listening comprehension

### 3. Context Questions
- **Purpose**: Test word usage in realistic sentences
- **Format**: Fill-in-the-blank with generated example sentences
- **Features**: AI-generated contexts, complete sentence audio
- **Intelligence**: Uses ExampleSentenceGenerator with translation APIs

### 4. Listening Questions
- **Purpose**: Audio recognition without visual cues
- **Format**: Audio-only → Select correct English word
- **Features**: Large play button, can replay multiple times
- **Challenge**: Tests pure audio comprehension

### 5. Recording Questions
- **Purpose**: Pronunciation practice with AI feedback
- **Format**: Record pronunciation → Get scored feedback
- **Features**: 5-second auto-stop, confidence scoring, feedback messages
- **Technology**: Uses device speech recognition APIs

### 6. Typing Practice
- **Purpose**: Spelling and recall without multiple choice
- **Format**: Show English → Type foreign language word
- **Features**: Auto-submit on enter, exact match validation
- **Learning**: Reinforces active recall and spelling

## 🎨 User Experience Features

### Visual Feedback System
- **Correct Answers**: Green highlighting, success haptics, scale animation
- **Incorrect Answers**: Red highlighting, error haptics, shake effect
- **Loading States**: Progress indicators, disabled buttons during processing
- **Smooth Transitions**: Fade animations between questions

### Audio Integration
- **Text-to-Speech**: Native pronunciation for all supported languages
- **Playback Controls**: Speaker buttons with visual feedback
- **Audio Management**: Automatic cleanup, prevents overlapping audio
- **Volume Optimization**: Consistent volume levels across languages

### Accessibility Features
- **Haptic Feedback**: Different patterns for success/failure
- **Visual Indicators**: Clear color coding for all answer states
- **Touch Targets**: Large, easily tappable buttons and controls
- **Font Scaling**: Responsive text sizing for readability

## 🌍 Language Support

### Supported Languages (45+)
- **European**: Spanish, French, German, Italian, Portuguese, Russian, etc.
- **Asian**: Chinese (Simplified/Traditional), Japanese, Korean, Hindi, etc.
- **Middle Eastern**: Arabic, Hebrew, Persian, Turkish
- **Others**: And many more with full translation support

### Language-Specific Features
- **Audio Pronunciation**: Native text-to-speech for all languages
- **Context Generation**: Culturally appropriate example sentences
- **Grammar Awareness**: Proper article usage in context questions
- **Writing Systems**: Support for non-Latin scripts (Arabic, Chinese, etc.)

## 📈 Progress Tracking

### Performance Metrics
- **Session Accuracy**: Percentage correct per session
- **Overall Statistics**: Total sessions, questions answered, accuracy trends
- **Proficiency Updates**: Words become easier/harder based on performance
- **Streak Maintenance**: Daily practice tracking

### XP and Rewards System
```typescript
// XP Calculation
const baseXP = correctAnswers * 10;
const bonusXP = {
    5: 0,    // No bonus for short sessions
    10: 20,  // +20 XP bonus for 10-question sessions
    20: 100  // +100 XP bonus for 20-question sessions
};
const totalXP = baseXP + bonusXP[sessionLength];
```

## 🛠️ Development Setup

### Running the Practice Tab

1. **Install Dependencies**
```bash
npm install
# or
yarn install
```

2. **Configure Environment**
```bash
# Set up Supabase credentials in app.config.js
extra: {
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
}
```

3. **Start Development Server**
```bash
npx expo start
```

4. **Test with Expo Go**
- Install Expo Go app on your device
- Scan QR code from terminal
- Navigate to Practice tab

### Required Permissions
```json
{
  "expo": {
    "plugins": [
      [
        "expo-av",
        {
          "microphonePermission": "Allow Vocam to record audio for pronunciation practice."
        }
      ]
    ]
  }
}
```

## 🔍 Testing Guidelines

### Manual Testing Checklist

#### Pre-Session
- [ ] Login required - shows appropriate login prompt
- [ ] Language selection shows only languages with 4+ words
- [ ] Session length selection (5, 10, 20 questions)
- [ ] Loading states during session initialization

#### During Session
- [ ] Question variety - different types appear
- [ ] Audio playback works for all question types
- [ ] Recording functionality (if supported on device)
- [ ] Progress bar updates correctly
- [ ] Hint system expands/collapses properly
- [ ] Answer feedback is immediate and clear

#### Post-Session
- [ ] Results modal shows correct statistics
- [ ] XP calculation is accurate
- [ ] Session data saves to database
- [ ] Can start new session immediately
- [ ] Progress persists between app launches

### Edge Cases to Test
- [ ] Very short words (1-2 characters)
- [ ] Very long words (15+ characters)
- [ ] Words with special characters or accents
- [ ] Network interruption during session
- [ ] Background app switching during audio playback
- [ ] Device rotation during practice session

## 🚨 Troubleshooting

### Common Issues

#### "Not enough vocabulary for practice"
- **Cause**: Less than 4 words saved in selected language
- **Solution**: Use detection tab to save more words first

#### Audio not playing
- **Cause**: Device volume off, audio permissions, or network issues
- **Solution**: Check device volume, restart app, verify internet connection

#### Recording not working
- **Cause**: Microphone permissions not granted
- **Solution**: Enable microphone permissions in device settings

#### Progress not saving
- **Cause**: Authentication issues or network problems
- **Solution**: Verify login status, check internet connection

### Debug Mode
Enable detailed logging by setting:
```typescript
// In PracticeService.ts
const DEBUG_MODE = true;
```

## 🔮 Future Enhancements

### Planned Features
- **Spaced Repetition Algorithm**: More sophisticated scheduling based on forgetting curves
- **Adaptive Difficulty**: Dynamic question complexity based on user performance
- **Social Features**: Compete with friends, share achievements
- **Offline Mode**: Practice without internet connection using cached data
- **Advanced Analytics**: Detailed progress insights and learning recommendations
- **Custom Study Sets**: Create focused practice sessions for specific topics

### Technical Improvements
- **Performance Optimization**: Faster question generation, reduced memory usage
- **Enhanced Audio**: Better compression, faster loading, offline caching
- **Accessibility**: Screen reader support, keyboard navigation
- **Platform-Specific**: iOS/Android native integrations for better UX

## 📚 Additional Resources

### API Documentation
- [Supabase JavaScript Client](https://supabase.com/docs/reference/javascript)
- [Expo Audio API](https://docs.expo.dev/versions/latest/sdk/audio/)
- [React Native AsyncStorage](https://react-native-async-storage.github.io/async-storage/)

### Related Components
- [Detection Tab README](./README_OBJECT_DETECTION.md)
- [Vocabulary Tab README](./README_VOCABULARY.md)
- [Main App Documentation](./README.md)

---

**Last Updated**: July 2025  
**Version**: 1.0.0  
**Maintainer**: Vocam Development Team