import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import {BoardCreateModalComponent} from "./components/board-create-modal/board-create-modal.component";

@Component({
  standalone: true,
  selector: 'app-root',
  imports: [CommonModule, RouterOutlet, BoardCreateModalComponent],
  template: `
      <router-outlet></router-outlet>
  `
})
export class AppComponent {}
