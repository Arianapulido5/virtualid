import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface PuntoAccesoDTO {
  nombre: string;
  descripcion?: string;
  tipo: string;
  nivel_acceso: string;
  permite_estudiantes: boolean;
  permite_empleados: boolean;
  activo?: boolean;
  horario_activo: boolean;
  hora_entrada?: string;  
  hora_salida?: string;    
  comida_inicio?: string; 
  comida_fin?: string;  
}

export interface PuntoAcceso extends PuntoAccesoDTO {
  id:        number;
  activo:    boolean;
  creado_en: string;
}

@Injectable({ providedIn: 'root' })
export class PuntosAccesoService {

  private readonly base = `${environment.apiUrl}/puntos-acceso`;

  constructor(private http: HttpClient) {}

  private headers(): HttpHeaders {
    const token = localStorage.getItem('token') ?? '';
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  getAll(): Observable<PuntoAcceso[]> {
    return this.http.get<PuntoAcceso[]>(this.base, { headers: this.headers() });
  }

  getById(id: number): Observable<PuntoAcceso> {
    return this.http.get<PuntoAcceso>(`${this.base}/${id}`, { headers: this.headers() });
  }

  create(data: PuntoAccesoDTO): Observable<{ message: string; punto: PuntoAcceso }> {
    return this.http.post<{ message: string; punto: PuntoAcceso }>(
      this.base, data, { headers: this.headers() }
    );
  }

  update(id: number, data: Partial<PuntoAccesoDTO> & { activo?: boolean }):
    Observable<{ message: string; punto: PuntoAcceso }> {
    return this.http.put<{ message: string; punto: PuntoAcceso }>(
      `${this.base}/${id}`, data, { headers: this.headers() }
    );
  }

  delete(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(
      `${this.base}/${id}`, { headers: this.headers() }
    );
  }
}