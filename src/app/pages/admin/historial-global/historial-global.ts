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
  horario_activo:    boolean;
  hora_entrada:      string | null;
  comida_inicio:     string | null;
  comida_fin:        string | null;
}

interface PuntoFiltro {
  id:     number;
  nombre: string;
}

interface EstadoPuntualidad {
  texto:   string;
  detalle: string;
  clase:   string;
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

  /** Devuelve la fecha de hoy en zona Mexico_City como YYYY-MM-DD */
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

  /** Hora corta del registro en formato "08:03 a.m." (zona México) */
  private horaCorta(fecha: string): string {
    return new Date(fecha).toLocaleTimeString('es-MX', {
      timeZone: 'America/Mexico_City',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /** Convierte "HH:mm:ss" o "HH:mm" a minutos desde medianoche */
  private aMinutos(hora: string): number {
    const [h, m] = hora.substring(0, 5).split(':').map(Number);
    return h * 60 + m;
  }

  /**
   * Calcula el estado de puntualidad de un registro:
   * - salida          → "Salió" + hora a la que salió
   * - entrada normal  → "Puntual" + hora, o "Retraso" + minutos (vs hora_entrada)
   * - entrada después de comida_inicio → mismo cálculo pero vs comida_fin
   */
  puntualidad(r: Registro): EstadoPuntualidad {
    const horaFmt = this.horaCorta(r.creado_en);

    // ── SALIDA (incluye salida a comer) ──
    if (r.tipo_movimiento === 'salida') {
      return { texto: 'Salió', detalle: horaFmt, clase: 'salida' };
    }

    // ── ENTRADA ──
    if (!r.horario_activo || !r.hora_entrada) {
      return { texto: 'Sin horario', detalle: '', clase: 'neutro' };
    }

    const horaRealMin = this.aMinutos(
      new Date(r.creado_en).toLocaleTimeString('en-GB', {
        timeZone: 'America/Mexico_City',
        hour: '2-digit', minute: '2-digit', hour12: false
      })
    );

    const minEntrada      = this.aMinutos(r.hora_entrada);
    const minComidaInicio = r.comida_inicio ? this.aMinutos(r.comida_inicio) : null;
    const minComidaFin    = r.comida_fin    ? this.aMinutos(r.comida_fin)    : null;

    // Si la entrada ocurre después de que inició la comida, se asume
    // que es el regreso de comer y se compara contra comida_fin
    const esRegresoComida = minComidaInicio !== null && minComidaFin !== null
      && horaRealMin >= minComidaInicio;

    const referencia = esRegresoComida ? (minComidaFin as number) : minEntrada;
    const diff = horaRealMin - referencia;

    if (diff <= 0) {
      return { texto: 'Puntual', detalle: horaFmt, clase: 'puntual' };
    }
    return { texto: 'Retraso', detalle: `${diff} min`, clase: 'tarde' };
  }
}