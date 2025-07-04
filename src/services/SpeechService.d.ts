declare class SpeechService {
  initialize(): Promise<boolean>;
  speak(text: string, language?: string): Promise<void>;
  stop(): Promise<void>;
  checkAvailability(language: string): Promise<boolean>;
  speakQueue(textArray: string[], language?: string): Promise<void>;
  getAudioStatus(): {
    audioLibrary: string;
    audioConfigured: boolean;
    initialized: boolean;
    voicesAvailable: number;
    forceMode: boolean;
  };
}

declare const speechService: SpeechService;
export default speechService;