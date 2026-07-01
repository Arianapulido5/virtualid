import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient, HttpHeaders, HttpClientModule } from '@angular/common/http';
import { SidebarAdminComponent } from '../../../shared/sidebar-admin/sidebar-admin';
import { environment } from '../../../../environments/environment';

interface AccesoDetalle {
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
  usuario_id:        number;
  punto_nombre:      string;
  punto_tipo:        string;
  institucion_nombre: string;
  horario_activo:    boolean;
  hora_entrada:      string | null;
  hora_salida:       string | null;
  comida_inicio:     string | null;
  comida_fin:        string | null;
}

interface EstadoPuntualidad {
  texto:   string;
  detalle: string;
  clase:   string;
}

@Component({
  selector: 'app-detalle-acceso',
  standalone: true,
  imports: [CommonModule, SidebarAdminComponent, HttpClientModule],
  templateUrl: './detalle-acceso.html',
  styleUrls: ['./detalle-acceso.scss']
})
export class DetalleAcceso implements OnInit {
  cargando = true;
  acceso: AccesoDetalle | null = null;

  private apiBase = environment.apiUrl;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) {}

  private get headers(): HttpHeaders {
    const token = localStorage.getItem('token') ?? '';
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) { this.cargando = false; return; }

    this.http.get<AccesoDetalle>(
      `${this.apiBase}/historial/acceso/${id}`,
      { headers: this.headers }
    ).subscribe({
      next: (data) => {
        this.acceso  = data;
        this.cargando = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.cargando = false;
        this.cdr.detectChanges();
      }
    });
  }

  get nombreCompleto(): string {
    if (!this.acceso) return '';
    return `${this.acceso.nombre} ${this.acceso.apellido_paterno} ${this.acceso.apellido_materno ?? ''}`.trim();
  }

  get iniciales(): string {
    if (!this.acceso) return '';
    return (this.acceso.nombre[0] + this.acceso.apellido_paterno[0]).toUpperCase();
  }

  get avatarColor(): string {
    const colors = ['purple', 'blue', 'teal', 'dark', 'green'];
    if (!this.acceso) return 'purple';
    return colors[this.acceso.usuario_id % colors.length];
  }

  get puntoIcon(): string {
    const map: Record<string, string> = {
      edificio: '🏛', biblioteca: '📚', laboratorio: '🔬',
      cafeteria: '☕', deportiva: '⚽', otro: '📍'
    };
    return map[this.acceso?.punto_tipo ?? ''] ?? '📍';
  }

  formatFechaCompleta(fecha: string): string {
    return new Date(fecha).toLocaleString('es-MX', {
      weekday: 'long', day: '2-digit', month: 'long',
      year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  }

  formatFechaSola(fecha: string): string {
    return new Date(fecha).toLocaleDateString('es-MX', {
      weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
    });
  }

  formatHora(fecha: string): string {
    return new Date(fecha).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  }

  formatHoraExacta(fecha: string): string {
    return new Date(fecha).toLocaleTimeString('es-MX', {
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
  }

  formatDia(fecha: string): string {
    const d = new Date(fecha), hoy = new Date(), ayer = new Date();
    ayer.setDate(hoy.getDate() - 1);
    if (d.toDateString() === hoy.toDateString())  return 'Hoy';
    if (d.toDateString() === ayer.toDateString()) return 'Ayer';
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
  }

  volver(): void { this.router.navigate(['/admin/historial-global']); }

  verUsuario(): void {
    if (this.acceso?.usuario_id) this.router.navigate(['/admin/usuarios', this.acceso.usuario_id]);
  }

  // ─────────────────────────────────────────────────────────
  //  PUNTUALIDAD (misma lógica que historial-global)
  // ─────────────────────────────────────────────────────────

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
   * Calcula el estado de puntualidad del registro actual (igual que en
   * historial-global): compara la hora real contra hora_entrada/hora_salida
   * o comida_inicio/comida_fin según corresponda, usando la ventana de
   * comida como frontera para saber si es llegada/regreso o salida/final.
   */
  get puntualidadInfo(): EstadoPuntualidad {
    const r = this.acceso;
    if (!r) return { texto: '', detalle: '', clase: 'neutro' };

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