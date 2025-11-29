// Socket.IO client service for real-time notifications
import { Injectable, OnDestroy } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { BehaviorSubject, Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
    providedIn: 'root'
})
export class SocketService implements OnDestroy {
    private socket: Socket | null = null;
    private connected$ = new BehaviorSubject<boolean>(false);

    get isConnected$(): Observable<boolean> {
        return this.connected$.asObservable();
    }

    private eventHandlers = new Map<string, Set<(data: any) => void>>();

    connect(token: string): void {
        if (this.socket?.connected) {
            return;
        }

        // Ensure we don't have a lingering disconnected socket
        if (this.socket) {
            this.socket.disconnect();
        }

        const socketUrl = environment.apiUrl || 'http://localhost:3000';
        console.log('[SocketService] Connecting to:', socketUrl);

        this.socket = io(socketUrl, {
            auth: { token },
            transports: ['websocket', 'polling'],
            path: '/socket.io/',
            reconnection: true,
            reconnectionAttempts: 5
        });

        this.socket.on('connect', () => {
            console.log('Socket.IO connected');
            this.connected$.next(true);
            this.attachHandlers();
        });

        this.socket.on('disconnect', () => {
            console.log('Socket.IO disconnected');
            this.connected$.next(false);
        });

        this.socket.on('connect_error', (error) => {
            console.error('[SocketService] Connection error:', error.message);
            this.connected$.next(false);
        });
    }

    private attachHandlers() {
        if (!this.socket) return;

        console.log(`[SocketService] Attaching ${this.eventHandlers.size} event handler(s)`);
        this.eventHandlers.forEach((handlers, event) => {
            console.log(`[SocketService] Attaching ${handlers.size} handler(s) for event: ${event}`);
            // Remove existing listeners to avoid duplicates on reconnect
            this.socket!.off(event);
            handlers.forEach(handler => {
                this.socket!.on(event, handler);
            });
        });
    }

    disconnect(): void {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
            this.connected$.next(false);
        }
    }

    on<T = any>(event: string, callback: (data: T) => void): void {
        console.log(`[SocketService] Registering handler for event: ${event}`);
        if (!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, new Set());
        }
        this.eventHandlers.get(event)!.add(callback);

        // If already connected, attach immediately
        if (this.socket) {
            console.log(`[SocketService] Socket already connected, attaching handler for ${event} immediately`);
            this.socket.on(event, callback);
        } else {
            console.log(`[SocketService] Socket not connected yet, handler for ${event} will be attached on connect`);
        }
    }

    off(event: string, callback?: (data: any) => void): void {
        if (callback) {
            this.eventHandlers.get(event)?.delete(callback);
            this.socket?.off(event, callback);
        } else {
            this.eventHandlers.delete(event);
            this.socket?.off(event);
        }
    }

    emit(event: string, data?: any): void {
        this.socket?.emit(event, data);
    }

    subscribeToBoard(boardId: string): void {
        this.emit('subscribe:board', boardId);
    }

    unsubscribeFromBoard(boardId: string): void {
        this.emit('unsubscribe:board', boardId);
    }

    ngOnDestroy(): void {
        this.disconnect();
    }
}
