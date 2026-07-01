// src/app/pages/admin/historial-accesos/historial-accesos.ts
import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
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
  tipo_movimiento:   string;
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
  id:             number;
  nombre:         string;
  descripcion:    string;
  tipo:           string;
  activo:         boolean;
  accesos_hoy:    number;
  denegados_hoy:  number;
  estado_actual:  string;
  hora_entrada:   string | null;
  hora_salida:    string | null;
  horario_activo: boolean;
  comida_inicio:  string | null;
  comida_fin:     string | null;
}

interface EstadoPuntualidad {
  texto:   string;
  detalle: string;
  clase:   string;
}

@Component({
  selector: 'app-historial-accesos',
  standalone: true,
  imports: [CommonModule, FormsModule, SidebarAdminComponent, RouterLink],
  templateUrl: './historial-accesos.html',
  styleUrls: ['./historial-accesos.scss']
})
export class HistorialAccesos implements OnInit, OnDestroy {

  cargando   = true;
  procesando = false;
  puntoId    = 0;

  periodo         = 'hoy';
  fechaInicio     = '';
  fechaFin        = '';
  errorFecha      = '';
  filtroResultado = 'todos';
  filtroTipo      = 'todos';
  paginaActual    = 1;

  private _busqueda = '';
  private busquedaTimeout: any;

  get busquedaValue(): string { return this._busqueda; }
  set busquedaValue(v: string) {
    this._busqueda = v;
    clearTimeout(this.busquedaTimeout);
    this.busquedaTimeout = setTimeout(() => {
      this.paginaActual = 1;
      this.cargar();
    }, 350);
  }

  punto: PuntoInfo = {
    id: 0, nombre: '', descripcion: '', tipo: '',
    activo: true, accesos_hoy: 0, denegados_hoy: 0,
    estado_actual: 'abierto', hora_entrada: null, hora_salida: null,
    horario_activo: false, comida_inicio: null, comida_fin: null
  };

  registros:  Registro[]  = [];
  paginacion: Paginacion  = {
    pagina_actual: 1, total_paginas: 1,
    total_registros: 0, por_pagina: 20
  };

  confirmVisible = false;
  confirmTitulo  = '';
  confirmMensaje = '';
  private confirmCallback: (() => void) | null = null;

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

  ngOnDestroy(): void {
    clearTimeout(this.busquedaTimeout);
  }

