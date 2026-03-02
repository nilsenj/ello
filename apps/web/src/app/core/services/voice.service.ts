import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class VoiceService {
  isListening = signal<boolean>(false);
  transcript = signal<string>('');
  error = signal<string | null>(null);

  private recognition: any;

  constructor() {
    this.initRecognition();
  }

  private initRecognition() {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      this.error.set('Speech Recognition API is not supported in this browser.');
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = true; 
    this.recognition.lang = 'en-US';

    this.recognition.onstart = () => {
      this.isListening.set(true);
      this.error.set(null);
    };

    this.recognition.onresult = (event: any) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }
      
      // Update signal primarily with final transcript, or interim if still speaking
      // In a real app we might combine these or just show interim live and wait for final.
      this.transcript.update(curr => {
         const combined = curr + (finalTranscript ? ' ' + finalTranscript : '');
         return combined.trim(); // Just persist final transcript changes
      });
      
      // If we just have interim, we might want to display it differently, 
      // but for simplicity we will just append final results to our state.
      if (!finalTranscript && interimTranscript) {
         // Optionally you could have a separate signal for `interimTranscript` 
         // but appending directly is easier for the textarea sync.
      }
    };

    this.recognition.onerror = (event: any) => {
      console.error('Speech recognition error', event.error);
      this.error.set(event.error);
      this.isListening.set(false);
    };

    this.recognition.onend = () => {
      this.isListening.set(false);
    };
  }

  startListening() {
    if (!this.recognition) return;
    this.transcript.set('');
    this.error.set(null);
    try {
      this.recognition.start();
    } catch (e) {
      // already started
    }
  }

  stopListening() {
    if (!this.recognition) return;
    this.recognition.stop();
    this.isListening.set(false);
  }
}
