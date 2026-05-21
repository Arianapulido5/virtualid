// src/app/services/biometrica.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, from, throwError } from 'rxjs';
import { switchMap, catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';

// ── Helpers de conversión base64url ↔ ArrayBuffer ──────────────────────────

function base64urlToBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const padded  = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, '=');
  const binary  = atob(padded);
  const bytes   = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function bufferToBase64url(buffer: ArrayBuffer): string {
  const bytes  = new Uint8Array(buffer);
  let binary   = '';
  bytes.forEach(b => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// Serializa la respuesta del autenticador para enviarla al backend
function serializarCredencial(cred: PublicKeyCredential): any {
  const response = cred.response as AuthenticatorAttestationResponse;
  return {
    id:    cred.id,
    rawId: bufferToBase64url(cred.rawId),
    type:  cred.type,
    response: {
      clientDataJSON:    bufferToBase64url(response.clientDataJSON),
      attestationObject: bufferToBase64url(response.attestationObject),
    },
  };
}

function serializarAssercion(cred: PublicKeyCredential): any {
  const response = cred.response as AuthenticatorAssertionResponse;
  return {
    id:    cred.id,
    rawId: bufferToBase64url(cred.rawId),
    type:  cred.type,
    response: {
      clientDataJSON:    bufferToBase64url(response.clientDataJSON),
      authenticatorData: bufferToBase64url(response.authenticatorData),
      signature:         bufferToBase64url(response.signature),
      userHandle:        response.userHandle ? bufferToBase64url(response.userHandle) : null,
    },
  };
}

// Prepara las opciones del servidor para llamar a navigator.credentials.create
function prepararOpcionesRegistro(opts: any): PublicKeyCredentialCreationOptions {
  return {
    ...opts,
    challenge: base64urlToBuffer(opts.challenge),
    user: {
      ...opts.user,
      id: base64urlToBuffer(opts.user.id),
    },
    excludeCredentials: (opts.excludeCredentials ?? []).map((c: any) => ({
      ...c,
      id: base64urlToBuffer(c.id),
    })),
  };
}

// Prepara las opciones del servidor para llamar a navigator.credentials.get
function prepararOpcionesAutenticacion(opts: any): PublicKeyCredentialRequestOptions {
  return {
    ...opts,
    challenge: base64urlToBuffer(opts.challenge),
    allowCredentials: (opts.allowCredentials ?? []).map((c: any) => ({
      ...c,
      id: base64urlToBuffer(c.id),
    })),
  };
}

// ── Servicio ────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class BiometricaService {
  private api = environment.apiUrl;

  constructor(private http: HttpClient) {}

  private headers(): HttpHeaders {
    return new HttpHeaders({
      Authorization: `Bearer ${localStorage.getItem('token') ?? ''}`,
    });
  }

  /** ¿El navegador soporta WebAuthn con plataforma? */
  static soportado(): Promise<boolean> {
    if (!window.PublicKeyCredential) return Promise.resolve(false);
    return PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  }

  // ── REGISTRO ──────────────────────────────────────────────────────────────

  /** Paso 1 + 2: inicia y completa el registro biométrico */
  registrar(): Observable<{ message: string }> {
    return this.http
      .post<any>(`${this.api}/biometrica/registrar-inicio`, {}, { headers: this.headers() })
      .pipe(
        switchMap((opts) => {
          const publicKey = prepararOpcionesRegistro(opts);
          return from(navigator.credentials.create({ publicKey }) as Promise<PublicKeyCredential>);
        }),
        switchMap((cred) => {
          const body = serializarCredencial(cred);
          return this.http.post<{ message: string }>(
            `${this.api}/biometrica/registrar-fin`,
            body,
            { headers: this.headers() }
          );
        }),
        catchError((err) => {
          // El usuario canceló o el dispositivo no soporta
          if (err?.name === 'NotAllowedError') {
            return throwError(() => ({ message: 'Registro cancelado por el usuario.' }));
          }
          return throwError(() => err);
        })
      );
  }

  // ── AUTENTICACIÓN (login sin contraseña) ──────────────────────────────────

  /** Paso 1: solicita opciones de autenticación para un correo */
  autenticarInicio(correo: string): Observable<any> {
    return this.http.post<any>(`${this.api}/biometrica/autenticar-inicio`, { correo });
  }

  /** Paso 2: completa la autenticación con el autenticador local */
  autenticarFin(userId: number, opts: any): Observable<{ token: string; rol: string; tipo: string }> {
    const publicKey = prepararOpcionesAutenticacion(opts);
    return from(
      navigator.credentials.get({ publicKey }) as Promise<PublicKeyCredential>
    ).pipe(
      switchMap((cred) => {
        const body = { userId, ...serializarAssercion(cred) };
        return this.http.post<{ token: string; rol: string; tipo: string }>(
          `${this.api}/biometrica/autenticar-fin`,
          body
        );
      }),
      catchError((err) => {
        if (err?.name === 'NotAllowedError') {
          return throwError(() => ({ message: 'Autenticación cancelada.' }));
        }
        return throwError(() => err);
      })
    );
  }

  // ── VERIFICACIÓN (para generar QR desde sesión activa) ───────────────────

  /** Verifica biometría en sesión activa (antes de generar QR) */
  verificar(): Observable<{ verificado: boolean }> {
    return this.http
      .post<any>(`${this.api}/biometrica/verificar-inicio`, {}, { headers: this.headers() })
      .pipe(
        switchMap((opts) => {
          const publicKey = prepararOpcionesAutenticacion(opts);
          return from(navigator.credentials.get({ publicKey }) as Promise<PublicKeyCredential>);
        }),
        switchMap((cred) => {
          const body = serializarAssercion(cred);
          return this.http.post<{ verificado: boolean }>(
            `${this.api}/biometrica/verificar-fin`,
            body,
            { headers: this.headers() }
          );
        }),
        catchError((err) => {
          if (err?.name === 'NotAllowedError') {
            return throwError(() => ({ message: 'Verificación cancelada.' }));
          }
          return throwError(() => err);
        })
      );
  }

  // ── ESTADO Y DESACTIVACIÓN ────────────────────────────────────────────────

  obtenerEstado(): Observable<{ activa: boolean; credenciales: any[] }> {
    return this.http.get<any>(`${this.api}/biometrica/estado`, { headers: this.headers() });
  }

  desactivar(): Observable<{ message: string }> {
    return this.http.delete<any>(`${this.api}/biometrica`, { headers: this.headers() });
  }
}