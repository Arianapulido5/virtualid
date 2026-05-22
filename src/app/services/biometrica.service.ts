// src/app/services/biometrica.service.ts
// Maneja reconocimiento facial con face-api.js
// Sin WebAuthn — solo descriptores faciales.

import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class BiometricaService {
  private api = environment.apiUrl;

  constructor(private http: HttpClient) {}

  private headers(): HttpHeaders {
    return new HttpHeaders({
      Authorization: `Bearer ${localStorage.getItem('token') ?? ''}`,
    });
  }

  // La cámara siempre está disponible en dispositivos modernos
  static soportado(): Promise<boolean> {
    return Promise.resolve(
      !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
    );
  }

  // ── Guardar cara (usuario con sesión activa) ────────────────────────────────
  registrar(descriptor: number[]): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(
      `${this.api}/biometrica/registrar`,
      { descriptor },
      { headers: this.headers() }
    );
  }

  // ── Login con cara ─────────────────────────────────────────────────────────
  loginFacial(correo: string, descriptor: number[]): Observable<{ token: string; rol: string; tipo: string }> {
    return this.http.post<{ token: string; rol: string; tipo: string }>(
      `${this.api}/biometrica/login`,
      { correo, descriptor }
    );
  }

  // ── Verificar cara en sesión activa (para QR) ──────────────────────────────
  verificar(descriptor: number[]): Observable<{ verificado: boolean }> {
    return this.http.post<{ verificado: boolean }>(
      `${this.api}/biometrica/verificar`,
      { descriptor },
      { headers: this.headers() }
    );
  }

  // ── Estado ─────────────────────────────────────────────────────────────────
  obtenerEstado(): Observable<{ activa: boolean; credenciales: any[] }> {
    return this.http.get<any>(`${this.api}/biometrica/estado`, { headers: this.headers() });
  }

  // ── Desactivar ─────────────────────────────────────────────────────────────
  desactivar(): Observable<{ message: string }> {
    return this.http.delete<any>(`${this.api}/biometrica`, { headers: this.headers() });
  }
}