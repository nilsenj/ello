import 'zone.js';
import '@angular/compiler'; // <-- makes JIT compiler available
import {provideHttpClient, withFetch} from '@angular/common/http';
import {AppComponent} from './app/app.component';
import {bootstrapApplication} from "@angular/platform-browser";
import './styles.css';
import {provideAnimations} from "@angular/platform-browser/animations"; // or './styles.scss'

bootstrapApplication(AppComponent, {
    providers: [provideHttpClient(withFetch()), provideAnimations()]
}).catch(console.error);
