// Debug script to test API key loading
require('dotenv').config();

console.log('🔍 Debugging API Key Configuration\n');

// Check environment variables
console.log('Environment Variables:');
console.log('GOOGLE_CLOUD_VISION_API_KEY:', process.env.GOOGLE_CLOUD_VISION_API_KEY ? '✅ Set' : '❌ Not set');
console.log('GOOGLE_CLOUD_API_KEY:', process.env.GOOGLE_CLOUD_API_KEY ? '✅ Set' : '❌ Not set');

// Check app.config.js
const appConfig = require('./app.config.js').default;
console.log('\napp.config.js extra:');
console.log('googleVisionApiKey:', appConfig.expo.extra.googleVisionApiKey ? '✅ Set' : '❌ Not set');
console.log('googleCloudApiKey:', appConfig.expo.extra.googleCloudApiKey ? '✅ Set' : '❌ Not set');

// Check .env file
const fs = require('fs');
if (fs.existsSync('.env')) {
  console.log('\n.env file: ✅ Exists');
  const envContent = fs.readFileSync('.env', 'utf8');
  const hasVisionKey = envContent.includes('GOOGLE_CLOUD_VISION_API_KEY');
  const hasCloudKey = envContent.includes('GOOGLE_CLOUD_API_KEY');
  console.log('Contains GOOGLE_CLOUD_VISION_API_KEY:', hasVisionKey ? '✅ Yes' : '❌ No');
  console.log('Contains GOOGLE_CLOUD_API_KEY:', hasCloudKey ? '✅ Yes' : '❌ No');
} else {
  console.log('\n.env file: ❌ Not found');
}

console.log('\n💡 Troubleshooting Tips:');
console.log('1. Make sure .env file is in the root directory');
console.log('2. Format should be: GOOGLE_CLOUD_VISION_API_KEY=your_actual_key_here');
console.log('3. No quotes around the API key');
console.log('4. Restart Expo after adding the key');
console.log('5. For Codespaces, set the secret and restart the Codespace');