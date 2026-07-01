import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { SidebarAdminComponent } from '../../../shared/sidebar-admin/sidebar-admin';
import { environment } from '../../../../environments/environment';

interface PuntoEstadistica {
  id:                     number;
  nombre:                 string;
  tipo:                   string;
  total_evaluadas:        number;
  total_puntuales:        number;
  total_tarde:            number;
  porcentaje_puntualidad: number;
  promedio_retraso_min:   number;
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
  usuarios_puntuales:   UsuarioEstadistica[];
  usuarios_impuntuales: UsuarioEstadistica[];
  puntos_puntuales:     PuntoEstadistica[];
  puntos_impuntuales:   PuntoEstadistica[];
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
  error    = '';

  periodo     = 'hoy';
  fechaInicio = '';
  fechaFin    = '';
  errorFecha  = '';

  usuariosPuntuales:   UsuarioEstadistica[] = [];
  usuariosImpuntuales: UsuarioEstadistica[] = [];
  puntosPuntuales:     PuntoEstadistica[]   = [];
  puntosImpuntuales:   PuntoEstadistica[]   = [];

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
    this.error    = '';
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
        this.usuariosPuntuales   = data?.usuarios_puntuales   ?? [];
        this.usuariosImpuntuales = data?.usuarios_impuntuales ?? [];
        this.puntosPuntuales     = data?.puntos_puntuales     ?? [];
        this.puntosImpuntuales   = data?.puntos_impuntuales   ?? [];
        this.cargando = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error cargando estadísticas:', err);
        this.usuariosPuntuales   = [];
        this.usuariosImpuntuales = [];
        this.puntosPuntuales     = [];
        this.puntosImpuntuales   = [];
        this.error = err?.status
          ? `Error ${err.status}: ${err.error?.message ?? 'no se pudieron cargar las estadísticas.'}`
          : 'No se pudo conectar con el servidor.';
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

  // Convierte minutos a "Xh Ym" cuando pasa de 60, si no deja "Y min"
  formatMinutos(min: number): string {
    if (min < 60) return `${min} min`;
    const horas   = Math.floor(min / 60);
    const restoMin = min % 60;
    return restoMin > 0 ? `${horas}h ${restoMin} min` : `${horas}h`;
  }

  irAHistorialPunto(p: PuntoEstadistica): void {
    this.router.navigate(['/admin/puntos-acceso', p.id, 'historial']);
  }
}