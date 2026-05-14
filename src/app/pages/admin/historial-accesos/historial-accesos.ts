// src/app/pages/admin/historial-accesos/historial-accesos.ts
import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { SidebarAdminComponent } from '../../../shared/sidebar-admin/sidebar-admin';
import { environment } from '../../../../environments/environment';

interface Registro {
  id:                number;
  exitoso:           boolean;
  motivo_denegacion: string | null;
  creado_en:         string;
  nombre:            string;
  apellido_paterno:  string;
  apellido_materno:  string;
  correo:            string;
  tipo_usuario:      string;
  numero_id:         string | null;
}

interface Paginacion {
  pagina_actual:   number;
  total_paginas:   number;
  total_registros: number;
  por_pagina:      number;
}

interface PuntoInfo {
  id:            number;
  nombre:        string;
  descripcion:   string;
  tipo:          string;
  activo:        boolean;
  accesos_hoy:   number;
  denegados_hoy: number;
}

@Component({
  selector: 'app-historial-accesos',
  standalone: true,
  imports: [CommonModule, FormsModule, SidebarAdminComponent, RouterLink],
  templateUrl: './historial-accesos.html',
  styleUrls: ['./historial-accesos.scss']
})
export class HistorialAccesos implements OnInit {

  cargando   = true;
  procesando = false;
  puntoId    = 0;

  periodo         = 'hoy';
  fechaInicio     = '';
  fechaFin        = '';
  errorFecha      = '';
  filtroResultado = 'todos';
  filtroTipo      = 'todos';
  busqueda        = '';
  paginaActual    = 1;

  punto: PuntoInfo = {
    id: 0, nombre: '', descripcion: '', tipo: '',
    activo: true, accesos_hoy: 0, denegados_hoy: 0
  };

  registros:  Registro[]  = [];
  paginacion: Paginacion  = {
    pagina_actual: 1, total_paginas: 1,
    total_registros: 0, por_pagina: 20
  };

  // ── Modal confirmación ──────────────────────────────────────────────────────
  confirmVisible = false;
  confirmTitulo  = '';
  confirmMensaje = '';
  private confirmCallback: (() => void) | null = null;

  // ── Modal resultado ─────────────────────────────────────────────────────────
  modalVisible = false;
  modalTitulo  = '';
  modalMensaje = '';
  modalTipo: 'exito' | 'error' = 'exito';
  private _redirigirAlCerrar   = false;

  private apiBase = environment.apiUrl;

  constructor(
    private route:  ActivatedRoute,
    private router: Router,
    private http:   HttpClient,
    private cdr:    ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.puntoId = parseInt(this.route.snapshot.paramMap.get('id') ?? '0');
    this.cargar();
  }

