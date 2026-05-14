// src/app/pages/detalle-credencial/detalle-credencial.ts
import { Component, OnInit, OnDestroy, NgZone, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, RouterLink, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { QrService } from '../../services/qr';
import { GeocodingService } from '../../services/geocoding';
import { environment } from '../../../environments/environment';

interface Credencial {
  id:                 number;
  tipo_usuario:       string;
  numero_id:          string;
  correo:             string;
  activa:             boolean;
  estado:             string;
  creado_en:          string;
  institucion_id:     number;
  institucion_nombre: string;
  institucion_tipo:   string;
  ciudad:             string;
  estado_inst:        string;
  punto_acceso_id:    number;
  punto_nombre:       string;
  punto_tipo:         string;
  punto_descripcion:  string;
  nivel_acceso:       string;
  inst_lat:           number | null;
  inst_lng:           number | null;
  inst_radio:         number | null;
}

const TIPO_ICON: Record<string, string> = {
  edificio: '🏛', biblioteca: '📚', laboratorio: '🔬',
  cafeteria: '☕', deportiva: '⚽', otro: '📍',
};

@Component({
  selector: 'app-detalle-credencial',
  standalone: true,
  imports: [RouterLink, CommonModule],
  templateUrl: './detalle-credencial.html',
  styleUrls: ['./detalle-credencial.scss']
})
export class DetalleCredencial implements OnInit, OnDestroy {

  credencial: Credencial | null = null;
  cargando   = true;
  error      = '';
  procesando = false;

  // QR
  qrVisible      = false;
  qrDataUrl      = '';
  qrGenerando    = false;
  geoError       = '';
  geoSolicitando = false;
  countdown      = 45;
  timerPercent   = 100;
  private countdownInterval: any;

  // Ubicación de la institución
  direccionGeo   = '';
  cargandoGeo    = false;
  tieneUbicacion = false;

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

  private readonly apiUrl = environment.apiUrl;

  constructor(
    private route:     ActivatedRoute,
    private http:      HttpClient,
    private router:    Router,
    private ngZone:    NgZone,
    private cdr:       ChangeDetectorRef,
    private qrService: QrService,
    private geocoding: GeocodingService
  ) {}

  private get headers(): HttpHeaders {
    return new HttpHeaders({
      'Authorization':  `Bearer ${localStorage.getItem('token') ?? ''}`,
      'Cache-Control':  'no-cache, no-store, must-revalidate',
      'Pragma':         'no-cache',
      'Expires':        '0'
    });
  }

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!id || isNaN(id)) {
      this.error    = 'ID de credencial inválido.';
      this.cargando = false;
      return;
    }

    this.http.get<Credencial>(
      `${this.apiUrl}/credenciales/${id}?t=${Date.now()}`,
      { headers: this.headers }
    ).subscribe({
      next: (data) => {
        this.ngZone.run(() => {
          this.credencial    = data;
          this.cargando      = false;
          this.tieneUbicacion = !!(data.inst_lat && data.inst_lng);
          this.cdr.detectChanges();

          if (data.inst_lat && data.inst_lng) {
            this.cargandoGeo = true;
            this.cdr.detectChanges();
            this.geocoding.obtenerDireccion(data.inst_lat, data.inst_lng)
              .subscribe(dir => {
                this.ngZone.run(() => {
                  this.direccionGeo = dir;
                  this.cargandoGeo  = false;
                  this.cdr.detectChanges();
                });
              });
          }
        });
      },
      error: (err) => {
        this.ngZone.run(() => {
          if (err.status === 401 || err.status === 403) {
            this.router.navigate(['/login']); return;
          }
          this.error    = err.status === 404
            ? 'Credencial no encontrada.'
            : `Error ${err.status}: ${err.error?.message ?? 'No se pudo cargar.'}`;
          this.cargando = false;
          this.cdr.detectChanges();
        });
      }
    });
  }

  ngOnDestroy(): void {
    clearInterval(this.countdownInterval);
  }

  // ── Eliminar credencial ─────────────────────────────────────────────────────
  pedirEliminarCredencial(): void {
    if (!this.credencial) return;
    this.pedirConfirmacion(
      'Eliminar credencial',
      `¿Estás seguro de que deseas eliminar tu credencial de "${this.credencial.punto_nombre}"? Esta acción es permanente y no se puede deshacer.`,
      () => this.ejecutarEliminacion()
    );
  }

  private ejecutarEliminacion(): void {
    if (!this.credencial) return;
    this.procesando = true;
    this.cdr.detectChanges();

    this.http.delete(
      `${this.apiUrl}/credenciales/${this.credencial.id}`,
      { headers: this.headers }
    ).subscribe({
      next: () => {
        this.ngZone.run(() => {
          this.procesando         = false;
          this._redirigirAlCerrar = true;
          this.mostrarResultado(
            'Credencial eliminada',
            'Tu credencial ha sido eliminada correctamente.',
            'exito'
          );
        });
      },
      error: (err) => {
        this.ngZone.run(() => {
          this.procesando = false;
          this.mostrarResultado(
            'Error al eliminar',
            err?.error?.message ?? 'No se pudo eliminar la credencial.',
            'error'
          );
        });
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
      this.router.navigate(['/tarjetas']);
    }
    this.cdr.detectChanges();
  }

  cancelarGeo(): void {
  this.geoSolicitando = false;
}

cerrarGeoError(): void {
  this.geoError = '';
}

  // ── Generar QR con geolocalización ─────────────────────────────────────────
  mostrarQR(): void {
    if (this.qrGenerando) return;

    this.geoError       = '';
    this.geoSolicitando = true;
    this.cdr.detectChanges();

    if (!navigator.geolocation) {
      this.geoSolicitando = false;
      this.iniciarQR(undefined, undefined);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.ngZone.run(() => {
          this.geoSolicitando = false;
          this.iniciarQR(pos.coords.latitude, pos.coords.longitude);
        });
      },
      (err) => {
        this.ngZone.run(() => {
          this.geoSolicitando = false;
          console.warn('Geolocalización no disponible:', err.message);
          this.iniciarQR(undefined, undefined);
        });
      },
      { timeout: 10000, maximumAge: 30000, enableHighAccuracy: true }
    );
  }

  private iniciarQR(latitud?: number, longitud?: number): void {
    this.qrVisible   = true;
    this.qrDataUrl   = '';
    this.qrGenerando = true;
    this.geoError    = '';
    this.cdr.detectChanges();
    this.generarQR(latitud, longitud);
    this.iniciarCountdown();
  }

  ocultarQR(): void {
    this.qrVisible      = false;
    this.qrDataUrl      = '';
    this.qrGenerando    = false;
    this.geoError       = '';
    this.geoSolicitando = false;
    clearInterval(this.countdownInterval);
    this.countdown    = 45;
    this.timerPercent = 100;
    this.cdr.detectChanges();
  }

  private generarQR(latitud?: number, longitud?: number): void {
    if (!this.credencial) return;

    this.qrService.generarToken(this.credencial.id, latitud, longitud).subscribe({
      next: (data) => {
        this.ngZone.run(() => {
          const encoded  = encodeURIComponent(data.token);
          this.qrDataUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encoded}&bgcolor=ffffff&color=4D0F60&margin=10`;
          this.qrGenerando = false;
          this.cdr.detectChanges();
        });
      },
      error: (err) => {
        this.ngZone.run(() => {
          this.qrGenerando  = false;
          this.qrVisible    = false;
          clearInterval(this.countdownInterval);
          this.countdown    = 45;
          this.timerPercent = 100;
          this.geoError = err.error?.message ?? 'No se pudo generar el código QR.';
          this.cdr.detectChanges();
        });
      }
    });
  }

  private iniciarCountdown(): void {
    clearInterval(this.countdownInterval);
    this.countdown    = 45;
    this.timerPercent = 100;

    this.countdownInterval = setInterval(() => {
      this.ngZone.run(() => {
        this.countdown--;
        this.timerPercent = (this.countdown / 45) * 100;

        if (this.countdown <= 0) {
          clearInterval(this.countdownInterval);
          this.qrDataUrl = '';
          if (!navigator.geolocation) {
            this.generarQR(undefined, undefined);
            this.iniciarCountdown();
            return;
          }
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              this.ngZone.run(() => {
                this.generarQR(pos.coords.latitude, pos.coords.longitude);
                this.iniciarCountdown();
              });
            },
            () => {
              this.ngZone.run(() => {
                this.generarQR(undefined, undefined);
                this.iniciarCountdown();
              });
            },
            { timeout: 8000, maximumAge: 60000, enableHighAccuracy: false }
          );
        }
        this.cdr.detectChanges();
      });
    }, 1000);
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────
  getIniciales(n: string): string {
    return n.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
  }

  getIcon(tipo: string): string { return TIPO_ICON[tipo] ?? '📍'; }

  getNivelColor(nivel: string): string {
    return ({ abierto: '#2e7d32', restringido: '#e65100', exclusivo: '#A93845' } as any)[nivel] ?? '#4A4D56';
  }

  formatFecha(fecha: string): string {
    return new Date(fecha).toLocaleDateString('es-MX', {
      year: 'numeric', month: 'long', day: 'numeric'
    });
  }

  formatFechaCorta(fecha: string): string {
    return new Date(fecha).toLocaleDateString('es-MX', {
      month: '2-digit', year: '2-digit'
    });
  }
}