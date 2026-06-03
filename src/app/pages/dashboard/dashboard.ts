import { Component, OnInit, OnDestroy, ChangeDetectorRef, NgZone, ViewChild, ElementRef } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { CommonModule, Location } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Auth } from '../../services/auth';
import { QrService } from '../../services/qr';
import { BiometricaService } from '../../services/biometrica.service';
import { environment } from '../../../environments/environment';

interface Credencial {
  id: number;
  tipo_usuario: string;
  numero_id: string;
  activa: boolean;
  estado: string;
  creado_en: string;
  institucion_nombre: string;
  institucion_tipo: string;
  ciudad: string;
  estado_inst: string;
  punto_nombre: string;
  punto_tipo: string;
  nivel_acceso: string;
}

interface Acceso {
  id:                 number;
  exitoso:            boolean;
  creado_en:          string;
  punto_nombre:       string;
  institucion_nombre: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.scss'],
})
export class Dashboard implements OnInit, OnDestroy {

  @ViewChild('faceVideoRef')  faceVideoRef!:  ElementRef<HTMLVideoElement>;
  @ViewChild('faceCanvasRef') faceCanvasRef!: ElementRef<HTMLCanvasElement>;

  private apiBase = environment.apiUrl;

  nombreUsuario  = '';
  cargandoNombre = true;
  credenciales: Credencial[] = [];
  cargandoCreds  = true;
  ultimosAccesos:    Acceso[] = [];
  cargandoHistorial = true;

  get credencialesActivas(): Credencial[] {
    return this.credenciales.filter((c) => c.activa && c.estado === 'activa');
  }

  // QR
  credencialQR: Credencial | null = null;
  qrVisible      = false;
  qrDataUrl      = '';
  qrGenerando    = false;
  countdown      = 45;
  timerPercent   = 100;
  geoError       = '';
  geoSolicitando = false;

  movimientoModalVisible           = false;
  tipoMovimiento: 'entrada' | 'salida' = 'entrada';

  faceModalVisible  = false;
  faceScanning      = false;
  faceProcessing    = false;
  faceError         = '';
  faceScanLineY     = 60;
  bioError          = '';
  bioVerificando    = false;

  private faceStream:   MediaStream | null = null;
  private faceInterval: any = null;
  private scanLineInterval: any = null;
  private faceApiLoaded = false;
  private pendingCredForQR: Credencial | null = null;

  activeCardIndex = 0;
  carouselOffset  = 0;

  private touchStartX  = 0;
  private touchStartY  = 0;
  private mouseStartX  = 0;
  private isDragging   = false;
  private dragDeltaX   = 0;

  private countdownInterval: any;
  private timers: any[] = [];

  // ✅ Suscripción al botón atrás
  private unlistenBack!: () => void;

  constructor(
    private auth:      Auth,
    private http:      HttpClient,
    private router:    Router,
    private location:  Location,
    private cdr:       ChangeDetectorRef,
    private ngZone:    NgZone,
    private qrService: QrService,
    private bioService: BiometricaService,
  ) {}

  private get headers(): HttpHeaders {
    const token = localStorage.getItem('token') ?? '';
    return new HttpHeaders({
      'Authorization':  `Bearer ${token}`,
      'Cache-Control':  'no-cache, no-store, must-revalidate',
      'Pragma':         'no-cache',
      'Expires':        '0',
    });
  }

