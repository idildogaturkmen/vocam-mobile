```markdown
# Vocam - Object Detection Camera Mode

Language learning camera mode that detects objects in real-time, translates them into 40+ languages, and generates contextually appropriate example sentences.

## Quick Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Set up API Keys

#### Google Cloud Vision API Key (Required)
**Option A: GitHub Codespaces**
1. Go to your GitHub repository settings
2. Navigate to Secrets and variables > Codespaces
3. Add a new secret named `GOOGLE_CLOUD_VISION_API_KEY`
4. Paste your Google Vision API key
5. Restart your Codespace

**Option B: Local Development**
```bash
echo "GOOGLE_CLOUD_VISION_API_KEY=your_api_key_here" > .env
```

#### Google Cloud Translation API Key (Optional but Recommended)
Add `GOOGLE_CLOUD_API_KEY` to your environment for better translation quality.

### 3. Get API Keys
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing
3. Enable the Cloud Vision API
4. Enable the Cloud Translation API (optional)
5. Create credentials (API Key)
6. Copy the API key(s)

### 4. Run the App
```bash
npx expo start
```

Then scan the QR code with Expo Go app on your phone.

## 📱 Features

### Camera & Detection
- **Real-time object detection** with bounding boxes
- **Confidence indicators** - color-coded boxes (green >80%, yellow >60%, orange >50%)
- **Auto-rotation handling** - Images automatically rotated for correct detection
- **Multi-object detection** - Detect up to 10 objects per photo
- **Manual word input** - Add words without taking photos

### Language Support (40+ Languages)
- Spanish, French, German, Italian, Portuguese, Russian
- Chinese (Simplified & Traditional), Japanese, Korean
- Arabic, Hindi, Turkish, Dutch, Swedish, Polish
- And many more including Latin!

### Enhanced Example Sentences
- **Context-aware generation** - Different templates for animals, clothing, tools, etc.
- **Multiple complexity levels** - Basic, intermediate, and advanced sentences
- **Smart filtering** - Ensures examples are appropriate and educational
- **API fallback** - Uses free dictionary APIs when available
- **Template diversity** - Avoids repetitive sentence structures

### Translation & Learning
- **Instant translation** - Selected objects translated immediately
- **Example sentences** - Each word comes with a contextual example
- **Pronunciation** - Tap any word to hear it spoken
- **Language switching** - Change target language even after detection

### Data Management
- **Save to vocabulary** - Store words for later review
- **Session tracking** - Monitor words studied and learned
- **Category organization** - Words automatically categorized
- **Offline caching** - Previously detected words cached locally

## 🎮 How to Use

1. **Grant camera permission** when prompted
2. **Select target language** using the blue button
3. **Take a photo** of objects around you
4. **Review detections** with translations and examples
5. **Select words** you want to learn
6. **Save to vocabulary** for later practice

### Pro Tips
- **Change language after detection**: Tap the language button to re-translate all detected objects
- **Manual input**: Use the keyboard icon to add words without photos
- **Batch selection**: Select multiple words before saving
- **Listen first**: Tap speaker icons to hear pronunciation before saving

## 📁 Project Structure

```
vocam-mobile/
├── app/
│   └── (tabs)/
│       └── detection.tsx              # Main detection screen
├── src/
│   ├── components/
│   │   └── detection/
│   │       ├── CameraControls.js      # Camera UI controls
│   │       ├── DetectionItem.js       # Individual detection card
│   │       └── PhotoResult.js         # Results display with AR overlay
│   ├── services/
│   │   ├── ObjectDetectionService.js  # Google Vision API integration
│   │   ├── TranslationService.js      # Translation with fallbacks
│   │   ├── ExampleSentenceGenerator.js # Smart sentence generation
│   │   ├── ExampleSentenceFilters.js  # Content filtering logic
│   │   ├── ExampleTemplates.js        # Template library
│   │   ├── WordCategorizer.js         # Word categorization logic
│   │   ├── SpeechService.js           # Text-to-speech
│   │   ├── DatabaseService.js         # SQLite integration
│   │   └── ImageUtils.js              # Image rotation/processing
│   └── types/
└── README.md
```

## 🛠️ Advanced Configuration

### Adjust Detection Parameters
```javascript
// In detection.tsx
const results = await ObjectDetectionService.detectObjects(
  imageUri, 
  0.5  // Confidence threshold (0.0 - 1.0)
);
```

### Configure Example Sentence Generation
```javascript
// Enable debug mode for sentence filtering
ExampleSentenceGenerator.setDebug(true);

// Adjust template complexity weights
// In ExampleSentenceGenerator.js
weights = [0.5, 0.3, 0.2]; // [basic, intermediate, advanced]
```

### Add Custom Word Categories
```javascript
// In WordCategorizer.js
this.categoryWords.customCategory = [
  "word1", "word2", "word3"
];
```

## 🌟 Key Features Explained

### Smart Example Sentences
The app generates contextually appropriate example sentences using:
- **Category detection**: Identifies if a word is an animal, clothing, tool, etc.
- **Complexity matching**: Adjusts sentence difficulty for language learners
- **Context filtering**: Ensures "bear" gets animal examples, not verb examples
- **API integration**: Uses free dictionary APIs when available
- **Template diversity**: 100+ templates across different categories

### Image Processing
- **EXIF data handling**: Strips metadata for privacy
- **Auto-rotation**: Corrects image orientation before detection
- **Efficient caching**: Reduces API calls for repeated detections

### Multi-language Support
- **40+ languages**: Comprehensive language coverage
- **Fallback translation**: Uses MyMemory API if Google Translation unavailable
- **Cached translations**: Reduces API usage and improves speed

## 🐛 Troubleshooting

### "API Key not found" Error
- Ensure `GOOGLE_CLOUD_VISION_API_KEY` is set in environment
- Restart Expo/Codespace after adding the key
- Check console logs for which API key source is being used

### Objects Not Detected
- Check internet connection
- Verify API key has Vision API enabled
- Ensure good lighting conditions
- Try adjusting confidence threshold

### Translation Issues
- Verify internet connectivity
- Check if target language is supported
- Enable Google Translation API for better quality

### Example Sentences Not Generating
- Check console for API errors
- Verify word categorization is working
- Try enabling debug mode to see filtering decisions

### Performance Issues
- Reduce number of simultaneous detections
- Clear app cache if too many cached translations
- Disable debug logging in production

## 📝 Development Notes

### API Rate Limits
- Google Vision: 1800 requests/minute
- Free Dictionary API: No hard limit but be respectful
- MyMemory Translation: 1000 words/day (free tier)

### Best Practices
- Test with various lighting conditions
- Include diverse objects for better categorization testing
- Monitor API usage to avoid exceeding quotas
- Cache aggressively to reduce API calls

### Future Enhancements
- Offline mode with pre-downloaded translations
- AR overlay improvements
- Real-time continuous detection mode
- Integration with spaced repetition system

## 🤝 Contributing

When adding new features:
1. Update WordCategorizer for new word types
2. Add appropriate templates in ExampleTemplates
3. Implement filters in ExampleSentenceFilters
4. Test with multiple languages
5. Update this README