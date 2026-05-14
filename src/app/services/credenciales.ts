import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Institucion {
  id: number;
  nombre: string;
  tipo: string;
  ciudad: string;
  estado: string;
  dominio_correo: string;
}

export interface PuntoAccesoSimple {
  id: number;
  nombre: string;
  descripcion: string;
  tipo: string;
  nivel_acceso: string;
  permite_estudiantes: boolean;
  permite_empleados: boolean;
}

export interface Credencial {
  id: number;
  tipo_usuario: string;
  numero_id: string;
  correo: string;
  activa: boolean;
  creado_en: string;
  institucion_id: number;
  institucion_nombre: string;
  institucion_tipo: string;
  ciudad: string;
  estado: string;
  punto_acceso_id: number;
  punto_nombre: string;
  punto_tipo: string;
  punto_descripcion: string;
  nivel_acceso: string;
}

@Injectable({ providedIn: 'root' })
export class CredencialesService {
  private base = `${environment.apiUrl}/credenciales`;

  constructor(private http: HttpClient) {}

  private headers(): HttpHeaders {
    const token = localStorage.getItem('token') || '';
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  getInstituciones(): Observable<Institucion[]> {
    return this.http.get<Institucion[]>(`${this.base}/instituciones`,
      { headers: this.headers() });
  }

  getPuntosDeInstitucion(institucionId: number, tipo: string): Observable<PuntoAccesoSimple[]> {
    return this.http.get<PuntoAccesoSimple[]>(
      `${this.base}/puntos-acceso/${institucionId}?tipo=${tipo}`,
      { headers: this.headers() }
    );
  }

  crearCredencial(body: {
    institucion_id: number;
    punto_acceso_id: number;
    tipo_usuario: string;
    numero_id: string;
    correo: string;
  }): Observable<any> {
    return this.http.post(this.base, body, { headers: this.headers() });
  }

  getMisCredenciales(): Observable<Credencial[]> {
    return this.http.get<Credencial[]>(this.base, { headers: this.headers() });
  }

  getCredencialById(id: number): Observable<Credencial> {
    return this.http.get<Credencial>(`${this.base}/${id}`, { headers: this.headers() });
  }
}