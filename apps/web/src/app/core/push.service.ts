import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { PushNotifications, Token, PushNotificationSchema } from '@capacitor/push-notifications';
import { ApiBaseService } from '../data/api-base.service';

@Injectable({ providedIn: 'root' })
export class PushService {
    private initialized = false;

    constructor(private api: ApiBaseService) {}

    async init() {
        if (this.initialized) return;
        this.initialized = true;
        if (!Capacitor.isNativePlatform()) return;

        const perm = await PushNotifications.requestPermissions();
        if (perm.receive !== 'granted') return;

        await PushNotifications.register();

        PushNotifications.addListener('registration', (token: Token) => {
            this.registerToken(token.value).catch(() => undefined);
        });

        PushNotifications.addListener('registrationError', (err) => {
            console.error('[Push] registration error', err);
        });

        PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
            console.log('[Push] notification received', notification);
        });
    }

    private async registerToken(token: string) {
        const platform = Capacitor.getPlatform();
        await this.api.post('/api/push/register', { token, platform });
    }
}
