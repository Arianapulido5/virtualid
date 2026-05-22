// src/app/pages/autenticacion-biometrica/autenticacion-biometrica.ts
// Reemplaza el contenido completo de este archivo
//
// Flujo:
//  1. Pantalla "intro" — igual a imagen 1
//  2. Al pulsar "Empezar" → pide cámara + carga face-api.js (CDN)
//  3. Pantalla "camara" — igual a imagen 2
//     • Detecta movimientos de cabeza (izquierda, derecha, arriba, abajo, centro)
//     • Los ticks del borde se ponen verdes conforme progresa
//     • Al llegar al 100% → llama al backend WebAuthn (bio.registrar())
//  4. Pantalla "exito" o "error"

import {
  Component, OnInit, OnDestroy,
  ChangeDetectorRef, ViewChild, ElementRef,
  NgZone
} from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { BiometricaService } from '../../services/biometrica.service';

// Tipos de pantalla
type Pantalla = 'intro' | 'camara' | 'exito' | 'error';

// Fases de movimiento que el usuario debe completar
type Fase =
  | 'centro'
  | 'derecha'
  | 'izquierda'
  | 'arriba'
  | 'abajo'
  | 'completado';

// Instrucciones por fase
const INSTRUCCIONES: Record<Fase, string> = {
  centro:     'Centra tu cara en el círculo',
  derecha:    'Mueve tu cabeza hacia la derecha ›',
  izquierda:  '‹ Ahora hacia la izquierda',
  arriba:     '↑ Inclina la cabeza hacia arriba',
  abajo:      '↓ Inclina hacia abajo',
  completado: '✓ Procesando...',
};

// Orden de fases
const FASES: Fase[] = ['centro', 'derecha', 'izquierda', 'arriba', 'abajo', 'completado'];

// Ticks totales en el borde del círculo de la cámara
const TOTAL_TICKS = 48;
// Ticks del intro
const INTRO_TICKS = 60;

@Component({
  selector: 'app-autenticacion-biometrica',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './autenticacion-biometrica.html',
  styleUrl:  './autenticacion-biometrica.scss',
})
export class AutenticacionBiometrica implements OnInit, OnDestroy {

  @ViewChild('videoRef')  videoRef!:  ElementRef<HTMLVideoElement>;
  @ViewChild('canvasRef') canvasRef!: ElementRef<HTMLCanvasElement>;

  // ── Estado UI ───────────────────────────────────────────────────────────────
  pantalla: Pantalla = 'intro';
  errorMensaje = '';
  errorCamara  = '';
  instruccionActual = INSTRUCCIONES['centro'];
  instrCambiando    = false;
  escaneando        = false;

  // ── Arrays para template ────────────────────────────────────────────────────
  readonly ticksArray    = Array(INTRO_TICKS).fill(0);   // intro
  readonly ticksArray48  = Array(TOTAL_TICKS).fill(0);   // cámara
  readonly tickAngle     = (2 * Math.PI) / INTRO_TICKS;
  readonly tick48Angle   = (2 * Math.PI) / TOTAL_TICKS;
  readonly Math          = Math;  // para usarlo en template

  // ── Progreso del círculo ────────────────────────────────────────────────────
  // Cuántos ticks están en verde (de 0 a 48)
  ticksVerdes = 0;

  // Fases completadas (para calcular progreso por secciones)
  private fasesCompletadas: Set<Fase> = new Set();
  private faseActual: Fase = 'centro';
  private faseIndex = 0;

  // Ticks verdes por fase completada: 48 ticks / 5 fases = ~9.6 → usamos distribución exacta
  private readonly TICKS_POR_FASE = Math.floor(TOTAL_TICKS / (FASES.length - 1)); // 9

  // ── Línea de escaneo ────────────────────────────────────────────────────────
  scanLineY = 60;

  // ── Stream / timers ─────────────────────────────────────────────────────────
  private stream: MediaStream | null = null;
  private faceApiLoaded = false;
  private detectionInterval: any = null;
  private scanLineInterval: any  = null;
  private timers: any[] = [];

  // ── WebAuthn ─────────────────────────────────────────────────────────────────
  private modo: 'registro' | 'login' = 'registro';
  private correo = '';
  private userId: number | null = null;
  private optsAutenticacion: any = null;

  // ── Umbrales de detección de pose (en grados de yaw/pitch) ──────────────────
  private readonly UMBRAL_YAW   = 12;  // grados para izquierda/derecha
  private readonly UMBRAL_PITCH = 10;  // grados para arriba/abajo

