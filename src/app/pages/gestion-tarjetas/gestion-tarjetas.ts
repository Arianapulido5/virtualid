// src/app/pages/gestion-tarjetas/gestion-tarjetas.ts
import { Component, OnInit, NgZone, ChangeDetectorRef } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../../environments/environment';

interface Credencial {
  id: number;
  tipo_usuario: string;
  numero_id: string;
  correo: string;
  activa: boolean;
  estado: string;
  creado_en: string;
  institucion_nombre: string;
  punto_nombre: string;
}

@Component({
  selector: 'app-gestion-tarjetas',
  standalone: true,
  imports: [RouterLink, CommonModule],
  templateUrl: './gestion-tarjetas.html',
  styleUrls: ['./gestion-tarjetas.scss']
})
export class GestionTarjetas implements OnInit {

  credenciales: Credencial[] = [];
  cargando = true;
  error    = '';

  constructor(
    private http: HttpClient,
    private router: Router,
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef
  ) {}

  private get headers(): HttpHeaders {
    const token = localStorage.getItem('token') ?? '';
    return new HttpHeaders({
      'Authorization':  `Bearer ${token}`,
      'Cache-Control':  'no-cache, no-store, must-revalidate',
      'Pragma':         'no-cache',
      'Expires':        '0'
    });
  }

  ngOnInit(): void {
    this.cargarCredenciales();
  }

  cargarCredenciales(): void {
    this.cargando = true;
    this.error    = '';

    const url = `${environment.apiUrl}/credenciales?t=${Date.now()}`;

    this.http.get<Credencial[]>(url, { headers: this.headers }).subscribe({
      next: (data) => {
        this.ngZone.run(() => {
          this.credenciales = data;
          this.cargando = false;
          this.cdr.detectChanges();
        });
      },
      error: (err) => {
        this.ngZone.run(() => {
          if (err.status === 401 || err.status === 403) {
            this.router.navigate(['/login']);
            return;
          }
          this.error    = `Error ${err.status}: ${err.error?.message ?? 'No se pudieron cargar las credenciales.'}`;
          this.cargando = false;
          this.cdr.detectChanges();
        });
      }
    });
  }

  getIniciales(nombre: string): string {
    return nombre.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
  }

verDetalle(id: number): void {
  this.router.navigate(['/credencial', id], { replaceUrl: true });
}
}