  ngOnInit(): void {
    // ✅ Bloquear botón atrás: empujar un estado para tener algo que consumir
    history.pushState(null, '', location.href);
    this.unlistenBack = this.location.subscribe(() => {
      history.pushState(null, '', location.href);
    }) as unknown as () => void;

    const token = localStorage.getItem('token');
    if (!token) { this.router.navigate(['/login'], { replaceUrl: true }); return; }

    this.auth.obtenerInformacion().subscribe({
      next: (info) => {
        this.ngZone.run(() => {
          this.nombreUsuario  = `${info.nombre} ${info.apellido_paterno}`;
          this.cargandoNombre = false;
          this.cdr.detectChanges();
        });
      },
      error: (err) => {
        this.ngZone.run(() => {
          this.cargandoNombre = false;
          if (err.status === 401 || err.status === 403) {
            localStorage.removeItem('token');
            this.router.navigate(['/login'], { replaceUrl: true });
          } else {
            this.nombreUsuario = 'Usuario';
          }
          this.cdr.detectChanges();
        });
      },
    });

    this.http
      .get<Credencial[]>(`${this.apiBase}/credenciales?t=${Date.now()}`, { headers: this.headers })
      .subscribe({
        next: (data) => {
          this.ngZone.run(() => {
            this.credenciales    = data;
            this.cargandoCreds   = false;
            this.activeCardIndex = 0;
            this.updateCarouselOffset();
            this.cdr.detectChanges();
          });
        },
        error: (err) => {
          this.ngZone.run(() => {
            this.cargandoCreds = false;
            if (err.status === 401 || err.status === 403) {
              localStorage.removeItem('token');
              this.router.navigate(['/login'], { replaceUrl: true });
            }
            this.cdr.detectChanges();
          });
        },
      });

    this.http
      .get<Acceso[]>(`${this.apiBase}/historial?t=${Date.now()}`, { headers: this.headers })
      .subscribe({
        next: (data) => {
          this.ngZone.run(() => {
            this.ultimosAccesos    = data.slice(0, 5);
            this.cargandoHistorial = false;
            this.cdr.detectChanges();
          });
        },
        error: () => {
          this.ngZone.run(() => {
            this.cargandoHistorial = false;
            this.cdr.detectChanges();
          });
        },
      });
  }

  ngOnDestroy(): void {
    clearInterval(this.countdownInterval);
    this.limpiarCamaraFacial();
    this.timers.forEach(t => clearTimeout(t));
    // ✅ Limpiar suscripción al botón atrás
    if (this.unlistenBack) this.unlistenBack();
  }

  // ── Carrusel ──────────────────────────────────────────────────────────────

  readonly CARD_GAP = 16;

  updateCarouselOffset(): void {
    const viewport = document.querySelector('.carousel-viewport') as HTMLElement;
    const cardWidth = viewport ? viewport.offsetWidth : 0;
    this.carouselOffset = -(this.activeCardIndex * (cardWidth + this.CARD_GAP));
  }

  setActiveCard(index: number): void {
    this.activeCardIndex = index;
    this.updateCarouselOffset();
    this.cdr.detectChanges();
  }

  prevCard(): void { if (this.activeCardIndex > 0) this.setActiveCard(this.activeCardIndex - 1); }
  nextCard(): void { if (this.activeCardIndex < this.credencialesActivas.length - 1) this.setActiveCard(this.activeCardIndex + 1); }

  onTouchStart(e: TouchEvent): void { this.touchStartX = e.touches[0].clientX; this.touchStartY = e.touches[0].clientY; }
  onTouchEnd(e: TouchEvent): void {
    const dx = this.touchStartX - e.changedTouches[0].clientX;
    const dy = this.touchStartY - e.changedTouches[0].clientY;
    if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return;
    dx > 0 ? this.nextCard() : this.prevCard();
  }
  onMouseDown(e: MouseEvent): void { this.mouseStartX = e.clientX; this.isDragging = true; this.dragDeltaX = 0; }
  onMouseMove(e: MouseEvent): void { if (!this.isDragging) return; this.dragDeltaX = this.mouseStartX - e.clientX; }
  onMouseUp(e: MouseEvent): void {
    if (!this.isDragging) return;
    this.isDragging = false;
    const d = this.mouseStartX - e.clientX;
    if (Math.abs(d) < 40) return;
    d > 0 ? this.nextCard() : this.prevCard();
    this.dragDeltaX = 0;
  }
  onMouseLeave(): void { if (this.isDragging) { this.isDragging = false; this.dragDeltaX = 0; } }

  get trackTransform(): string {
    const base = this.carouselOffset;
    const drag = this.isDragging ? -this.dragDeltaX * 0.35 : 0;
    return `translateX(${base + drag}px)`;
  }

  getCardClass(index: number): string {
    const d = index - this.activeCardIndex;
    if (d === 0)             return 'is-active';
    if (d === -1 || d === 1) return 'is-adjacent';
    return 'is-far';
  }

  // ── Navegación ────────────────────────────────────────────────────────────

  irAHistorial(): void { this.router.navigate(['/historial']); }
  irAConfiguracion(): void { this.router.navigate(['/configuracion']); }
  verDetalleAcceso(id: number): void { this.router.navigate(['/detalle-acceso', id]); }

  // ── Geo helpers ───────────────────────────────────────────────────────────

