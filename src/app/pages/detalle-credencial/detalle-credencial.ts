// src/app/pages/detalle-credencial/detalle-credencial.ts
import { Component, OnInit, OnDestroy, NgZone, ChangeDetectorRef, ViewChild, ElementRef } from '@angular/core';
import { ActivatedRoute, RouterLink, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { QrService } from '../../services/qr';
import { GeocodingService } from '../../services/geocoding';
import { BiometricaService } from '../../services/biometrica.service';
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
  styleUrls: ['./detalle-credencial.scss'],
})
export class DetalleCredencial implements OnInit, OnDestroy {

  @ViewChild('faceVideoRef')  faceVideoRef!:  ElementRef<HTMLVideoElement>;
  @ViewChild('faceCanvasRef') faceCanvasRef!: ElementRef<HTMLCanvasElement>;

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

  // ── Movimiento (Entrada / Salida) ─────────────────────────────────────────
  movimientoModalVisible          = false;
  tipoMovimiento: 'entrada' | 'salida' = 'entrada';

  // ── Verificación facial ───────────────────────────────────────────────────
  faceModalVisible  = false;
  faceScanning      = false;
  faceProcessing    = false;
  faceError         = '';
  faceScanLineY     = 60;

  private faceStream:       MediaStream | null = null;
  private scanLineInterval: any = null;
  private faceApiLoaded     = false;
  private timers:           any[] = [];

  // Ubicación
  direccionGeo   = '';
  cargandoGeo    = false;
  tieneUbicacion = false;

  // Modal confirmación
  confirmVisible = false;
  confirmTitulo  = '';
  confirmMensaje = '';
  private confirmCallback: (() => void) | null = null;

  // Modal resultado
  modalVisible = false;
  modalTitulo  = '';
  modalMensaje = '';
  modalTipo: 'exito' | 'error' = 'exito';
  private _redirigirAlCerrar   = false;

  private readonly apiUrl = environment.apiUrl;

  constructor(
    private route:      ActivatedRoute,
    private http:       HttpClient,
    private router:     Router,
    private ngZone:     NgZone,
    public  cdr:        ChangeDetectorRef,   // public para usarlo en template
    private qrService:  QrService,
    private geocoding:  GeocodingService,
    private bioService: BiometricaService,
  ) {}

  private get headers(): HttpHeaders {
    return new HttpHeaders({
      'Authorization':  `Bearer ${localStorage.getItem('token') ?? ''}`,
      'Cache-Control':  'no-cache, no-store, must-revalidate',
      'Pragma':         'no-cache',
      'Expires':        '0',
    });
  }

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!id || isNaN(id)) { this.error = 'ID de credencial inválido.'; this.cargando = false; return; }

    this.http
      .get<Credencial>(`${this.apiUrl}/credenciales/${id}?t=${Date.now()}`, { headers: this.headers })
      .subscribe({
        next: (data) => {
          this.ngZone.run(() => {
            this.credencial     = data;
            this.cargando       = false;
            this.tieneUbicacion = !!(data.inst_lat && data.inst_lng);
            this.cdr.detectChanges();

            if (data.inst_lat && data.inst_lng) {
              this.cargandoGeo = true;
              this.cdr.detectChanges();
              this.geocoding.obtenerDireccion(data.inst_lat, data.inst_lng).subscribe((dir) => {
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
            if (err.status === 401 || err.status === 403) { this.router.navigate(['/login']); return; }
            this.error    = err.status === 404
              ? 'Credencial no encontrada.'
              : `Error ${err.status}: ${err.error?.message ?? 'No se pudo cargar.'}`;
            this.cargando = false;
            this.cdr.detectChanges();
          });
        },
      });
  }

  ngOnDestroy(): void {
    clearInterval(this.countdownInterval);
    this.limpiarCamaraFacial();
    this.timers.forEach(t => clearTimeout(t));
  }

  // ── Eliminar credencial ─────────────────────────────────────────────────────

  pedirEliminarCredencial(): void {
    if (!this.credencial) return;
    this.pedirConfirmacion(
      'Eliminar credencial',
      `¿Estás seguro de que deseas eliminar tu credencial de "${this.credencial.punto_nombre}"? Esta acción es permanente.`,
      () => this.ejecutarEliminacion()
    );
  }

  private ejecutarEliminacion(): void {
    if (!this.credencial) return;
    this.procesando = true;
    this.cdr.detectChanges();

    this.http.delete(`${this.apiUrl}/credenciales/${this.credencial.id}`, { headers: this.headers }).subscribe({
      next: () => {
        this.ngZone.run(() => {
          this.procesando         = false;
          this._redirigirAlCerrar = true;
          this.mostrarResultado('Credencial eliminada', 'Tu credencial ha sido eliminada correctamente.', 'exito');
        });
      },
      error: (err) => {
        this.ngZone.run(() => {
          this.procesando = false;
          this.mostrarResultado('Error al eliminar', err?.error?.message ?? 'No se pudo eliminar la credencial.', 'error');
        });
      },
    });
  }

  // ── Modales genéricos ────────────────────────────────────────────────────────

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
    this.router.navigate(['/tarjetas'], { replaceUrl: true }); // ← agregar replaceUrl
  }
  this.cdr.detectChanges();
}


