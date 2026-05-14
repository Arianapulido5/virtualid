// src/app/services/qr.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class QrService {
  private api = environment.apiUrl;

  constructor(private http: HttpClient) {}

  private headers(): HttpHeaders {
    return new HttpHeaders({
      Authorization: `Bearer ${localStorage.getItem('token') ?? ''}`
    });
  }

  /**
   * Genera un token QR. Si se pasan latitud y longitud, el backend
   * valida que el usuario esté dentro del radio permitido por la institución.
   */
  generarToken(
    credencialId: number,
    latitud?: number,
    longitud?: number
  ): Observable<{ token: string; expira_en: number }> {
    const body: any = { credencial_id: credencialId };
    if (latitud  !== undefined && latitud  !== null) body.latitud  = latitud;
    if (longitud !== undefined && longitud !== null) body.longitud = longitud;

    return this.http.post<{ token: string; expira_en: number }>(
      `${this.api}/qr/generar`,
      body,
      { headers: this.headers() }
    );
  }

  validarToken(token: string, puntoId: number): Observable<any> {
    return this.http.post<any>(
      `${this.api}/qr/validar`,
      { token, punto_acceso_id: puntoId }
    );
  }
}