  cancelarGeo(): void { this.geoSolicitando = false; this.credencialQR = null; this.cdr.detectChanges(); }
  cerrarGeoError(): void { this.geoError = ''; this.cdr.detectChanges(); }
  reintentarQR(): void { if (this.credencialQR) { this.geoError = ''; this.mostrarQR(this.credencialQR); } }
  cerrarBioError(): void { this.bioError = ''; this.cdr.detectChanges(); }

  mostrarQR(cred: Credencial): void {
    if (this.qrGenerando || this.faceScanning) return;
    this.pendingCredForQR = cred;
    this.credencialQR     = cred;
    this.bioError         = '';
    this.geoError         = '';
    this.abrirModalFacial();
  }

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
    this.pendingCredForQR = null;
    this.credencialQR     = null;
    this.cdr.detectChanges();
  }

  reintentarFacial(): void {
    this.faceError = '';
    this.abrirModalFacial();
  }

  private cargarFaceApi(): Promise<void> {
    if (this.faceApiLoaded || (window as any).faceapi) {
      this.faceApiLoaded = true;
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js';
      script.onload = async () => {
        this.faceApiLoaded = true;
        await this.cargarModelos();
        resolve();
      };
      script.onerror = () => reject(new Error('No se pudo cargar face-api.js'));
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
      this.iniciarScanLineFacial();
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

  private iniciarScanLineFacial(): void {
    let dir = 1, posY = 50;
    this.scanLineInterval = setInterval(() => {
      posY += dir * 4;
      if (posY > 220) dir = -1;
      if (posY < 50)  dir = 1;
      this.faceScanLineY = posY;
      this.cdr.detectChanges();
    }, 35);
  }

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

  private enviarVerificacion(descriptor: number[]): void {
    this.faceProcessing = true;
    this.cdr.detectChanges();

    this.bioService.verificar(descriptor).subscribe({
      next: () => {
        this.ngZone.run(() => {
          this.faceProcessing   = false;
          this.faceModalVisible = false;
          this.cdr.detectChanges();
          this.mostrarModalMovimiento();
        });
      },
      error: (err: any) => {
        this.ngZone.run(() => {
          this.faceProcessing = false;
          const msg = err?.error?.message ?? err?.message ?? '';
          if (err?.error?.sin_biometrica || msg.toLowerCase().includes('no tienes biometría') || msg.toLowerCase().includes('sin_biometrica')) {
            this.faceError = 'No tienes biometría registrada. Actívala en Configuración para usar esta función.';
          } else if (msg.toLowerCase().includes('no coincide') || msg.toLowerCase().includes('no match') || err?.status === 401) {
            this.faceError = 'El rostro no coincide con el titular de la cuenta. Acceso denegado.';
          } else {
            this.faceError = msg || 'No se pudo verificar tu identidad.';
          }
          this.cdr.detectChanges();
        });
      },
    });
  }

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
      (error) => {
        this.ngZone.run(() => {
          this.geoSolicitando = false;
          console.warn('Geo no disponible:', error.message);
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
    this.credencialQR   = null;
    clearInterval(this.countdownInterval);
    this.countdown    = 45;
    this.timerPercent = 100;
    this.cdr.detectChanges();
  }

  private generarQR(latitud?: number, longitud?: number): void {
    if (!this.credencialQR) return;

    this.qrService.generarToken(this.credencialQR.id, latitud, longitud, this.tipoMovimiento).subscribe({
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
          this.qrGenerando  = false;
          this.qrVisible    = false;
          clearInterval(this.countdownInterval);
          this.countdown    = 45;
          this.timerPercent = 100;
          this.geoError = err.error?.message ?? 'No se pudo generar el código QR.';
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

  private limpiarCamaraFacial(): void {
    this.faceScanning = false;
    if (this.faceInterval)    { clearInterval(this.faceInterval);    this.faceInterval    = null; }
    if (this.scanLineInterval){ clearInterval(this.scanLineInterval); this.scanLineInterval = null; }
    this.faceStream?.getTracks().forEach(t => t.stop());
    this.faceStream = null;
    const video = this.faceVideoRef?.nativeElement;
    if (video) video.srcObject = null;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getIniciales(n: string): string {
    return n.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  }

  getNivelColor(nivel: string): string {
    return ({ abierto: '#2e7d32', restringido: '#e65100', exclusivo: '#A93845' } as any)[nivel] ?? '#fff';
  }

  formatFechaCorta(fecha: string): string {
    return new Date(fecha).toLocaleDateString('es-MX', { month: '2-digit', year: '2-digit' });
  }
}