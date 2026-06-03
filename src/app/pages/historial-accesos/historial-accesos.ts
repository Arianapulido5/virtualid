// src/app/pages/historial-accesos/historial-accesos.ts
import { Component, OnInit, NgZone, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';

interface Acceso {
  id:                 number;
  exitoso:            boolean;
  motivo_denegacion:  string | null;
  creado_en:          string;
  ip:                 string | null;
  punto_nombre:       string;
  punto_tipo:         string;
  institucion_nombre: string;
  ciudad:             string;
  estado:             string;
}

@Component({
  selector: 'app-historial-accesos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './historial-accesos.html',
  styleUrls: ['./historial-accesos.scss']
})
export class HistorialAccesos implements OnInit {

  private apiBase = environment.apiUrl;

  accesos:          Acceso[] = [];
  accesosFiltrados: Acceso[] = [];
  cargando  = true;
  error     = '';
  busqueda  = '';
  filtroActivo: 'todos' | 'semana' | 'mes' = 'todos';

  constructor(
    private http:   HttpClient,
    private router: Router,
    private ngZone: NgZone,
    private cdr:    ChangeDetectorRef
  ) {}

  private get headers(): HttpHeaders {
    const token = localStorage.getItem('token') ?? '';
    return new HttpHeaders({
      Authorization:   `Bearer ${token}`,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      Pragma:          'no-cache',
      Expires:         '0'
    });
  }

  ngOnInit(): void { this.cargarHistorial(); }

  setFiltro(filtro: 'todos' | 'semana' | 'mes'): void {
    this.filtroActivo = filtro;
    this.busqueda     = '';
    this.cargarHistorial();
  }

  onBusqueda(): void { this.aplicarBusqueda(); }

  cargarHistorial(): void {
    this.cargando = true;
    this.error    = '';

    const params = this.filtroActivo !== 'todos' ? `?periodo=${this.filtroActivo}&` : '?';
    const url    = `${this.apiBase}/historial${params}t=${Date.now()}`;

    this.http.get<Acceso[]>(url, { headers: this.headers }).subscribe({
      next: (data) => {
        this.ngZone.run(() => {
          this.accesos  = data;
          this.aplicarBusqueda();
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
          this.error    = `Error ${err.status}: ${err.error?.message ?? 'No se pudo cargar el historial.'}`;
          this.cargando = false;
          this.cdr.detectChanges();
        });
      }
    });
  }

  private aplicarBusqueda(): void {
    const q = this.busqueda.trim().toLowerCase();
    if (!q) {
      this.accesosFiltrados = [...this.accesos];
    } else {
      this.accesosFiltrados = this.accesos.filter(a =>
        a.punto_nombre.toLowerCase().includes(q)       ||
        a.institucion_nombre.toLowerCase().includes(q) ||
        a.ciudad.toLowerCase().includes(q)             ||
        a.punto_tipo.toLowerCase().includes(q)
      );
    }
  }

  verDetalle(a: Acceso): void {
    this.router.navigate(['/detalle-acceso', a.id]);
  }

 

formatFecha(fecha: string): string {
  const d     = new Date(fecha);
  const ahora = new Date();
  const diffH = Math.floor((ahora.getTime() - d.getTime()) / (1000 * 60 * 60));
  const diffD = Math.floor(diffH / 24);

  if (diffH < 1)   return 'Hace menos de 1h';
  if (diffH < 24)  return `Hace ${diffH}h`;
  if (diffD === 1) return 'Ayer';
  if (diffD < 7)   return `Hace ${diffD} días`;
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

formatHora(fecha: string): string {
  const d = new Date(fecha);
  return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}
}