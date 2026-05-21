// src/app/services/biometrica.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, from, throwError } from 'rxjs';
import { switchMap, catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';

function base64urlToBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const padded  = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, '=');
  const binary  = atob(padded);
  const bytes   = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function toBuffer(val: any): ArrayBuffer {
  if (typeof val === 'string') return base64urlToBuffer(val);
  if (val instanceof ArrayBuffer) return val;
  if (ArrayBuffer.isView(val)) return (val as ArrayBufferView).buffer as ArrayBuffer;
  if (typeof val === 'object' && val !== null) {
    const arr = Object.values(val) as number[];
    return new Uint8Array(arr).buffer;
  }
  return base64urlToBuffer(String(val));
}

function bufferToBase64url(buffer: ArrayBuffer): string {
  const bytes  = new Uint8Array(buffer);
  let binary   = '';
  bytes.forEach(b => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

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

function prepararOpcionesRegistro(opts: any): PublicKeyCredentialCreationOptions {
  return {
    ...opts,
    challenge: toBuffer(opts.challenge),
    user: {
      ...opts.user,
      id: toBuffer(opts.user.id),
    },
    excludeCredentials: (opts.excludeCredentials ?? []).map((c: any) => ({
      ...c,
      id: toBuffer(c.id),
    })),
  };
}

function prepararOpcionesAutenticacion(opts: any): PublicKeyCredentialRequestOptions {
  return {
    ...opts,
    challenge: toBuffer(opts.challenge),
    allowCredentials: (opts.allowCredentials ?? []).map((c: any) => ({
      ...c,
      id: toBuffer(c.id),
    })),
  };
}

@Injectable({ providedIn: 'root' })
export class BiometricaService {
  private api = environment.apiUrl;

  constructor(private http: HttpClient) {}

  private headers(): HttpHeaders {
    return new HttpHeaders({
      Authorization: `Bearer ${localStorage.getItem('token') ?? ''}`,
    });
  }

  static soportado(): Promise<boolean> {
    if (!window.PublicKeyCredential) return Promise.resolve(false);
    return PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  }

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
          if (err?.name === 'NotAllowedError') {
            return throwError(() => ({ message: 'Registro cancelado por el usuario.' }));
          }
          return throwError(() => err);
        })
      );
  }

  autenticarInicio(correo: string): Observable<any> {
    return this.http.post<any>(`${this.api}/biometrica/autenticar-inicio`, { correo });
  }

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

  obtenerEstado(): Observable<{ activa: boolean; credenciales: any[] }> {
    return this.http.get<any>(`${this.api}/biometrica/estado`, { headers: this.headers() });
  }

  desactivar(): Observable<{ message: string }> {
    return this.http.delete<any>(`${this.api}/biometrica`, { headers: this.headers() });
  }
}