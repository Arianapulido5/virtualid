import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { SidebarAdminComponent } from '../../../shared/sidebar-admin/sidebar-admin';
import { environment } from '../../../../environments/environment';
import { ActivatedRoute } from '@angular/router';

interface Registro {
  id:                number;
  exitoso:           boolean;
  motivo_denegacion: string | null;
  creado_en:         string;
  tipo_movimiento:   string;
  nombre:            string;
  apellido_paterno:  string;
  apellido_materno:  string;
  correo:            string;
  punto_id:          number;
  punto_nombre:      string;
  punto_tipo:        string;
}

interface PuntoFiltro {
  id:     number;
  nombre: string;
}

@Component({
  selector: 'app-historial-global',
  standalone: true,
  imports: [CommonModule, FormsModule, SidebarAdminComponent],
  templateUrl: './historial-global.html',
  styleUrls: ['./historial-global.scss']
})
export class HistorialGlobal implements OnInit {

  cargando = true;

  filtroPunto       = 'todos';
  filtroResultado   = 'todos';
  filtroTipo        = 'todos';
  filtroPeriodo     = 'hoy';
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
    this.route.queryParams.subscribe(params => {
      if (params['periodo'])   this.filtroPeriodo   = params['periodo'];
      if (params['resultado']) this.filtroResultado = params['resultado'];
      if (params['punto_id'])  this.filtroPunto     = params['punto_id'];
      if (params['tipo'])      this.filtroTipo      = params['tipo'];
      this.cargar();
    });
  }

  private headers(): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${localStorage.getItem('token') ?? ''}` });
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
    } else if (this.filtroPeriodo !== 'todos') {
      params['periodo'] = this.filtroPeriodo;
    }

    if (this.filtroPunto     !== 'todos') params['punto_id']  = this.filtroPunto;
    if (this.filtroResultado !== 'todos') params['resultado'] = this.filtroResultado;
    if (this.filtroTipo      !== 'todos') params['tipo']      = this.filtroTipo;

    const query = new URLSearchParams(params).toString();
    const url   = `${environment.apiUrl}/historial/admin${query ? '?' + query : ''}`;

    this.http.get<{ registros: Registro[]; puntos: PuntoFiltro[] }>(url, { headers: this.headers() })
      .subscribe({
        next: (data) => {
          this.registros = data.registros;
          this.puntos    = data.puntos;
          this.cargando  = false;
          this.cdr.detectChanges();
        },
        error: () => { this.cargando = false; this.cdr.detectChanges(); }
      });
  }

  onFiltroChange(): void {
    if (this.filtroPeriodo !== 'fecha' && this.filtroPeriodo !== 'rango') {
      // Periodo simple (hoy/semana/mes/todos): resetear fechas y cargar
      this.filtroFechaInicio = '';
      this.filtroFechaFin    = '';
      this.cargar();
    } else if (this.filtroPeriodo === 'fecha' && this.filtroFechaInicio) {
      // Hay fecha seleccionada: recargar con los filtros actuales
      this.cargar();
    } else if (this.filtroPeriodo === 'rango' && this.filtroFechaInicio && this.filtroFechaFin) {
      // Rango completo: recargar con los filtros actuales
      this.cargar();
    }
    // Si es fecha/rango sin fechas completas: esperar que el usuario las llene
  }

  onFechaChange(): void {
    if (this.filtroPeriodo === 'fecha' && this.filtroFechaInicio) {
      this.cargar();
    } else if (this.filtroPeriodo === 'rango' && this.filtroFechaInicio && this.filtroFechaFin) {
      this.cargar();
    }
  }

  verDetalle(r: Registro): void { this.router.navigate(['/admin/acceso', r.id]); }
  iniciales(r: Registro): string { return (r.nombre[0] + r.apellido_paterno[0]).toUpperCase(); }
  avatarColor(index: number): string { return ['purple', 'blue', 'teal', 'dark'][index % 4]; }
  nombreCompleto(r: Registro): string { return `${r.nombre} ${r.apellido_paterno} ${r.apellido_materno}`.trim(); }

  puntoIcon(tipo: string): string {
    const map: Record<string, string> = {
      edificio: '🏢', biblioteca: '📚', laboratorio: '🔬',
      cafeteria: '☕', deportiva: '⚽', otro: '📍'
    };
    return map[tipo] ?? '📍';
  }

  formatFecha(fecha: string): string {
    const d = new Date(fecha), hoy = new Date(), ayer = new Date();
    ayer.setDate(hoy.getDate() - 1);
    const hora = d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
    if (d.toDateString() === hoy.toDateString())  return `Hoy, ${hora}`;
    if (d.toDateString() === ayer.toDateString()) return `Ayer, ${hora}`;
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }) + `, ${hora}`;
  }
}