  private get headers(): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${localStorage.getItem('token') ?? ''}` });
  }

  // ── Carga de datos ──────────────────────────────────────────────────────────
  cargar(): void {
    this.cargando = true;
    this.cdr.detectChanges();

    const params: Record<string, string> = {
      pagina:    String(this.paginaActual),
      resultado: this.filtroResultado,
      tipo:      this.filtroTipo,
    };

    if (this.periodo === 'personalizado') {
      if (this.fechaInicio) params['fecha_inicio'] = this.fechaInicio;
      if (this.fechaFin)    params['fecha_fin']    = this.fechaFin;
    } else {
      params['periodo'] = this.periodo;
    }

    if (this.busqueda.trim()) params['busqueda'] = this.busqueda.trim();

    const query = new URLSearchParams(params).toString();
    const url   = `${this.apiBase}/historial/punto/${this.puntoId}?${query}`;

    this.http.get<any>(url, { headers: this.headers }).subscribe({
      next: (data) => {
        this.punto      = data.punto;
        this.registros  = data.registros ?? [];
        this.paginacion = data.paginacion;
        this.cargando   = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error cargando historial:', err);
        this.registros = [];
        this.cargando  = false;
        this.cdr.detectChanges();
      }
    });
  }

  cambiarPeriodo(p: string): void {
    this.periodo      = p;
    this.fechaInicio  = '';
    this.fechaFin     = '';
    this.errorFecha   = '';
    this.paginaActual = 1;
    if (p !== 'personalizado') this.cargar();
    else { this.cargando = false; this.cdr.detectChanges(); }
  }

  aplicarPersonalizado(): void {
    this.errorFecha = '';
    if (!this.fechaInicio || !this.fechaFin) {
      this.errorFecha = 'Selecciona ambas fechas.'; return;
    }
    if (new Date(this.fechaInicio) > new Date(this.fechaFin)) {
      this.errorFecha = 'La fecha inicio no puede ser mayor a la fecha fin.'; return;
    }
    this.paginaActual = 1;
    this.cargar();
  }

  buscar(): void        { this.paginaActual = 1; this.cargar(); }
  onFiltroChange(): void { this.paginaActual = 1; this.cargar(); }

  irPagina(p: number): void {
    if (p < 1 || p > this.paginacion.total_paginas) return;
    this.paginaActual = p;
    this.cargar();
  }

  get paginas(): number[] {
    const total  = this.paginacion.total_paginas;
    const actual = this.paginaActual;
    const rango: number[] = [];
    for (let i = Math.max(1, actual - 2); i <= Math.min(total, actual + 2); i++) {
      rango.push(i);
    }
    return rango;
  }

  // ── Eliminar punto de acceso ────────────────────────────────────────────────
  pedirEliminarPunto(): void {
    this.pedirConfirmacion(
      'Eliminar punto de acceso',
      `¿Estás seguro de que deseas eliminar "${this.punto.nombre}"? Se eliminará junto con todo su historial de accesos. Esta acción es permanente.`,
      () => this.ejecutarEliminarPunto()
    );
  }

  private ejecutarEliminarPunto(): void {
    this.procesando = true;
    this.cdr.detectChanges();

    this.http.delete(
      `${this.apiBase}/puntos-acceso/${this.puntoId}`,
      { headers: this.headers }
    ).subscribe({
      next: () => {
        this.procesando         = false;
        this._redirigirAlCerrar = true;
        this.mostrarResultado(
          'Punto eliminado',
          `"${this.punto.nombre}" ha sido eliminado correctamente del sistema.`,
          'exito'
        );
      },
      error: (err) => {
        this.procesando = false;
        this.mostrarResultado(
          'Error al eliminar',
          err?.error?.message ?? 'No se pudo eliminar el punto de acceso.',
          'error'
        );
      }
    });
  }

  // ── Modales ─────────────────────────────────────────────────────────────────
  private pedirConfirmacion(titulo: string, mensaje: string, accion: () => void): void {
    this.confirmTitulo   = titulo;
    this.confirmMensaje  = mensaje;
    this.confirmCallback = accion;
    this.confirmVisible  = true;
    this.cdr.detectChanges();
  }

  confirmarAccion(): void {
    this.confirmVisible = false;
    if (this.confirmCallback) { this.confirmCallback(); this.confirmCallback = null; }
    this.cdr.detectChanges();
  }

  cancelarConfirmacion(): void {
    this.confirmVisible  = false;
    this.confirmCallback = null;
    this.cdr.detectChanges();
  }

  private mostrarResultado(titulo: string, mensaje: string, tipo: 'exito' | 'error'): void {
    this.modalTitulo  = titulo;
    this.modalMensaje = mensaje;
    this.modalTipo    = tipo;
    this.modalVisible = true;
    this.cdr.detectChanges();
  }

  cerrarModal(): void {
    this.modalVisible = false;
    if (this._redirigirAlCerrar) {
      this._redirigirAlCerrar = false;
      this.router.navigate(['/admin/puntos-acceso']);
    }
    this.cdr.detectChanges();
  }

  // ── Helpers de vista ────────────────────────────────────────────────────────
  iniciales(r: Registro): string {
    return (r.nombre[0] + r.apellido_paterno[0]).toUpperCase();
  }

  avatarColor(index: number): string {
    return ['purple', 'blue', 'teal', 'dark', 'green'][index % 5];
  }

  nombreCompleto(r: Registro): string {
    return `${r.nombre} ${r.apellido_paterno} ${r.apellido_materno ?? ''}`.trim();
  }

  formatHora(fecha: string): string {
    return new Date(fecha).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  }

  formatDia(fecha: string): string {
    const d    = new Date(fecha);
    const hoy  = new Date();
    const ayer = new Date(); ayer.setDate(hoy.getDate() - 1);
    if (d.toDateString() === hoy.toDateString())  return 'Hoy';
    if (d.toDateString() === ayer.toDateString()) return 'Ayer';
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
  }

  detalle(r: Registro): string {
    if (!r.exitoso && r.motivo_denegacion) return `⚠ ${r.motivo_denegacion}`;
    if (!r.exitoso) return '⚠ Acceso denegado';
    return `Credencial válida · ${r.numero_id ?? ''}`;
  }

  esAdvertencia(r: Registro): boolean {
    return !r.exitoso;
  }
}