  // ── Buffer de detecciones para estabilidad ───────────────────────────────────
  private detBuffer: Array<{ yaw: number; pitch: number }> = [];
  private readonly BUFFER_SIZE = 8;   // muestras promediadas
  private posicionEstable = 0;        // cuántos frames seguidos en la posición esperada
  private readonly FRAMES_ESTABLES = 12;  // frames necesarios para confirmar una pose

  constructor(
    private router: Router,
    private route:  ActivatedRoute,
    private bio:    BiometricaService,
    private cdr:    ChangeDetectorRef,
    private zone:   NgZone,
  ) {}

  ngOnInit(): void {
    const qModo   = this.route.snapshot.queryParamMap.get('modo');
    const qCorreo = this.route.snapshot.queryParamMap.get('correo');

    if (qModo === 'login' && qCorreo) {
      this.modo   = 'login';
      this.correo = qCorreo;
      this.iniciarLoginBiometrico();
    } else {
      this.modo    = 'registro';
      this.pantalla = 'intro';
    }
  }

  ngOnDestroy(): void {
    this.limpiar();
  }

  // ─── Colores de ticks en la pantalla de cámara ──────────────────────────────
  tickColor(i: number): string {
    if (i < this.ticksVerdes) return '#34C759';          // verde
    if (i === this.ticksVerdes) return '#FFFFFF';        // blanco → frente de progreso
    return 'rgba(255,255,255,0.25)';                     // gris inactivo
  }

  // ─── INTRO ──────────────────────────────────────────────────────────────────

  async empezar(): Promise<void> {
    this.pantalla = 'camara';
    this.cdr.detectChanges();

    // Pequeño delay para que el DOM pinte el <video>
    await this.delay(120);

    await this.cargarFaceApi();
    await this.iniciarCamara();
  }

  cancelar(): void {
    this.limpiar();
    this.router.navigate([this.modo === 'registro' ? '/configuracion' : '/login']);
  }

  reintentar(): void {
    this.errorCamara = '';
    this.errorMensaje = '';
    this.ticksVerdes = 0;
    this.faseIndex = 0;
    this.faseActual = 'centro';
    this.fasesCompletadas.clear();
    this.posicionEstable = 0;
    this.detBuffer = [];
    this.pantalla = 'intro';
    this.cdr.detectChanges();
  }

