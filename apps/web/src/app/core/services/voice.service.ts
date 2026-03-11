import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class VoiceService {
  isListening = signal<boolean>(false);
  transcript = signal<string>(''); // Not used for live streaming anymore, populated after processing
  error = signal<string | null>(null);

  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private mediaStream: MediaStream | null = null;

  constructor() {}

  async startListening() {
    this.transcript.set('');
    this.error.set(null);
    this.audioChunks = [];

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaRecorder = new MediaRecorder(this.mediaStream, { mimeType: 'audio/webm' });

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstart = () => {
         this.isListening.set(true);
      };

      this.mediaRecorder.onerror = (event: any) => {
         console.error('MediaRecorder error', event.error);
         this.error.set('Failed to record audio. Please check your microphone permissions.');
         this.cleanup();
      };

      this.mediaRecorder.start(250); // Record in small ms chunks
    } catch (err) {
      console.error('Failed to get user media', err);
      this.error.set('Microphone access denied or unavailable.');
      this.isListening.set(false);
    }
  }

  stopListening(): Promise<Blob | null> {
    return new Promise((resolve) => {
      if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
         this.cleanup();
         resolve(null);
         return;
      }

      this.mediaRecorder.onstop = () => {
         const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
         this.cleanup();
         resolve(audioBlob);
      };

      this.mediaRecorder.stop();
    });
  }

  private cleanup() {
      if (this.mediaStream) {
         this.mediaStream.getTracks().forEach(track => track.stop());
         this.mediaStream = null;
      }
      this.mediaRecorder = null;
      this.isListening.set(false);
  }
}
