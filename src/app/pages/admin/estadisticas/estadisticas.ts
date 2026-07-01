import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { SidebarAdminComponent } from '../../../shared/sidebar-admin/sidebar-admin';
import { environment } from '../../../../environments/environment';

interface PuntoConcurrido {
  id:     number;
  nombre: string;
  tipo:   string;
  total:  number;
}

interface UsuarioEstadistica {
  id:                     number;
  nombre_completo:        string;
  correo:                 string;
  total_evaluadas:        number;
  total_puntuales:        number;
  total_tarde:            number;
  porcentaje_puntualidad: number;
  promedio_retraso_min:   number;
}

interface EstadisticasData {
  puntos_concurridos:   PuntoConcurrido[];
  usuarios_puntuales:   UsuarioEstadistica[];
  usuarios_impuntuales: UsuarioEstadistica[];
}

@Component({
  selector: 'app-estadisticas',
  standalone: true,
  imports: [CommonModule, FormsModule, SidebarAdminComponent],
  templateUrl: './estadisticas.html',
  styleUrls: ['./estadisticas.scss']
})
export class Estadisticas implements OnInit {

  cargando = true;

  periodo     = 'mes';
  fechaInicio = '';
  fechaFin    = '';
  errorFecha  = '';

  puntosConcurridos:   PuntoConcurrido[]      = [];
  usuariosPuntuales:   UsuarioEstadistica[]   = [];
  usuariosImpuntuales: UsuarioEstadistica[]   = [];

  constructor(
    private http:   HttpClient,
    private router: Router,
    private cdr:    ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.cargar();
  }

  private headers(): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${localStorage.getItem('token') ?? ''}` });
  }

  private fechaHoyMX(): string {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });
  }

  cargar(): void {
    this.cargando = true;
    this.cdr.detectChanges();

    const params: Record<string, string> = {};

    if (this.periodo === 'rango') {
      if (this.fechaInicio) params['fecha_inicio'] = this.fechaInicio;
      if (this.fechaFin)    params['fecha_fin']    = this.fechaFin;
    } else if (this.periodo === 'fecha') {
      if (this.fechaInicio) params['fecha'] = this.fechaInicio;
    } else if (this.periodo === 'hoy') {
      params['fecha'] = this.fechaHoyMX();
    } else if (this.periodo !== 'todos') {
      params['periodo'] = this.periodo;
    }

    const query = new URLSearchParams(params).toString();
    const url   = `${environment.apiUrl}/admin/estadisticas${query ? '?' + query : ''}`;

    this.http.get<EstadisticasData>(url, { headers: this.headers() }).subscribe({
      next: (data) => {
        this.puntosConcurridos   = data?.puntos_concurridos   ?? [];
        this.usuariosPuntuales   = data?.usuarios_puntuales   ?? [];
        this.usuariosImpuntuales = data?.usuarios_impuntuales ?? [];
        this.cargando = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error cargando estadísticas:', err);
        this.puntosConcurridos   = [];
        this.usuariosPuntuales   = [];
        this.usuariosImpuntuales = [];
        this.cargando = false;
        this.cdr.detectChanges();
      }
    });
  }

  onPeriodoChange(): void {
    this.fechaInicio = '';
    this.fechaFin    = '';
    this.errorFecha  = '';

    if (this.periodo === 'fecha' || this.periodo === 'rango') {
      this.cargando = false;
      this.cdr.detectChanges();
    } else {
      this.cargar();
    }
  }

  onFechaChange(): void {
    if (this.periodo === 'fecha' && this.fechaInicio) {
      this.cargar();
    } else if (this.periodo === 'rango' && this.fechaInicio && this.fechaFin) {
      this.cargar();
    }
  }

  get maxPunto(): number {
    return this.puntosConcurridos.length ? this.puntosConcurridos[0].total : 1;
  }

  rankClase(i: number): string {
    if (i === 0) return 'oro';
    if (i === 1) return 'plata';
    if (i === 2) return 'bronce';
    return '';
  }

  iniciales(nombreCompleto: string): string {
    const partes = nombreCompleto.trim().split(' ');
    const a = partes[0]?.[0] ?? '';
    const b = partes[1]?.[0] ?? '';
    return (a + b).toUpperCase();
  }

  avatarColor(index: number): string {
    return ['purple', 'blue', 'teal', 'dark', 'green'][index % 5];
  }

  puntoIcon(tipo: string): string {
    const map: Record<string, string> = {
      edificio: '🏢', biblioteca: '📚', laboratorio: '🔬',
      cafeteria: '☕', deportiva: '⚽', otro: '📍'
    };
    return map[tipo] ?? '📍';
  }

  irAHistorialPunto(p: PuntoConcurrido): void {
    this.router.navigate(['/admin/puntos-acceso', p.id, 'historial']);
  }
}