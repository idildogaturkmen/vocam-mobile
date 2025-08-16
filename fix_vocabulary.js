// Quick script to run fixVocabularyDisplay function
const { createClient } = require('@supabase/supabase-js');

async function runFix() {
    try {
        // Import the VocabularyService
        const VocabularyService = require('./src/services/VocabularyService.ts').default;
        
        console.log('🔧 Running fixVocabularyDisplay...');
        
        // Check if the function is available globally
        if (typeof global.fixVocabularyDisplay === 'function') {
            const result = await global.fixVocabularyDisplay();
            console.log('✅ Fix result:', result);
        } else {
            console.log('⚠️ Global function not found, trying to import and run...');
            
            // Load the service to ensure the global function is registered
            const service = VocabularyService.getInstance();
            
            // Try again
            if (typeof global.fixVocabularyDisplay === 'function') {
                const result = await global.fixVocabularyDisplay();
                console.log('✅ Fix result:', result);
            } else {
                console.log('❌ Could not find fixVocabularyDisplay function');
            }
        }
        
    } catch (error) {
        console.error('❌ Error running fix:', error);
    }
}

runFix();