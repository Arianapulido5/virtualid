// src/app/services/auth.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface InfoPersonalData {
  usuario_id?:       number;
  nombre:            string;
  apellido_paterno:  string;
  apellido_materno:  string;
  correo:            string;
  numero_empleado?:  string;
  telefono?:         string;
  direccion?:        string;
  ciudad?:           string;
  estado?:           string;
  municipio?:        string;
  colonia?:          string;
  codigo_postal?:    string;
  fecha_nacimiento?: string;
}

@Injectable({ providedIn: 'root' })
export class Auth {
  private url = environment.apiUrl;

  constructor(private http: HttpClient) {}

  static setToken(token: string): void {
    try { localStorage.setItem('token', token); }
    catch { sessionStorage.setItem('token', token); }
  }

  static getToken(): string {
    return localStorage.getItem('token') ?? sessionStorage.getItem('token') ?? '';
  }

  static setRol(rol: string): void {
    try { localStorage.setItem('rol', rol); }
    catch { sessionStorage.setItem('rol', rol); }
  }

  static getRol(): string {
    return localStorage.getItem('rol') ?? sessionStorage.getItem('rol') ?? '';
  }

  static clearSession(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('rol');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('rol');
  }

  private headers(): HttpHeaders {
    const token = Auth.getToken();
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  login(correo: string, contrasena: string) {
    return this.http.post<any>(`${this.url}/auth/login`, { correo, contrasena });
  }

  registro(datos: {
    nombre:            string;
    apellido_paterno:  string;
    apellido_materno:  string;
    correo:            string;
    numero_empleado:   string;
    contrasena:        string;
    tipo?:             string;
    telefono?:         string;
    direccion?:        string;
    ciudad?:           string;
    estado?:           string;
    municipio?:        string;
    colonia?:          string;
    codigo_postal?:    string;
    fecha_nacimiento?: string;
  }) {
    return this.http.post<any>(`${this.url}/auth/registro`, datos);
  }

  cerrarSesion(): void {
    Auth.clearSession();
  }

  solicitarRecuperacion(correo: string) {
    return this.http.post<any>(`${this.url}/recuperacion/solicitar`, { correo });
  }

  restablecerContrasena(token: string, contrasena: string) {
    return this.http.post<any>(`${this.url}/recuperacion/restablecer`, { token, contrasena });
  }

  obtenerInformacion(): Observable<InfoPersonalData> {
    return this.http.get<InfoPersonalData>(`${this.url}/informacion`, { headers: this.headers() });
  }

  guardarInformacion(datos: InfoPersonalData): Observable<any> {
    return this.http.put<any>(`${this.url}/informacion`, datos, { headers: this.headers() });
  }

  cambiarContrasena(
    contrasena_actual: string,
    nueva_contrasena: string,
    confirmar_contrasena: string
  ): Observable<any> {
    return this.http.put<any>(
      `${this.url}/informacion/cambiar-contrasena`,
      { contrasena_actual, nueva_contrasena, confirmar_contrasena },
      { headers: this.headers() }
    );
  }
}