  private get headers(): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${localStorage.getItem('token') ?? ''}` });
  }

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

    if (this._busqueda.trim()) params['busqueda'] = this._busqueda.trim();

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

  buscar(): void         { this.paginaActual = 1; this.cargar(); }
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
        this.mostrarResultado('Punto eliminado', `"${this.punto.nombre}" ha sido eliminado correctamente del sistema.`, 'exito');
      },
      error: (err) => {
        this.procesando = false;
        this.mostrarResultado('Error al eliminar', err?.error?.message ?? 'No se pudo eliminar el punto de acceso.', 'error');
      }
    });
  }

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

  verDetalle(r: Registro): void {
    this.router.navigate(['/admin/acceso', r.id]);
  }

  iniciales(r: Registro): string {
    return (r.nombre[0] + r.apellido_paterno[0]).toUpperCase();
  }

  avatarColor(index: number): string {
    return ['purple', 'blue', 'teal', 'dark', 'green'][index % 5];
  }

  nombreCompleto(r: Registro): string {
    return `${r.nombre} ${r.apellido_paterno} ${r.apellido_materno ?? ''}`.trim();
  }

  /** Formatea fecha estilo "Hoy, HH:mm" / "Ayer, HH:mm" / "dd mmm, HH:mm" (zona México) */
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

  /** Convierte "HH:mm:ss" o "HH:mm" a minutos desde medianoche */
  private aMinutos(hora: string): number {
    const [h, m] = hora.substring(0, 5).split(':').map(Number);
    return h * 60 + m;
  }

  /** Hora real del registro (zona México) en minutos desde medianoche */
  private minutosReales(fecha: string): number {
    return this.aMinutos(
      new Date(fecha).toLocaleTimeString('en-GB', {
        timeZone: 'America/Mexico_City',
        hour: '2-digit', minute: '2-digit', hour12: false
      })
    );
  }

  /** Formatea minutos a texto legible: 35 → "35 min", 107 → "1h 47min", 120 → "2h" */
  private formatMin(mins: number): string {
    if (mins < 60) return `${mins} min`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m === 0 ? `${h}h` : `${h}h ${m}min`;
  }

  /**
   * Calcula el estado de puntualidad de un registro para el punto de acceso actual.
   * Usa el horario de `this.punto` (todos los registros de esta página pertenecen
   * al mismo punto), aplicando la misma lógica que en Historial Global.
   */
  puntualidad(r: Registro): EstadoPuntualidad {
    if (!this.punto.horario_activo) {
      return { texto: 'Sin horario', detalle: '', clase: 'neutro' };
    }

    const horaRealMin = this.minutosReales(r.creado_en);

    const minEntrada      = this.punto.hora_entrada  ? this.aMinutos(this.punto.hora_entrada)  : null;
    const minSalida       = this.punto.hora_salida   ? this.aMinutos(this.punto.hora_salida)   : null;
    const minComidaInicio = this.punto.comida_inicio ? this.aMinutos(this.punto.comida_inicio) : null;
    const minComidaFin    = this.punto.comida_fin    ? this.aMinutos(this.punto.comida_fin)    : null;

    const hayComida = minComidaInicio !== null && minComidaFin !== null;

    // ── ENTRADA (llegada inicial o regreso de comer) ──
    if (r.tipo_movimiento === 'entrada') {
      if (minEntrada === null) {
        return { texto: 'Sin horario', detalle: '', clase: 'neutro' };
      }

      const esRegreso = hayComida && horaRealMin >= (minComidaInicio as number);
      const referencia = esRegreso ? (minComidaFin as number) : minEntrada;

      const diff = horaRealMin - referencia;

      if (diff <= 0) {
        return {
          texto: 'Puntual',
          detalle: diff === 0 ? 'A tiempo' : `${this.formatMin(-diff)} antes`,
          clase: 'puntual'
        };
      }
      return { texto: 'Impuntual', detalle: `${this.formatMin(diff)} de retraso`, clase: 'tarde' };
    }

    // ── SALIDA (a comer o salida final) ──
    if (r.tipo_movimiento === 'salida') {
      if (minSalida === null && minComidaInicio === null) {
        return { texto: 'Sin horario', detalle: '', clase: 'neutro' };
      }

      const esSalidaFinal = !hayComida || horaRealMin >= (minComidaFin as number);
      const referencia = esSalidaFinal
        ? (minSalida !== null ? minSalida : (minComidaInicio as number))
        : (minComidaInicio as number);

      const diff = horaRealMin - referencia;

      if (diff >= 0) {
        return {
          texto: 'Puntual',
          detalle: diff === 0 ? 'A tiempo' : `${this.formatMin(diff)} después`,
          clase: 'puntual'
        };
      }
      return { texto: 'Anticipada', detalle: `${this.formatMin(-diff)} antes`, clase: 'anticipada' };
    }

    return { texto: 'Sin horario', detalle: '', clase: 'neutro' };
  }

  estadoBanner(): { texto: string; clase: string } {
    if (!this.punto.activo) return { texto: 'Desactivado', clase: 'banner-estado-inactivo' };
    switch (this.punto.estado_actual) {
      case 'fuera_de_horario': return { texto: 'Cerrado (fuera de horario)', clase: 'banner-estado-cerrado'  };
      case 'cerrado_comida':   return { texto: 'Cerrado (hora de comida)',   clase: 'banner-estado-comida'   };
      case 'sin_horario':      return { texto: 'Sin horario definido',       clase: 'banner-estado-inactivo' };
      default:                 return { texto: 'Abierto',                    clase: 'banner-estado-abierto'  };
    }
  }

  formatHora12Banner(hora: string | null): string {
    if (!hora) return '';
    const [hh, mm] = hora.substring(0, 5).split(':').map(Number);
    const p  = hh >= 12 ? 'p. m.' : 'a. m.';
    const h12 = hh % 12 === 0 ? 12 : hh % 12;
    return `${h12.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')} ${p}`;
  }
}