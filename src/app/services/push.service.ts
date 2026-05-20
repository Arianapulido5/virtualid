// src/app/services/push.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Auth } from './auth';
import { firstValueFrom } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class PushService {
  constructor(private http: HttpClient) {}

  async inicializar(): Promise<void> {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('Push no soportado en este navegador.');
      return;
    }

    const permiso = await Notification.requestPermission();
    if (permiso !== 'granted') return;

    try {
      const { publicKey } = await firstValueFrom(
        this.http.get<{ publicKey: string }>(`${environment.apiUrl}/push/vapid-public-key`)
      );

      const registro = await navigator.serviceWorker.ready;

      const suscripcion = await registro.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(publicKey),
      });

      this.guardarSuscripcion(suscripcion);
    } catch (err) {
      console.error('Error al suscribirse a push:', err);
    }
  }

  async desactivar(): Promise<void> {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await sub.unsubscribe();
        const headers = new HttpHeaders({
          Authorization: `Bearer ${Auth.getToken()}`
        });
        this.http.delete(
          `${environment.apiUrl}/push/suscripcion`,
          { headers, body: { endpoint: sub.endpoint } }
        ).subscribe();
      }
    } catch (err) {
      console.error('Error al desactivar push:', err);
    }
  }

  private guardarSuscripcion(suscripcion: PushSubscription): void {
    const headers = new HttpHeaders({
      Authorization: `Bearer ${Auth.getToken()}`
    });
    this.http.post(
      `${environment.apiUrl}/push/suscripcion`,
      suscripcion.toJSON(),
      { headers }
    ).subscribe();
  }

  private urlBase64ToUint8Array(base64String: string): ArrayBuffer {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const buffer  = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; i++) {
      buffer[i] = rawData.charCodeAt(i);
    }
    return buffer.buffer as ArrayBuffer;
  }
}