import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AdminInfoService {

  private _nombre    = new BehaviorSubject<string>('');
  private _iniciales = new BehaviorSubject<string>('');

  nombre$    = this._nombre.asObservable();
  iniciales$ = this._iniciales.asObservable();

  private cargado = false;

  constructor(private http: HttpClient) {}

  cargar() {
    const token = localStorage.getItem('token');
    if (!token) return;

    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
    this.http.get<any>(`${environment.apiUrl}/informacion`, { headers }).subscribe({
      next: (res) => {
        this._nombre.next(`${res.nombre} ${res.apellido_paterno}`);
        this._iniciales.next(
          ((res.nombre?.charAt(0) || '') + (res.apellido_paterno?.charAt(0) || '')).toUpperCase()
        );
        this.cargado = true;
      },
      error: () => {
        this._nombre.next('Administrador');
        this._iniciales.next('AD');
      }
    });
  }

  limpiar() {
    this._nombre.next('');
    this._iniciales.next('');
    this.cargado = false;
  }
}