irAConfiguracion(): void { 
  this.router.navigate(['/configuracion'], { replaceUrl: true }); // ← agregar replaceUrl
}

  cancelarGeo(): void    { this.geoSolicitando = false; this.cdr.detectChanges(); }
  cerrarGeoError(): void { this.geoError = '';           this.cdr.detectChanges(); }

  // ═══════════════════════════════════════════════════════════════════════════
  //  FLUJO: bio facial → modal movimiento → geo → QR
  // ═══════════════════════════════════════════════════════════════════════════

  mostrarQR(): void {
    if (this.qrGenerando || this.faceScanning) return;
    this.geoError  = '';
    this.faceError = '';
    this.abrirModalFacial();
  }

  // ── Paso 1: biometría facial ──────────────────────────────────────────────

  private async abrirModalFacial(): Promise<void> {
    this.faceModalVisible = true;
    this.faceScanning     = false;
    this.faceProcessing   = false;
    this.faceError        = '';
    this.cdr.detectChanges();

    await this.delay(200);

    try {
      await this.cargarFaceApi();
      await this.iniciarCamaraFacial();
    } catch (err: any) {
      this.faceError      = 'No se pudo iniciar la verificación. Inténtalo de nuevo.';
      this.faceScanning   = false;
      this.faceProcessing = false;
      this.cdr.detectChanges();
    }
  }

  cerrarModalFacial(): void {
    this.limpiarCamaraFacial();
    this.faceModalVisible = false;
    this.cdr.detectChanges();
  }

  reintentarFacial(): void {
    this.faceError = '';
    this.abrirModalFacial();
  }

  // ── Carga face-api.js ─────────────────────────────────────────────────────

  private cargarFaceApi(): Promise<void> {
    if (this.faceApiLoaded || (window as any).faceapi) {
      this.faceApiLoaded = true;
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      const script    = document.createElement('script');
      script.src      = 'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js';
      script.onload   = async () => { this.faceApiLoaded = true; await this.cargarModelos(); resolve(); };
      script.onerror  = () => reject(new Error('No se pudo cargar face-api.js'));
      document.head.appendChild(script);
    });
  }

  private async cargarModelos(): Promise<void> {
    const faceapi   = (window as any).faceapi;
    const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.13/model';
    try {
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      ]);
    } catch {
      const ALT = 'https://justadudewhohacks.github.io/face-api.js/models';
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(ALT),
        faceapi.nets.faceLandmark68Net.loadFromUri(ALT),
        faceapi.nets.faceRecognitionNet.loadFromUri(ALT),
      ]);
    }
  }

  // ── Paso 2: cámara ────────────────────────────────────────────────────────

  private async iniciarCamaraFacial(): Promise<void> {
    try {
      this.faceStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });

      const video = this.faceVideoRef?.nativeElement;
      if (!video) { this.faceError = 'No se encontró el elemento de video.'; this.cdr.detectChanges(); return; }

      video.srcObject = this.faceStream;
      await video.play();

      this.faceScanning = true;
      this.iniciarScanLine();
      this.cdr.detectChanges();

      const t = setTimeout(() => this.capturarDescriptor(), 1800);
      this.timers.push(t);

    } catch (err: any) {
      const msg = err?.name === 'NotAllowedError'
        ? 'Permiso de cámara denegado. Actívalo en los ajustes del navegador.'
        : 'No se pudo acceder a la cámara.';
      this.faceError    = msg;
      this.faceScanning = false;
      this.cdr.detectChanges();
    }
  }

  private iniciarScanLine(): void {
    let dir = 1, posY = 50;
    this.scanLineInterval = setInterval(() => {
      posY += dir * 4;
      if (posY > 220) dir = -1;
      if (posY < 50)  dir = 1;
      this.faceScanLineY = posY;
      this.cdr.detectChanges();
    }, 35);
  }

  // ── Paso 3: capturar descriptor ───────────────────────────────────────────

  private async capturarDescriptor(): Promise<void> {
    if (!this.faceScanning) return;

    const faceapi = (window as any).faceapi;
    const video   = this.faceVideoRef?.nativeElement;
    if (!faceapi || !video) { this.faceError = 'Error interno.'; this.cdr.detectChanges(); return; }

    this.faceProcessing = true;
    this.cdr.detectChanges();

    try {
      const det = await faceapi
        .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 }))
        .withFaceLandmarks(true)
        .withFaceDescriptor();

      if (!det) {
        this.faceProcessing = false;
        this.faceError      = 'No se detectó ningún rostro. Centra tu cara y vuelve a intentarlo.';
        this.limpiarCamaraFacial();
        this.cdr.detectChanges();
        return;
      }

      const descriptor = Array.from(det.descriptor as Float32Array) as number[];
      this.limpiarCamaraFacial();
      this.enviarVerificacion(descriptor);

    } catch {
      this.faceProcessing = false;
      this.faceError      = 'Error al procesar el rostro. Inténtalo de nuevo.';
      this.limpiarCamaraFacial();
      this.cdr.detectChanges();
    }
  }

  // ── Paso 4: verificar en backend ──────────────────────────────────────────

  private enviarVerificacion(descriptor: number[]): void {
    this.faceProcessing = true;
    this.cdr.detectChanges();

    this.bioService.verificar(descriptor).subscribe({
      next: () => {
        this.ngZone.run(() => {
          this.faceProcessing   = false;
          this.faceModalVisible = false;
          this.cdr.detectChanges();
          // ← NUEVO: abrir modal de movimiento antes de geo
          this.mostrarModalMovimiento();
        });
      },
      error: (err: any) => {
        this.ngZone.run(() => {
          this.faceProcessing = false;
          const msg = err?.error?.message ?? err?.message ?? '';
          if (err?.error?.sin_biometrica
              || msg.toLowerCase().includes('no tienes biometría')
              || msg.toLowerCase().includes('sin_biometrica')) {
            this.faceError = 'No tienes biometría registrada. Actívala en Configuración para usar esta función.';
          } else if (msg.toLowerCase().includes('no coincide')
                     || msg.toLowerCase().includes('no match')
                     || err?.status === 401) {
            this.faceError = 'El rostro no coincide con el titular de la cuenta. Acceso denegado.';
          } else {
            this.faceError = msg || 'No se pudo verificar tu identidad.';
          }
          this.cdr.detectChanges();
        });
      },
    });
  }

  // ── Paso 5: modal movimiento ──────────────────────────────────────────────

  mostrarModalMovimiento(): void {
    this.movimientoModalVisible = true;
    this.cdr.detectChanges();
  }

  seleccionarMovimiento(tipo: 'entrada' | 'salida'): void {
    this.tipoMovimiento         = tipo;
    this.movimientoModalVisible = false;
    this.cdr.detectChanges();
    this.solicitarGeoYGenerar();
  }

  cancelarMovimiento(): void {
    this.movimientoModalVisible = false;
    this.cdr.detectChanges();
  }

  // ── Paso 6: geolocalización → QR ─────────────────────────────────────────

  private solicitarGeoYGenerar(): void {
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
          console.warn('Geo no disponible:', err.message);
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
    this.qrVisible   = false;
    this.qrDataUrl   = '';
    this.qrGenerando = false;
    this.geoError    = '';
    this.geoSolicitando = false;
    clearInterval(this.countdownInterval);
    this.countdown    = 45;
    this.timerPercent = 100;
    this.cdr.detectChanges();
  }

  private generarQR(latitud?: number, longitud?: number): void {
    if (!this.credencial) return;
    // Pasa tipoMovimiento al servicio
    this.qrService.generarToken(
      this.credencial.id, latitud, longitud, this.tipoMovimiento
    ).subscribe({
      next: (data) => {
        this.ngZone.run(() => {
          const encoded    = encodeURIComponent(data.token);
          this.qrDataUrl   = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encoded}&bgcolor=ffffff&color=4D0F60&margin=10`;
          this.qrGenerando = false;
          this.cdr.detectChanges();
        });
      },
      error: (err) => {
        this.ngZone.run(() => {
          this.qrGenerando = false;
          this.qrVisible   = false;
          clearInterval(this.countdownInterval);
          this.countdown    = 45;
          this.timerPercent = 100;
          this.geoError     = err.error?.message ?? 'No se pudo generar el código QR.';
          this.cdr.detectChanges();
        });
      },
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
          const regen = (lat?: number, lng?: number) => {
            this.generarQR(lat, lng);
            this.iniciarCountdown();
          };
          if (!navigator.geolocation) { regen(); return; }
          navigator.geolocation.getCurrentPosition(
            (pos) => this.ngZone.run(() => regen(pos.coords.latitude, pos.coords.longitude)),
            ()    => this.ngZone.run(() => regen()),
            { timeout: 8000, maximumAge: 60000, enableHighAccuracy: false }
          );
        }
        this.cdr.detectChanges();
      });
    }, 1000);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private limpiarCamaraFacial(): void {
    this.faceScanning = false;
    if (this.scanLineInterval) { clearInterval(this.scanLineInterval); this.scanLineInterval = null; }
    this.faceStream?.getTracks().forEach(t => t.stop());
    this.faceStream = null;
    const video = this.faceVideoRef?.nativeElement;
    if (video) video.srcObject = null;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getIniciales(n: string): string {
    return n.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
  }
  getIcon(tipo: string): string { return TIPO_ICON[tipo] ?? '📍'; }
  getNivelColor(nivel: string): string {
    return ({ abierto: '#2e7d32', restringido: '#e65100', exclusivo: '#A93845' } as any)[nivel] ?? '#4A4D56';
  }
  formatFecha(fecha: string): string {
    return new Date(fecha).toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });
  }
  formatFechaCorta(fecha: string): string {
    return new Date(fecha).toLocaleDateString('es-MX', { month: '2-digit', year: '2-digit' });
  }
}