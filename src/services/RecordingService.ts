import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import Constants from 'expo-constants';
import AudioManager from './AudioManager';

interface RecordingEvaluation {
    isCorrect: boolean;
    confidence: number;
    feedback: string;
    transcription?: string;
}

class RecordingService {
    private recording: Audio.Recording | null = null;
    private recordingUri: string | null = null;
    private permissionResponse: Audio.PermissionResponse | null = null;
    private _isRecording: boolean = false;

    get isRecording(): boolean {
        return this._isRecording;
    }

    async initialize() {
        try {
            // Request permissions
            const permission = await Audio.requestPermissionsAsync();
            this.permissionResponse = permission;
            
            if (permission.status !== 'granted') {
                console.error('❌ Recording permission not granted');
                return false;
            }

            // Configure audio mode for recording - NO interruption modes
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
                staysActiveInBackground: false,
                shouldDuckAndroid: true,
                playThroughEarpieceAndroid: false,
            });
            return true;
        } catch (error) {
            console.error('❌ Recording Service initialization failed:', error);
            return false;
        }
    }

    async startRecording(): Promise<boolean> {
        try {
            // Check permissions
            if (!this.permissionResponse || this.permissionResponse.status !== 'granted') {
                const permission = await Audio.requestPermissionsAsync();
                if (permission.status !== 'granted') {
                    console.error('❌ Recording permission denied');
                    return false;
                }
                this.permissionResponse = permission;
            }

            // Stop any existing recording
            if (this.recording) {
                await this.stopRecording();
            }

            // Use AudioManager to configure for recording
            await AudioManager.configureForRecording();

            // Create and start recording
            const { recording } = await Audio.Recording.createAsync(
                Audio.RecordingOptionsPresets.HIGH_QUALITY
            );

            this.recording = recording;
            this._isRecording = true;
            return true;
        } catch (error) {
            console.error('❌ Failed to start recording:', error);
            this._isRecording = false;
            return false;
        }
    }

    async stopRecording(): Promise<string | null> {
        try {
            if (!this.recording) {
                console.warn('⚠️ No active recording to stop');
                return null;
            }
            
            // Stop the recording first
            await this.recording.stopAndUnloadAsync();
            const uri = this.recording.getURI();
            
            this.recording = null;
            this.recordingUri = uri;
            this._isRecording = false;
            
            // Wait for recording to fully stop
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Reset audio system in steps
            try {
                // Step 1: Disable audio completely
                await Audio.setIsEnabledAsync(false);
                await new Promise(resolve => setTimeout(resolve, 300));
                
                // Step 2: Re-enable audio
                await Audio.setIsEnabledAsync(true);
                await new Promise(resolve => setTimeout(resolve, 300));
                
                // Step 3: Set initial audio mode
                await Audio.setAudioModeAsync({
                    allowsRecordingIOS: false,
                    playsInSilentModeIOS: true,
                    staysActiveInBackground: true,
                    shouldDuckAndroid: false,
                    playThroughEarpieceAndroid: false,
                });
                
                // Step 4: Wait for system to stabilize
                await new Promise(resolve => setTimeout(resolve, 300));
                
                // Step 5: Configure audio manager for playback
                await AudioManager.configureForPlayback();
                
                // Step 6: Final audio mode configuration
                await Audio.setAudioModeAsync({
                    allowsRecordingIOS: false,
                    playsInSilentModeIOS: true,
                    staysActiveInBackground: true,
                    shouldDuckAndroid: false,
                    playThroughEarpieceAndroid: false,
                });
            } catch (e) {
                console.warn('Audio system reset warning:', e);
            }
            
            return uri;
        } catch (error) {
            console.error('❌ Failed to stop recording:', error);
            this._isRecording = false;
            // Still try to switch back to playback mode
            await AudioManager.configureForPlayback();
            return null;
        }
    }

    async checkPermissions(): Promise<boolean> {
        try {
            const { status } = await Audio.requestPermissionsAsync();
            return status === 'granted';
        } catch (error) {
            console.error('Permission check error:', error);
            return false;
        }
    }

    async testMicrophone(): Promise<{ success: boolean; message: string; audioLevel?: number }> {
        try {
            // First check permissions
            const hasPermission = await this.checkPermissions();
            if (!hasPermission) {
                return {
                    success: false,
                    message: 'Microphone permission not granted. Please enable microphone access in your device settings.'
                };
            }

            // Initialize if not already done
            if (!this.permissionResponse) {
                const initialized = await this.initialize();
                if (!initialized) {
                    return {
                        success: false,
                        message: 'Failed to initialize audio system. Please check your device settings.'
                    };
                }
            }

            // Try to start a brief recording to test the microphone
            const recordingStarted = await this.startRecording();
            if (!recordingStarted) {
                return {
                    success: false,
                    message: 'Failed to start recording. Microphone may be in use by another app.'
                };
            }

            // Record for 1 second to test
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Stop the test recording
            const recordingUri = await this.stopRecording();
            if (!recordingUri) {
                return {
                    success: false,
                    message: 'Failed to complete test recording.'
                };
            }

            // Check if the recording file exists and has content
            try {
                const fileInfo = await FileSystem.getInfoAsync(recordingUri);
                if (!fileInfo.exists || (fileInfo.size && fileInfo.size < 1000)) {
                    return {
                        success: false,
                        message: 'Recording appears to be empty. Please check your microphone settings.'
                    };
                }

                // Clean up the test recording
                await FileSystem.deleteAsync(recordingUri, { idempotent: true });

                return {
                    success: true,
                    message: 'Microphone test successful! Your microphone is working properly.',
                    audioLevel: fileInfo.size ? Math.min(100, Math.max(0, (fileInfo.size / 10000) * 100)) : 50
                };
            } catch (fileError) {
                console.error('File check error:', fileError);
                return {
                    success: false,
                    message: 'Unable to verify recording quality. Please try again.'
                };
            }
        } catch (error) {
            console.error('Microphone test error:', error);
            return {
                success: false,
                message: 'Microphone test failed. Please check your device settings and try again.'
            };
        }
    }

    async evaluatePronunciation(
        recordingUri: string, 
        expectedText: string, 
        language: string
    ): Promise<RecordingEvaluation> {
        try {
            if (!recordingUri) {
                throw new Error('No recording URI provided');
            }

            // Read the audio file
            const audioBytes = await FileSystem.readAsStringAsync(recordingUri, {
                encoding: FileSystem.EncodingType.Base64,
            });

            // Language mapping for Google Speech API
            const languageMap: Record<string, string> = {
                'es': 'es-ES',
                'fr': 'fr-FR',
                'de': 'de-DE',
                'it': 'it-IT',
                'pt': 'pt-PT',
                'ru': 'ru-RU',
                'ja': 'ja-JP',
                'zh-CN': 'zh-CN',
                'ko': 'ko-KR',
                'ar': 'ar-SA',
                'hi': 'hi-IN',
                'nl': 'nl-NL',
                'pl': 'pl-PL',
                'tr': 'tr-TR',
                'en': 'en-US'
            };
            
            const speechLanguage = languageMap[language] || language;
            
            // Prepare the request for Google Cloud Speech-to-Text
            const request = {
                config: {
                    encoding: 'WEBM_OPUS',
                    sampleRateHertz: 48000,
                    languageCode: speechLanguage,
                    model: 'default',
                    useEnhanced: false,
                    enableWordTimeOffsets: false,
                    enableAutomaticPunctuation: false,
                    speechContexts: [{
                        phrases: [expectedText],
                        boost: 20
                    }]
                },
                audio: {
                    content: audioBytes
                }
            };
            
            // Make the API call to Google Cloud Speech-to-Text
            const response = await fetch(
                `https://speech.googleapis.com/v1/speech:recognize?key=${this.getGoogleCloudApiKey()}`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(request)
                }
            );
            
            if (!response.ok) {
                const error = await response.text();
                console.error('Speech API error:', error);
                throw new Error(`Speech API error: ${response.status}`);
            }
            
            const data = await response.json();        
            // Process the transcription results
            if (!data.results || data.results.length === 0) {
                return {
                    isCorrect: false,
                    confidence: 0,
                    feedback: 'Could not detect any speech. Please speak clearly and try again.',
                    transcription: ''
                };
            }
            
            // Get the best transcription
            const result = data.results[0];
            const alternative = result.alternatives[0];
            const transcription = alternative.transcript || '';
            const recognitionConfidence = alternative.confidence || 0;
            
            console.log('Transcription:', transcription);
            console.log('Recognition confidence:', recognitionConfidence);
            
            // Evaluate the pronunciation
            const evaluation = this.evaluateTranscription(
                transcription,
                expectedText,
                recognitionConfidence,
                language
            );
            
            return evaluation;
            
        } catch (error) {
            console.error('❌ Evaluation failed:', error);
            
            return {
                isCorrect: false,
                confidence: 0,
                feedback: 'Unable to evaluate pronunciation. Please check your internet connection and try again.',
                transcription: ''
            };
        }
    }

    private evaluateTranscription(
        transcription: string,
        expectedText: string,
        recognitionConfidence: number,
        language: string
    ): RecordingEvaluation {
        // Normalize both texts for comparison
        const normalizedTranscription = this.normalizeText(transcription, language);
        const normalizedExpected = this.normalizeText(expectedText, language);
        
        console.log('Normalized transcription:', normalizedTranscription);
        console.log('Normalized expected:', normalizedExpected);
        
        // Advanced pronunciation evaluation with multiple metrics
        const metrics = this.calculateAdvancedMetrics(
            normalizedTranscription,
            normalizedExpected,
            transcription,
            expectedText,
            language,
            recognitionConfidence
        );
        
        console.log('Advanced metrics:', metrics);
        
        // Calculate final score using sophisticated weighting
        const combinedScore = this.calculateWeightedScore(metrics, language);
        
        // Determine if pronunciation is correct based on threshold
        const threshold = this.getThresholdForLanguage(language);
        const isCorrect = combinedScore >= threshold;
        
        // Generate appropriate feedback
        const feedback = this.generateFeedback(
            combinedScore,
            isCorrect,
            transcription,
            expectedText,
            language
        );
        
        return {
            isCorrect,
            confidence: Math.round(combinedScore * 100),
            feedback,
            transcription: transcription || 'Could not recognize speech'
        };
    }

    private normalizeText(text: string, language: string): string {
        // Basic normalization
        let normalized = text.toLowerCase().trim();
        
        // Remove punctuation
        normalized = normalized.replace(/[.,!?;:'"]/g, '');
        
        // Language-specific normalization
        if (language === 'fr') {
            // French: handle accents
            normalized = normalized
                .replace(/[àâä]/g, 'a')
                .replace(/[éèêë]/g, 'e')
                .replace(/[îï]/g, 'i')
                .replace(/[ôö]/g, 'o')
                .replace(/[ùûü]/g, 'u')
                .replace(/ç/g, 'c');
        } else if (language === 'de') {
            // German: handle umlauts
            normalized = normalized
                .replace(/ä/g, 'ae')
                .replace(/ö/g, 'oe')
                .replace(/ü/g, 'ue')
                .replace(/ß/g, 'ss');
        } else if (language === 'es') {
            // Spanish: handle accents and ñ
            normalized = normalized
                .replace(/[áà]/g, 'a')
                .replace(/[éè]/g, 'e')
                .replace(/[íì]/g, 'i')
                .replace(/[óò]/g, 'o')
                .replace(/[úù]/g, 'u')
                .replace(/ñ/g, 'n');
        }
        
        // Remove extra whitespace
        normalized = normalized.replace(/\s+/g, ' ');
        
        return normalized;
    }

    private calculateSimilarity(text1: string, text2: string): number {
        if (text1 === text2) return 1;
        if (!text1 || !text2) return 0;
        
        // Jaccard similarity
        const set1 = new Set(text1.split(''));
        const set2 = new Set(text2.split(''));
        const intersection = new Set([...set1].filter(x => set2.has(x)));
        const union = new Set([...set1, ...set2]);
        
        return intersection.size / union.size;
    }

    private levenshteinSimilarity(text1: string, text2: string): number {
        const distance = this.levenshteinDistance(text1, text2);
        const maxLength = Math.max(text1.length, text2.length);
        return maxLength === 0 ? 1 : 1 - (distance / maxLength);
    }

    private levenshteinDistance(text1: string, text2: string): number {
        if (!text1) return text2.length;
        if (!text2) return text1.length;
        
        const matrix = [];
        
        for (let i = 0; i <= text2.length; i++) {
            matrix[i] = [i];
        }
        
        for (let j = 0; j <= text1.length; j++) {
            matrix[0][j] = j;
        }
        
        for (let i = 1; i <= text2.length; i++) {
            for (let j = 1; j <= text1.length; j++) {
                if (text2.charAt(i - 1) === text1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }
        
        return matrix[text2.length][text1.length];
    }

    private wordMatchScore(text1: string, text2: string): number {
        const words1 = text1.split(' ').filter(w => w.length > 0);
        const words2 = text2.split(' ').filter(w => w.length > 0);
        
        if (words1.length === 0 || words2.length === 0) return 0;
        
        let matchedWords = 0;
        for (const word1 of words1) {
            for (const word2 of words2) {
                if (this.levenshteinSimilarity(word1, word2) > 0.8) {
                    matchedWords++;
                    break;
                }
            }
        }
        return matchedWords / Math.max(words1.length, words2.length);
    }

    private calculateAdvancedMetrics(
        normalizedTranscription: string,
        normalizedExpected: string,
        originalTranscription: string,
        originalExpected: string,
        language: string,
        recognitionConfidence: number
    ) {
        // Fast exact match check - if perfect, skip complex calculations
        const exactMatch = normalizedTranscription === normalizedExpected ? 1.0 : 0.0;
        if (exactMatch === 1.0) {
            return {
                exactMatch: 1.0,
                similarity: 1.0,
                levenshteinScore: 1.0,
                wordMatchScore: 1.0,
                phoneticSimilarity: 1.0,
                syllableAccuracy: 1.0,
                lengthSimilarity: 1.0,
                structuralSimilarity: 1.0,
                confidenceWeight: this.calculateConfidenceWeight(recognitionConfidence),
                languageBonus: 0.1, // Perfect match bonus
                recognitionConfidence
            };
        }
        
        // Core metrics (fast calculations)
        const similarity = this.calculateSimilarity(normalizedTranscription, normalizedExpected);
        const levenshteinScore = this.levenshteinSimilarity(normalizedTranscription, normalizedExpected);
        const wordMatchScore = this.wordMatchScore(normalizedTranscription, normalizedExpected);
        
        // Quick length check
        const lengthSimilarity = this.calculateLengthSimilarity(normalizedTranscription, normalizedExpected);
        
        // Simplified phonetic and syllable analysis for speed
        const phoneticSimilarity = this.fastPhoneticSimilarity(normalizedTranscription, normalizedExpected);
        const syllableAccuracy = this.fastSyllableAccuracy(normalizedTranscription, normalizedExpected);
        const structuralSimilarity = similarity; // Use similarity as proxy for structure
        
        // Fast confidence weighting
        const confidenceWeight = this.calculateConfidenceWeight(recognitionConfidence);
        
        // Quick language bonus check
        const languageBonus = this.fastLanguageBonus(normalizedTranscription, normalizedExpected, language);
        
        return {
            exactMatch,
            similarity,
            levenshteinScore,
            wordMatchScore,
            phoneticSimilarity,
            syllableAccuracy,
            lengthSimilarity,
            structuralSimilarity,
            confidenceWeight,
            languageBonus,
            recognitionConfidence
        };
    }

    private calculateWeightedScore(metrics: any, language: string): number {
        // Language-specific weight adjustments
        const weights = this.getLanguageWeights(language);
        
        // Calculate base score with sophisticated weighting
        let baseScore = (
            metrics.exactMatch * weights.exactMatch +
            metrics.similarity * weights.similarity +
            metrics.levenshteinScore * weights.levenshtein +
            metrics.wordMatchScore * weights.wordMatch +
            metrics.phoneticSimilarity * weights.phonetic +
            metrics.syllableAccuracy * weights.syllable +
            metrics.lengthSimilarity * weights.length +
            metrics.structuralSimilarity * weights.structural
        );
        
        // Apply confidence weighting
        baseScore *= metrics.confidenceWeight;
        
        // Apply language-specific bonus
        baseScore += metrics.languageBonus;
        
        // Ensure score is between 0 and 1
        return Math.max(0, Math.min(1, baseScore));
    }

    private calculatePhoneticSimilarity(text1: string, text2: string, language: string): number {
        // Simplified phonetic analysis - compare sound patterns
        const phonetic1 = this.getPhoneticRepresentation(text1, language);
        const phonetic2 = this.getPhoneticRepresentation(text2, language);
        return this.levenshteinSimilarity(phonetic1, phonetic2);
    }

    private calculateSyllableAccuracy(text1: string, text2: string, language: string): number {
        const syllables1 = this.countSyllables(text1, language);
        const syllables2 = this.countSyllables(text2, language);
        
        if (syllables1 === 0 && syllables2 === 0) return 1.0;
        if (syllables1 === 0 || syllables2 === 0) return 0.0;
        
        const difference = Math.abs(syllables1 - syllables2);
        const maxSyllables = Math.max(syllables1, syllables2);
        return 1 - (difference / maxSyllables);
    }

    private calculateLengthSimilarity(text1: string, text2: string): number {
        const len1 = text1.length;
        const len2 = text2.length;
        
        if (len1 === 0 && len2 === 0) return 1.0;
        if (len1 === 0 || len2 === 0) return 0.0;
        
        const difference = Math.abs(len1 - len2);
        const maxLength = Math.max(len1, len2);
        return 1 - (difference / maxLength);
    }

    private calculateStructuralSimilarity(text1: string, text2: string): number {
        // Analyze word structure patterns
        const structure1 = this.getWordStructure(text1);
        const structure2 = this.getWordStructure(text2);
        return this.levenshteinSimilarity(structure1, structure2);
    }

    private calculateConfidenceWeight(recognitionConfidence: number): number {
        // Non-linear confidence weighting - higher confidence gets exponential boost
        if (recognitionConfidence >= 0.9) return 1.0;
        if (recognitionConfidence >= 0.7) return 0.95;
        if (recognitionConfidence >= 0.5) return 0.85;
        if (recognitionConfidence >= 0.3) return 0.7;
        return 0.5; // Very low confidence
    }

    private calculateLanguageSpecificBonus(text1: string, text2: string, language: string): number {
        // Language-specific pronunciation bonuses
        let bonus = 0;
        
        // Exact match bonus
        if (text1 === text2) bonus += 0.1;
        
        // Language-specific patterns
        switch (language) {
            case 'en':
                // English: bonus for common contractions and variations
                if (this.hasCommonEnglishVariations(text1, text2)) bonus += 0.05;
                break;
            case 'es':
                // Spanish: bonus for accent variations
                if (this.hasSpanishAccentVariations(text1, text2)) bonus += 0.05;
                break;
            case 'fr':
                // French: bonus for liaison and accent variations
                if (this.hasFrenchLiaisonVariations(text1, text2)) bonus += 0.05;
                break;
        }
        
        return bonus;
    }

    private getLanguageWeights(language: string) {
        // Language-specific weight configurations for different metrics
        const defaultWeights = {
            exactMatch: 0.25,
            similarity: 0.20,
            levenshtein: 0.15,
            wordMatch: 0.15,
            phonetic: 0.10,
            syllable: 0.08,
            length: 0.04,
            structural: 0.03
        };

        // Language-specific adjustments
        switch (language) {
            case 'en':
                return {
                    ...defaultWeights,
                    phonetic: 0.12, // English benefits from phonetic analysis
                    wordMatch: 0.18
                };
            case 'zh-CN':
            case 'ja':
                return {
                    ...defaultWeights,
                    syllable: 0.15, // Tonal languages benefit from syllable accuracy
                    phonetic: 0.15
                };
            case 'fr':
            case 'es':
                return {
                    ...defaultWeights,
                    phonetic: 0.14, // Romance languages benefit from phonetic analysis
                    structural: 0.05
                };
            default:
                return defaultWeights;
        }
    }

    private getPhoneticRepresentation(text: string, language: string): string {
        // Simplified phonetic mapping - in a real implementation, you'd use IPA or Soundex
        let phonetic = text.toLowerCase();
        
        // Basic phonetic transformations
        phonetic = phonetic
            .replace(/ph/g, 'f')
            .replace(/th/g, 't')
            .replace(/ch/g, 'k')
            .replace(/sh/g, 's')
            .replace(/ck/g, 'k')
            .replace(/[aeiou]+/g, 'V') // Vowels to V
            .replace(/[bcdfghjklmnpqrstvwxyz]+/g, 'C'); // Consonants to C
        
        return phonetic;
    }

    private countSyllables(text: string, language: string): number {
        if (!text) return 0;
        
        // Basic syllable counting - count vowel groups
        const vowelGroups = text.toLowerCase().match(/[aeiouáéíóúàèìòùâêîôûäëïöü]+/g);
        return vowelGroups ? vowelGroups.length : 1;
    }

    private getWordStructure(text: string): string {
        // Convert to pattern: C=consonant, V=vowel, S=space
        return text.toLowerCase()
            .replace(/[aeiouáéíóúàèìòùâêîôûäëïöü]/g, 'V')
            .replace(/[bcdfghjklmnpqrstvwxyzñç]/g, 'C')
            .replace(/\s+/g, 'S');
    }

    private hasCommonEnglishVariations(text1: string, text2: string): boolean {
        // Check for common English pronunciation variations
        const variations = [
            ['color', 'colour'],
            ['center', 'centre'],
            ['ize', 'ise'],
            ['or', 'our']
        ];
        
        for (const [var1, var2] of variations) {
            if ((text1.includes(var1) && text2.includes(var2)) ||
                (text1.includes(var2) && text2.includes(var1))) {
                return true;
            }
        }
        return false;
    }

    private hasSpanishAccentVariations(text1: string, text2: string): boolean {
        // Remove accents and compare
        const removeAccents = (str: string) => str
            .replace(/[áàâä]/g, 'a')
            .replace(/[éèêë]/g, 'e')
            .replace(/[íìîï]/g, 'i')
            .replace(/[óòôö]/g, 'o')
            .replace(/[úùûü]/g, 'u');
        
        return removeAccents(text1) === removeAccents(text2);
    }

    private hasFrenchLiaisonVariations(text1: string, text2: string): boolean {
        // Check for French liaison patterns (simplified)
        const liaisons = [
            ['les enfants', 'les zenfants'],
            ['un ami', 'un nami'],
            ['ils ont', 'ils zont']
        ];
        
        for (const [standard, liaison] of liaisons) {
            if ((text1.includes(standard) && text2.includes(liaison)) ||
                (text1.includes(liaison) && text2.includes(standard))) {
                return true;
            }
        }
        return false;
    }

    // Fast/optimized versions of pronunciation analysis methods
    private fastPhoneticSimilarity(text1: string, text2: string): number {
        // Quick phonetic comparison - just check first/last sounds and length
        if (text1.length === 0 || text2.length === 0) return 0;
        
        const firstMatch = text1[0] === text2[0] ? 0.3 : 0;
        const lastMatch = text1[text1.length - 1] === text2[text2.length - 1] ? 0.3 : 0;
        const lengthSimilarity = 1 - Math.abs(text1.length - text2.length) / Math.max(text1.length, text2.length);
        
        return (firstMatch + lastMatch + lengthSimilarity * 0.4);
    }

    private fastSyllableAccuracy(text1: string, text2: string): number {
        // Quick syllable estimation - count vowel clusters
        const countVowelClusters = (text: string) => {
            const matches = text.match(/[aeiouáéíóúàèìòùâêîôûäëïöü]+/gi);
            return matches ? matches.length : 1;
        };
        
        const syllables1 = countVowelClusters(text1);
        const syllables2 = countVowelClusters(text2);
        
        if (syllables1 === syllables2) return 1.0;
        const diff = Math.abs(syllables1 - syllables2);
        const max = Math.max(syllables1, syllables2);
        return Math.max(0, 1 - (diff / max));
    }

    private fastLanguageBonus(text1: string, text2: string, language: string): number {
        // Quick language bonus - just check exact match and basic patterns
        if (text1 === text2) return 0.1;
        
        // Quick accent-insensitive check for romance languages
        if (['es', 'fr', 'it', 'pt'].includes(language)) {
            const normalize = (str: string) => str
                .replace(/[áàâäã]/g, 'a')
                .replace(/[éèêë]/g, 'e')
                .replace(/[íìîï]/g, 'i')
                .replace(/[óòôöõ]/g, 'o')
                .replace(/[úùûü]/g, 'u')
                .replace(/[ç]/g, 'c')
                .replace(/[ñ]/g, 'n');
            
            if (normalize(text1) === normalize(text2)) return 0.05;
        }
        
        return 0;
    }

    private getThresholdForLanguage(language: string): number {
        // Different languages have different difficulty levels
        // Balanced thresholds for good user experience while maintaining quality
        const thresholds: Record<string, number> = {
            'en': 0.65,
            'es': 0.60,
            'fr': 0.55,
            'de': 0.55,
            'it': 0.60,
            'pt': 0.60,
            'ru': 0.50,
            'ja': 0.45,
            'zh-CN': 0.45,
            'ko': 0.45,
            'ar': 0.50,
            'hi': 0.50,
            'default': 0.55
        };
        
        return thresholds[language] || thresholds.default;
    }

    private generateFeedback(
        score: number,
        isCorrect: boolean,
        transcription: string,
        expectedText: string,
        language: string
    ): string {
        if (score > 0.95) {
            return 'Perfect pronunciation! Native-like accuracy!';
        } else if (score > 0.85) {
            return 'Excellent pronunciation! Very clear and accurate.';
        } else if (score > 0.75) {
            return 'Great job! Your pronunciation is very good.';
        } else if (score > 0.65) {
            return 'Good effort! Almost there, keep practicing.';
        } else if (score > 0.50) {
            return `Getting closer! You said "${transcription}" - try to match "${expectedText}" more closely.`;
        } else if (score > 0.30) {
            return `Keep practicing! Focus on each syllable: ${expectedText.split('').join('-')}`;
        } else {
            return 'Try again! Speak more clearly and slowly. Listen to the example again.';
        }
    }

    private getGoogleCloudApiKey(): string {
        // Get API key from your configuration
        // This should match how you handle it in TranslationService
        const apiKey = process.env.GOOGLE_CLOUD_API_KEY || 
                      Constants.expoConfig?.extra?.googleCloudApiKey;
        
        if (!apiKey) {
            throw new Error('Google Cloud API key not configured');
        }
        
        return apiKey;
    }

    /**
     * Play back a recorded audio file
     * @param recordingUri - URI of the recording to play
     * @returns Promise<{ sound: Audio.Sound | null; success: boolean }> - sound object and success status
     */
    async playRecording(recordingUri: string): Promise<{ sound: Audio.Sound | null; success: boolean }> {
        try {
            if (!recordingUri) {
                console.error('❌ No recording URI provided');
                return { sound: null, success: false };
            }

            // Configure audio for playback
            await AudioManager.configureForPlayback();
            
            // Set audio mode for playback
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: false,
                playsInSilentModeIOS: true,
                staysActiveInBackground: false,
                shouldDuckAndroid: false,
                playThroughEarpieceAndroid: false,
            });

            // Create and load the sound
            const { sound } = await Audio.Sound.createAsync(
                { uri: recordingUri },
                { shouldPlay: true, volume: 1.0 }
            );
            return { sound, success: true };
        } catch (error) {
            console.error('❌ Failed to play recording:', error);
            return { sound: null, success: false };
        }
    }

    /**
     * Stop playback of a sound
     * @param sound - The sound object to stop
     */
    async stopPlayback(sound: Audio.Sound): Promise<void> {
        try {
            await sound.stopAsync();
            await sound.unloadAsync();
        } catch (error) {
            console.error('❌ Failed to stop recording playback:', error);
        }
    }

    async cleanup() {
        if (this.recording) {
            try {
                await this.recording.stopAndUnloadAsync();
            } catch (error) {
                console.error('Error cleaning up recording:', error);
            }
            this.recording = null;
        }
        // Ensure we're back in playback mode after cleanup
        await AudioManager.configureForPlayback();
    }
}

export default new RecordingService();
