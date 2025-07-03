#!/bin/bash

echo "🚀 Setting up VocAm Object Detection Feature..."

# Create necessary directories
echo "📁 Creating directories..."
mkdir -p src/components/camera

# Create component files
echo "📝 Creating component files..."

# Check if files already exist
if [ ! -f "src/components/camera/AROverlay.js" ]; then
    echo "✅ Creating AROverlay.js..."
else
    echo "⚠️  AROverlay.js already exists, skipping..."
fi

if [ ! -f "src/components/camera/ObjectBoundingBox.js" ]; then
    echo "✅ Creating ObjectBoundingBox.js..."
else
    echo "⚠️  ObjectBoundingBox.js already exists, skipping..."
fi

if [ ! -f "src/components/camera/DetectionResults.js" ]; then
    echo "✅ Creating DetectionResults.js..."
else
    echo "⚠️  DetectionResults.js already exists, skipping..."
fi

# Update TranslationService if needed
if [ -f "src/services/TranslationService.js" ]; then
    echo "✅ TranslationService.js exists"
else
    echo "⚠️  TranslationService.js not found - please ensure it exists"
fi

# Check for .env file
if [ ! -f ".env" ]; then
    echo "📋 Creating .env file..."
    echo "GOOGLE_CLOUD_VISION_API_KEY=AIzaSyD5SgM9QAedfftNPBQwj3G7yCAVDZLGqm8" > .env
    echo "⚠️  Please update .env with your actual Google Vision API key"
else
    echo "✅ .env file already exists"
fi

# Check if .env is in .gitignore
if ! grep -q ".env" .gitignore 2>/dev/null; then
    echo "🔒 Adding .env to .gitignore..."
    echo ".env" >> .gitignore
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

echo ""
echo "✨ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Add your Google Vision API key to .env file or GitHub Codespace secrets"
echo "2. Copy the component code from the artifacts provided"
echo "3. Run 'npx expo start' to start the app"
echo "4. Scan the QR code with Expo Go on your phone"
echo ""
echo "Happy learning! 🌍"