  // ─── Carga dinámica de face-api.js desde CDN ─────────────────────────────────
  private cargarFaceApi(): Promise<void> {
    if (this.faceApiLoaded || (window as any).faceapi) {
      this.faceApiLoaded = true;
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      // face-api.js minificado desde CDN
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

  // Carga los modelos de face-api.js (tiny_face_detector + face_landmark_68)
  private async cargarModelos(): Promise<void> {
    const faceapi = (window as any).faceapi;
    // Modelo tiny — rápido, funciona en móvil
    const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.13/model';
    try {
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
      ]);
    } catch {
      // Si el CDN anterior falla, intentar con otro espejo
      const MODEL_URL_2 = 'https://justadudewhohacks.github.io/face-api.js/models';
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL_2),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL_2),
      ]);
    }
  }

  // ─── Cámara ──────────────────────────────────────────────────────────────────
  private async iniciarCamara(): Promise<void> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width:  { ideal: 640 },
          height: { ideal: 800 },
        },
        audio: false,
      });

      const video = this.videoRef?.nativeElement;
      if (!video) { this.mostrarErrorCamara('No se encontró el elemento de video.'); return; }

      video.srcObject = this.stream;
      await video.play();

      this.escaneando = true;
      this.iniciarScanLine();
      this.cambiarInstruccion('centro');
      this.iniciarDeteccion();
      this.cdr.detectChanges();

    } catch (err: any) {
      const msg = err?.name === 'NotAllowedError'
        ? 'Permiso de cámara denegado. Actívalo en los ajustes del dispositivo.'
        : 'No se pudo acceder a la cámara. Asegúrate de que no esté en uso.';
      this.mostrarErrorCamara(msg);
    }
  }

  private mostrarErrorCamara(msg: string): void {
    this.errorCamara = msg;
    this.escaneando  = false;
    this.cdr.detectChanges();
  }

  // ─── Animación de la línea de escaneo ────────────────────────────────────────
  private iniciarScanLine(): void {
    let dir   = 1;
    let posY  = 50;
    this.scanLineInterval = setInterval(() => {
      posY += dir * 3;
      if (posY > 300) dir = -1;
      if (posY < 50)  dir = 1;
      this.scanLineY = posY;
      this.cdr.detectChanges();
    }, 35);
  }

  // ─── Detección de cara + pose ─────────────────────────────────────────────────
  private iniciarDeteccion(): void {
    const faceapi = (window as any).faceapi;
    const video   = this.videoRef?.nativeElement;
    const canvas  = this.canvasRef?.nativeElement;
    if (!video || !canvas || !faceapi) return;

    const opciones = new faceapi.TinyFaceDetectorOptions({
      inputSize:   320,
      scoreThreshold: 0.5,
    });

    this.detectionInterval = setInterval(async () => {
      if (this.pantalla !== 'camara') return;

      try {
        const deteccion = await faceapi
          .detectSingleFace(video, opciones)
          .withFaceLandmarks(true);  // true = usa tiny model

        if (!deteccion) {
          // No se detecta cara
          this.posicionEstable = 0;
          return;
        }

        // Estimación de yaw y pitch a partir de landmarks (puntos 2D)
        const { yaw, pitch } = this.estimarPose(deteccion.landmarks);

        // Guardar en buffer para suavizar
        this.detBuffer.push({ yaw, pitch });
        if (this.detBuffer.length > this.BUFFER_SIZE) this.detBuffer.shift();

        const promedioYaw   = this.detBuffer.reduce((s, d) => s + d.yaw, 0)   / this.detBuffer.length;
        const promedioPitch = this.detBuffer.reduce((s, d) => s + d.pitch, 0) / this.detBuffer.length;

        this.zone.run(() => this.evaluarPose(promedioYaw, promedioPitch));

      } catch { /* silencioso si el modelo falla un frame */ }

    }, 80); // ~12 fps
  }

  // ─── Estimación sencilla de pose desde landmarks 2D ───────────────────────────
  // Usa la distancia relativa entre landmarks para inferir yaw y pitch.
  private estimarPose(landmarks: any): { yaw: number; pitch: number } {
    const pts = landmarks.positions as Array<{ x: number; y: number }>;

    // Índices de landmark 68:
    //  0-16  = contorno cara
    //  36-41 = ojo izq,  42-47 = ojo der
    //  27-30 = puente nariz
    //  48-67 = boca
    //  8     = barbilla
    //  27    = inicio nariz

    const leftEye  = this.centroide(pts.slice(36, 42));
    const rightEye = this.centroide(pts.slice(42, 48));
    const nose     = pts[30];  // punta nariz
    const chin     = pts[8];
    const top      = pts[27];  // raíz nariz (entre ojos)

    // Yaw: diferencia normalizada entre distancias nariz-ojo
    const distNoseLeft  = nose.x - leftEye.x;
    const distNoseRight = rightEye.x - nose.x;
    const totalEyes     = rightEye.x - leftEye.x;
    const yawRaw        = (distNoseLeft - distNoseRight) / (totalEyes || 1);
    // Convertir a grados aproximados: ±0.5 de yawRaw ≈ ±30°
    const yaw = yawRaw * 60;

    // Pitch: diferencia vertical normalizada
    const totalHeight   = chin.y - top.y;
    const noseFromTop   = nose.y - top.y;
    const pitchRaw      = (noseFromTop / (totalHeight || 1)) - 0.5; // 0 = centro
    const pitch         = pitchRaw * 80;

    return { yaw, pitch };
  }

  private centroide(pts: Array<{ x: number; y: number }>): { x: number; y: number } {
    const x = pts.reduce((s, p) => s + p.x, 0) / pts.length;
    const y = pts.reduce((s, p) => s + p.y, 0) / pts.length;
    return { x, y };
  }

  // ─── Evaluación de la pose contra la fase actual ───────────────────────────
  private evaluarPose(yaw: number, pitch: number): void {
    if (this.faseActual === 'completado') return;

    const enPosicion = this.estaEnPosicion(this.faseActual, yaw, pitch);

    if (enPosicion) {
      this.posicionEstable++;

      // Progreso visual suave: aumentar ticks proporcionalmente dentro de la fase
      const ticksBase = this.faseIndex * this.TICKS_POR_FASE;
      const ticksExtra = Math.round((this.posicionEstable / this.FRAMES_ESTABLES) * this.TICKS_POR_FASE);
      this.ticksVerdes = Math.min(TOTAL_TICKS, ticksBase + ticksExtra);
      this.cdr.detectChanges();

      if (this.posicionEstable >= this.FRAMES_ESTABLES) {
        this.completarFase();
      }
    } else {
      // Reducir progreso si pierde la posición (pero no retroceder la fase)
      this.posicionEstable = Math.max(0, this.posicionEstable - 2);
    }
  }

  private estaEnPosicion(fase: Fase, yaw: number, pitch: number): boolean {
    switch (fase) {
      case 'centro':
        return Math.abs(yaw) < this.UMBRAL_YAW && Math.abs(pitch) < this.UMBRAL_PITCH;
      case 'derecha':
        return yaw > this.UMBRAL_YAW;
      case 'izquierda':
        return yaw < -this.UMBRAL_YAW;
      case 'arriba':
        return pitch < -this.UMBRAL_PITCH;
      case 'abajo':
        return pitch > this.UMBRAL_PITCH;
      default:
        return false;
    }
  }

  private completarFase(): void {
    this.fasesCompletadas.add(this.faseActual);
    this.posicionEstable = 0;
    this.faseIndex++;

    // Fijar ticks de esta fase completos
    this.ticksVerdes = Math.min(TOTAL_TICKS, this.faseIndex * this.TICKS_POR_FASE);
    this.cdr.detectChanges();

    const siguienteFase = FASES[this.faseIndex] as Fase;

    if (!siguienteFase || siguienteFase === 'completado') {
      this.faseActual = 'completado';
      this.ticksVerdes = TOTAL_TICKS;
      this.cambiarInstruccion('completado');
      this.cdr.detectChanges();
      this.finalizarEscaneo();
    } else {
      this.faseActual = siguienteFase;
      this.cambiarInstruccion(siguienteFase);
    }
  }

  // ─── Cambio animado de instrucción ────────────────────────────────────────
  private cambiarInstruccion(fase: Fase): void {
    this.instrCambiando = true;
    this.cdr.detectChanges();

    const t = setTimeout(() => {
      this.instruccionActual = INSTRUCCIONES[fase];
      this.instrCambiando    = false;
      this.cdr.detectChanges();
    }, 300);

    this.timers.push(t);
  }

  // ─── Finalizar escaneo → llamar WebAuthn ──────────────────────────────────
  private finalizarEscaneo(): void {
    // Detener detección
    if (this.detectionInterval) {
      clearInterval(this.detectionInterval);
      this.detectionInterval = null;
    }
    if (this.scanLineInterval) {
      clearInterval(this.scanLineInterval);
      this.scanLineInterval = null;
    }

    const t = setTimeout(() => {
      this.detenerCamara();
      this.llamarWebAuthn();
    }, 800);

    this.timers.push(t);
  }

  private llamarWebAuthn(): void {
    this.bio.registrar().subscribe({
      next: () => {
        this.pantalla = 'exito';
        this.cdr.detectChanges();

        const t = setTimeout(() => {
          this.router.navigate(['/configuracion']);
        }, 2200);
        this.timers.push(t);
      },
      error: (err) => {
        this.pantalla     = 'error';
        this.errorMensaje = err?.error?.message ?? err?.message
          ?? 'No se pudo registrar la biometría. Inténtalo de nuevo.';
        this.cdr.detectChanges();
      },
    });
  }

  // ─── LOGIN biométrico ──────────────────────────────────────────────────────
  private iniciarLoginBiometrico(): void {
    this.bio.autenticarInicio(this.correo).subscribe({
      next: (opts) => {
        this.userId            = opts.userId;
        this.optsAutenticacion = opts;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.pantalla     = 'error';
        this.errorMensaje = err?.error?.sin_biometrica
          ? 'No tienes biometría registrada en este dispositivo.'
          : (err?.error?.message ?? 'No se pudo iniciar la autenticación.');
        this.cdr.detectChanges();
      },
    });
  }

  autenticarConBiometria(): void {
    if (!this.userId || !this.optsAutenticacion) return;

    this.bio.autenticarFin(this.userId, this.optsAutenticacion).subscribe({
      next: (res) => {
        localStorage.setItem('token', res.token);
        localStorage.setItem('rol',   res.rol);
        this.router.navigate(['/dashboard'], { replaceUrl: true });
      },
      error: (err) => {
        this.pantalla     = 'error';
        this.errorMensaje = err?.error?.message ?? err?.message ?? 'Autenticación fallida.';
        this.cdr.detectChanges();
      },
    });
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────
  private detenerCamara(): void {
    this.stream?.getTracks().forEach(t => t.stop());
    this.stream = null;
    const video = this.videoRef?.nativeElement;
    if (video) video.srcObject = null;
  }

  private limpiar(): void {
    this.detenerCamara();
    if (this.detectionInterval) clearInterval(this.detectionInterval);
    if (this.scanLineInterval)  clearInterval(this.scanLineInterval);
    this.timers.forEach(t => clearTimeout(t));
    this.timers = [];
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}