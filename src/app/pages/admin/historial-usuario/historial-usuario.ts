import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { SidebarAdminComponent } from '../../../shared/sidebar-admin/sidebar-admin';
import { environment } from '../../../../environments/environment';

interface Registro {
  id:                number;
  exitoso:           boolean;
  motivo_denegacion: string | null;
  creado_en:         string;
  tipo_movimiento:   string;
  punto_id:          number;
  punto_nombre:      string;
  punto_tipo:        string;
}

interface PuntoFiltro { id: number; nombre: string; }

@Component({
  selector: 'app-historial-usuario',
  standalone: true,
  imports: [CommonModule, FormsModule, SidebarAdminComponent, RouterLink],
  templateUrl: './historial-usuario.html',
  styleUrls: ['./historial-usuario.scss']
})
export class HistorialUsuario implements OnInit {
  cargando = true;
  usuarioId = 0;
  nombreUsuario = '';
  backUrl = '';

  filtroPunto       = 'todos';
  filtroTipo        = 'todos';
  filtroResultado   = 'todos';
  filtroPeriodo     = 'todos';
  filtroFechaInicio = '';
  filtroFechaFin    = '';

  registros: Registro[]    = [];
  puntos:    PuntoFiltro[] = [];

  constructor(
    private http: HttpClient,
    private router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.usuarioId = parseInt(this.route.snapshot.paramMap.get('id') ?? '0');
    this.backUrl   = `/admin/usuarios/${this.usuarioId}`;
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

    if (this.filtroPeriodo === 'rango') {
      if (this.filtroFechaInicio) params['fecha_inicio'] = this.filtroFechaInicio;
      if (this.filtroFechaFin)    params['fecha_fin']    = this.filtroFechaFin;
    } else if (this.filtroPeriodo === 'fecha') {
      if (this.filtroFechaInicio) params['fecha'] = this.filtroFechaInicio;
    } else if (this.filtroPeriodo === 'hoy') {
      params['fecha'] = this.fechaHoyMX();
    } else if (this.filtroPeriodo !== 'todos') {
      params['periodo'] = this.filtroPeriodo;
    }

    if (this.filtroPunto     !== 'todos') params['punto_id']  = this.filtroPunto;
    if (this.filtroResultado !== 'todos') params['resultado'] = this.filtroResultado;
    if (this.filtroTipo      !== 'todos') params['tipo']      = this.filtroTipo;

    const query = new URLSearchParams(params).toString();
    const url   = `${environment.apiUrl}/historial/usuario/${this.usuarioId}${query ? '?' + query : ''}`;

    this.http.get<{ usuario: any; registros: Registro[]; puntos: PuntoFiltro[] }>(url, { headers: this.headers() })
      .subscribe({
        next: (data) => {
          const u = data.usuario;
          this.nombreUsuario = `${u.nombre} ${u.apellido_paterno} ${u.apellido_materno}`.trim();
          this.registros     = data.registros;
          this.puntos        = data.puntos;
          this.cargando      = false;
          this.cdr.detectChanges();
        },
        error: () => {
          this.cargando = false;
          this.router.navigate([`/admin/usuarios/${this.usuarioId}`]);
        }
      });
  }

  onPeriodoChange(): void {
    this.filtroFechaInicio = '';
    this.filtroFechaFin    = '';

    if (this.filtroPeriodo === 'fecha' || this.filtroPeriodo === 'rango') {
      this.cargando = false;
      this.cdr.detectChanges();
    } else {
      this.cargar();
    }
  }

  onFiltroChange(): void {
    if (this.filtroPeriodo === 'fecha' && !this.filtroFechaInicio) return;
    if (this.filtroPeriodo === 'rango' && (!this.filtroFechaInicio || !this.filtroFechaFin)) return;
    this.cargar();
  }

  onFechaChange(): void {
    if (this.filtroPeriodo === 'fecha' && this.filtroFechaInicio) {
      this.cargar();
    } else if (this.filtroPeriodo === 'rango' && this.filtroFechaInicio && this.filtroFechaFin) {
      this.cargar();
    }
  }

  verDetalle(r: Registro): void { this.router.navigate(['/admin/acceso', r.id]); }

  puntoIcon(tipo: string): string {
    const map: Record<string, string> = {
      edificio: '🏢', biblioteca: '📚', laboratorio: '🔬',
      cafeteria: '☕', deportiva: '⚽', otro: '📍'
    };
    return map[tipo] ?? '📍';
  }

  formatFecha(fecha: string): string {
    const d   = new Date(fecha);
    const now = new Date();

    const fechaMX = new Date(d.toLocaleString('en-US', { timeZone: 'America/Mexico_City' }));
    const hoyMX   = new Date(now.toLocaleString('en-US', { timeZone: 'America/Mexico_City' }));
    const ayerMX  = new Date(now.toLocaleString('en-US', { timeZone: 'America/Mexico_City' }));
    ayerMX.setDate(ayerMX.getDate() - 1);

    const hora = d.toLocaleTimeString('es-MX', {
      timeZone: 'America/Mexico_City',
      hour: '2-digit',
      minute: '2-digit'
    });

    const mismodia = (a: Date, b: Date) =>
      a.getFullYear() === b.getFullYear() &&
      a.getMonth()    === b.getMonth()    &&
      a.getDate()     === b.getDate();

    if (mismodia(fechaMX, hoyMX))  return `Hoy, ${hora}`;
    if (mismodia(fechaMX, ayerMX)) return `Ayer, ${hora}`;

    return fechaMX.toLocaleDateString('es-MX', {
      timeZone: 'America/Mexico_City',
      day: '2-digit',
      month: 'short'
    }) + `, ${hora}`;
  }
}