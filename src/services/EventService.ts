import { DeviceEventEmitter, EmitterSubscription } from 'react-native';

interface VocabularyChangeEvent {
    userId: string;
    action: 'deleted' | 'added' | 'updated';
    wordId: string;
    languages?: string[]; // Languages affected by the change
    countChange?: number; // For quick count updates (+1 for add, -1 for delete)
}

class EventService {
    private static readonly VOCABULARY_CHANGED = 'vocabularyChanged';

    /**
     * Emit a vocabulary change event
     */
    static emitVocabularyChange(event: VocabularyChangeEvent): void {
        try {
            DeviceEventEmitter.emit(this.VOCABULARY_CHANGED, event);
            console.log(`Emitted vocabulary change event:`, event);
        } catch (error) {
            console.warn('Failed to emit vocabulary change event:', error);
        }
    }

    /**
     * Listen for vocabulary change events
     */
    static onVocabularyChange(callback: (event: VocabularyChangeEvent) => void): EmitterSubscription {
        return DeviceEventEmitter.addListener(this.VOCABULARY_CHANGED, callback);
    }

    /**
     * Remove all listeners for vocabulary changes (cleanup)
     */
    static removeAllVocabularyListeners(): void {
        DeviceEventEmitter.removeAllListeners(this.VOCABULARY_CHANGED);
    }
}

export default EventService;
export type { VocabularyChangeEvent };