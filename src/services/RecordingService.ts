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
    async evaluatePronunciation(
        recordingUri: string, 
        expectedText: string, 
        language: string
    ): Promise<RecordingEvaluation> {
        try {
            // Read the audio file and convert to base64
            const audioBytes = await FileSystem.readAsStringAsync(recordingUri, {
                encoding: FileSystem.EncodingType.Base64,
            });
            
            // Map language codes to Google Cloud Speech language codes
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
        
        // Check for exact match first
        if (normalizedTranscription === normalizedExpected) {
            // Perfect match - vary confidence based on recognition confidence
            const baseConfidence = 85; // Start at 85% minimum for exact match
            const variationRange = 15; // Can go up to 100%
            const finalConfidence = baseConfidence + (recognitionConfidence * variationRange);
            
            return {
                isCorrect: true,
                confidence: Math.min(100, Math.round(finalConfidence)),
                feedback: finalConfidence >= 95 ? 'Perfect pronunciation! Native-like accuracy!' : 'Excellent pronunciation! Very clear and accurate.',
                transcription
            };
        }
        
        // Calculate similarity score
        const similarity = this.calculateSimilarity(normalizedTranscription, normalizedExpected);
        const levenshteinScore = this.levenshteinSimilarity(normalizedTranscription, normalizedExpected);
        const wordMatchScore = this.wordMatchScore(normalizedTranscription, normalizedExpected);
        
        console.log('Similarity scores:', { similarity, levenshteinScore, wordMatchScore });
        
        // Combine scores with weights
        const combinedScore = (
            similarity * 0.4 + 
            levenshteinScore * 0.3 + 
            wordMatchScore * 0.3
        ) * recognitionConfidence;
        
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

    private getThresholdForLanguage(language: string): number {
        // Different languages have different difficulty levels
        const thresholds: Record<string, number> = {
            'en': 0.85,
            'es': 0.80,
            'fr': 0.75,
            'de': 0.75,
            'it': 0.80,
            'pt': 0.80,
            'ru': 0.70,
            'ja': 0.65,
            'zh-CN': 0.65,
            'ko': 0.65,
            'ar': 0.70,
            'hi': 0.70,
            'default': 0.75
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