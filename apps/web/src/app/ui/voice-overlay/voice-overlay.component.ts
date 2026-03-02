import { Component, inject, OnDestroy, OnInit, Injector, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { VoiceService } from '../../core/services/voice.service';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { BoardStore } from '../../store/board-store.service';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'ello-voice-overlay',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="fixed inset-0 z-50 flex flex-col bg-gray-900 bg-opacity-95 text-white backdrop-blur-sm" *ngIf="isOpen">
      
      <!-- Top Actions -->
      <div class="flex justify-between items-center p-6">
        <h2 class="text-2xl font-semibold flex items-center gap-3">
          <svg class="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path></svg>
          Voice Assistant
        </h2>
        <button (click)="close()" class="text-gray-400 hover:text-white transition p-2 rounded-full hover:bg-white/10">
          <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>
      </div>

      <!-- Main Transcription Area -->
      <div class="flex-1 flex flex-col items-center justify-center p-8 w-full max-w-4xl mx-auto">
        
        <div class="w-full relative">
           <textarea 
             [(ngModel)]="editableText"
             class="w-full h-48 bg-gray-800 bg-opacity-50 border border-gray-700 rounded-2xl p-6 text-3xl font-light focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none transition-colors"
             placeholder="Say something like 'Create board Marketing'..."
           ></textarea>
           
           <!-- Listening indicator -->
           <div class="absolute bottom-4 right-4 flex items-center gap-2 text-indigo-400" *ngIf="voice.isListening()">
              <span class="relative flex h-3 w-3">
                <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                <span class="relative inline-flex rounded-full h-3 w-3 bg-indigo-500"></span>
              </span>
              <span class="text-sm font-medium animate-pulse">Listening...</span>
           </div>
        </div>

        <div class="mt-8 flex gap-4">
          <button *ngIf="!voice.isListening()" (click)="startListening()" class="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 rounded-lg font-medium transition flex items-center gap-2">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path></svg>
            Start Listening
          </button>
          
          <button *ngIf="voice.isListening()" (click)="stopListening()" class="px-6 py-3 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded-lg font-medium transition flex items-center gap-2 border border-red-500/30">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"></path></svg>
            Stop
          </button>
          
          <button (click)="executeCommand()" [disabled]="!editableText.trim() || isSubmitting" class="px-8 py-3 bg-white text-gray-900 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-semibold transition flex items-center gap-2">
             <span *ngIf="isSubmitting" class="w-5 h-5 border-2 border-gray-900 border-t-transparent rounded-full animate-spin"></span>
             {{ isSubmitting ? 'Executing...' : 'Execute Command' }}
          </button>
        </div>

        <!-- Error Alert -->
        <div *ngIf="errorMessage" class="mt-6 p-4 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg w-full max-w-lg text-center animate-in fade-in slide-in-from-bottom-4">
          {{ errorMessage }}
        </div>
        
        <!-- Success Alert -->
        <div *ngIf="successMessage" class="mt-6 p-4 bg-green-500/10 border border-green-500/30 text-green-400 rounded-lg w-full max-w-lg text-center animate-in fade-in slide-in-from-bottom-4">
          {{ successMessage }}
        </div>

      </div>

      <!-- Glossary Footer -->
      <div class="bg-gray-800 bg-opacity-60 border-t border-gray-700 p-8 w-full">
        <div class="max-w-6xl mx-auto">
          <h3 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-6">Available Commands</h3>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            <div class="bg-gray-800/50 p-4 rounded-xl border border-gray-700/50">
              <div class="flex items-center gap-2 text-indigo-400 mb-3">
                 <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"></path></svg>
                 <h4 class="font-medium text-white">Boards</h4>
              </div>
              <ul class="space-y-2 text-sm text-gray-300">
                <li class="flex items-start gap-2"><span class="text-gray-500 mt-0.5">&bull;</span> <code class="bg-gray-900 px-1.5 py-0.5 rounded text-indigo-300">Create board [name]</code></li>
              </ul>
            </div>

            <div class="bg-gray-800/50 p-4 rounded-xl border border-gray-700/50">
               <div class="flex items-center gap-2 text-emerald-400 mb-3">
                 <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16"></path></svg>
                 <h4 class="font-medium text-white">Lists</h4>
              </div>
              <ul class="space-y-2 text-sm text-gray-300">
                <li class="flex items-start gap-2"><span class="text-gray-500 mt-0.5">&bull;</span> <code class="bg-gray-900 px-1.5 py-0.5 rounded text-emerald-300">Add list [name] to board [name]</code></li>
              </ul>
            </div>

            <div class="bg-gray-800/50 p-4 rounded-xl border border-gray-700/50">
               <div class="flex items-center gap-2 text-amber-400 mb-3">
                 <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"></path></svg>
                 <h4 class="font-medium text-white">Tasks / Cards</h4>
              </div>
              <ul class="space-y-2 text-sm text-gray-300">
                <li class="flex items-start gap-2"><span class="text-gray-500 mt-0.5">&bull;</span> <code class="bg-gray-900 px-1.5 py-0.5 rounded text-amber-300">Create task [title] in list [list name]</code></li>
                <li class="flex items-start gap-2"><span class="text-gray-500 mt-0.5">&bull;</span> <code class="bg-gray-900 px-1.5 py-0.5 rounded text-amber-300">Create task [title]</code> (Uses active board)</li>
              </ul>
            </div>

          </div>
        </div>
      </div>

    </div>
  `
})
export class VoiceOverlayComponent implements OnInit, OnDestroy {
  voice = inject(VoiceService);
  http = inject(HttpClient);
  store = inject(BoardStore); // Assuming we have access to active workspace/board context

  isOpen = false;
  editableText = '';
  isSubmitting = false;
  errorMessage = '';
  successMessage = '';

  private injector = inject(Injector);

  ngOnInit() {
    // Sync textarea with voice transcript
    effect(() => {
       const t = this.voice.transcript();
       if (t && this.voice.isListening()) {
         this.editableText = t;
       }
    }, { injector: this.injector });
  }

  ngOnDestroy() {
    this.stopListening();
  }

  open() {
    this.isOpen = true;
    this.editableText = '';
    this.errorMessage = '';
    this.successMessage = '';
    this.startListening();
  }

  close() {
    this.stopListening();
    this.isOpen = false;
  }

  startListening() {
    this.errorMessage = '';
    this.successMessage = '';
    this.editableText = '';
    this.voice.startListening();
  }

  stopListening() {
    this.voice.stopListening();
  }

  async executeCommand() {
    const textToExecute = this.editableText.trim();
    if (!textToExecute) return;
    
    this.stopListening();
    this.isSubmitting = true;
    this.errorMessage = '';
    this.successMessage = '';

    try {
      const activeBoardId = this.store.currentBoardId();
      
      const response = await firstValueFrom(
        this.http.post<any>('/api/assistant/command', {
          text: textToExecute,
          context: {
             activeBoardId: activeBoardId
          }
        })
      );

      this.successMessage = `Success! Executed: ${response.action}`;
      this.editableText = ''; // clear on success
      
      // Optionally trigger a refresh of boards/lists based on action
      setTimeout(() => {
          this.close();
          window.location.reload(); // Simple refresh for prototype
      }, 1500);

    } catch (err: any) {
      console.error(err);
      this.errorMessage = err.error?.error || 'Failed to execute command. Please try again.';
    } finally {
      this.isSubmitting = false;
    }
  }
}

