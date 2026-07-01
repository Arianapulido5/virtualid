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
  horario_activo:    boolean;
  hora_entrada:      string | null;
  hora_salida:       string | null;
  comida_inicio:     string | null;
  comida_fin:        string | null;
}

interface PuntoFiltro { id: number; nombre: string; }

interface EstadoPuntualidad {
  texto:   string;
  detalle: string;
  clase:   string;
}

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
   * Calcula el estado de puntualidad de un registro (mismo criterio que en
   * Historial Global / Historial de Acceso), usando el horario propio de
   * CADA registro, ya que aquí los registros pueden venir de distintos
   * puntos de acceso.
   */
  puntualidad(r: Registro): EstadoPuntualidad {
    if (!r.horario_activo) {
      return { texto: 'Sin horario', detalle: '', clase: 'neutro' };
    }

    const horaRealMin = this.minutosReales(r.creado_en);

    const minEntrada      = r.hora_entrada  ? this.aMinutos(r.hora_entrada)  : null;
    const minSalida       = r.hora_salida   ? this.aMinutos(r.hora_salida)   : null;
    const minComidaInicio = r.comida_inicio ? this.aMinutos(r.comida_inicio) : null;
    const minComidaFin    = r.comida_fin    ? this.aMinutos(r.comida_fin)    : null;

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
}