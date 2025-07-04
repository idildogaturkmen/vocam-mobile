# VocAm Mobile - Object Detection Camera Mode

This branch implements an AR-style camera mode with object detection, similar to Pokemon Go.

## 🚀 Quick Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Set up Google Vision API Key

#### Option A: GitHub Codespaces
1. Go to your GitHub repository settings
2. Navigate to Secrets and variables > Codespaces
3. Add a new secret named `GOOGLE_CLOUD_VISION_API_KEY`
4. Paste your Google Vision API key
5. Restart your Codespace

#### Option B: Local Development
1. Create a `.env` file in the root directory:
```bash
echo "GOOGLE_CLOUD_VISION_API_KEY=your_api_key_here" > .env
```
2. Make sure `.env` is in your `.gitignore`

### 3. Get a Google Vision API Key
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing
3. Enable the Cloud Vision API
4. Create credentials (API Key)
5. Copy the API key

### 4. Run the App
```bash
npx expo start
```

Then scan the QR code with Expo Go app on your phone.

## 📱 Features Implemented

### AR Camera Mode
- **Real-time object detection** with bounding boxes
- **Pokemon Go-style AR overlay** showing detected objects
- **Tap-to-learn interface** - tap any detected object for details
- **Confidence indicators** - color-coded boxes (green/yellow/orange)
- **Smooth animations** - entrance effects and glowing highlights

### Detection Capabilities
- Powered by Google Vision API
- Detects 1000+ object types
- Real-time translation to 8 languages
- Example sentences for context
- Categorization (electronics, food, furniture, etc.)

### User Experience
- **Manual mode**: Tap button to detect
- **Auto mode**: Continuous detection every 3 seconds
- **Settings panel**: Change language and detection mode
- **Save to vocabulary**: Store words for later review
- **Pronunciation practice**: Tap to hear words spoken

## 🎮 How to Use

1. **Grant camera permission** when prompted
2. **Point camera** at objects around you
3. **Tap scan button** (or enable auto-mode)
4. **See AR overlays** appear on detected objects
5. **Tap any object** to learn more
6. **Save words** to your vocabulary

## 📁 File Structure

```
feature/object-detection/
├── app/
│   └── (tabs)/
│       └── detection.tsx          # Main camera screen
├── src/
│   ├── components/
│   │   └── camera/
│   │       ├── AROverlay.js       # AR overlay container
│   │       ├── ObjectBoundingBox.js # Individual object boxes
│   │       └── DetectionResults.js  # Detail modal
│   └── services/
│       ├── ObjectDetectionService.js # Google Vision integration
│       └── TranslationService.js     # Translation logic
└── README_OBJECT_DETECTION.md
```

## 🛠️ Customization

### Adjust Detection Sensitivity
In `detection.tsx`, modify:
```javascript
const results = await ObjectDetectionService.detectObjects(
  photo.uri, 
  0.5  // Confidence threshold (0.0 - 1.0)
);
```

### Change Auto-Detection Interval
In `detection.tsx`, modify:
```javascript
const [autoDetectInterval, setAutoDetectInterval] = useState(3000); // milliseconds
```

### Add More Languages
Edit `TranslationService.js` to add translations for new languages.

## 🐛 Troubleshooting

### "API Key not found" Error
- Ensure GOOGLE_CLOUD_VISION_API_KEY is set in environment
- Restart Expo/Codespace after adding the key

### Objects Not Detected
- Check internet connection
- Verify API key has Vision API enabled
- Ensure good lighting conditions

### Performance Issues
- Reduce detection frequency in auto mode
- Lower image quality in camera settings

## 📝 Notes

- The app works best in well-lit environments
- Hold camera steady for better detection
- Some objects may have multiple valid labels
- Translations are currently using a local dictionary (can be upgraded to Google Translate API)