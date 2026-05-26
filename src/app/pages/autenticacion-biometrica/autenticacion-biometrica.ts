// src/app/pages/autenticacion-biometrica/autenticacion-biometrica.ts
import {
  Component, OnInit, OnDestroy,
  ChangeDetectorRef, ViewChild, ElementRef,
  NgZone
} from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BiometricaService } from '../../services/biometrica.service';
import { Auth } from '../../services/auth';

type Pantalla = 'intro' | 'correo' | 'camara' | 'exito' | 'error';
type Fase = 'centro' | 'derecha' | 'izquierda' | 'arriba' | 'abajo' | 'completado';

const INSTRUCCIONES: Record<Fase, string> = {
  centro:     'Centra tu cara en el círculo',
  derecha:    'Mueve tu cabeza hacia la derecha ›',
  izquierda:  '‹ Ahora hacia la izquierda',
  arriba:     '↑ Inclina la cabeza hacia arriba',
  abajo:      '↓ Inclina la cabeza hacia abajo',
  completado: '✓ Procesando...',
};

const FASES: Fase[] = ['centro', 'derecha', 'izquierda', 'arriba', 'abajo', 'completado'];
const TOTAL_TICKS   = 48;
const INTRO_TICKS   = 60;

@Component({
  selector: 'app-autenticacion-biometrica',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './autenticacion-biometrica.html',
  styleUrl:    './autenticacion-biometrica.scss',
})
export class AutenticacionBiometrica implements OnInit, OnDestroy {

  @ViewChild('videoRef')  videoRef!:  ElementRef<HTMLVideoElement>;
  @ViewChild('canvasRef') canvasRef!: ElementRef<HTMLCanvasElement>;

  // ── UI ────────────────────────────────────────────────────────────────────
  pantalla: Pantalla    = 'intro';
  errorMensaje          = '';
  errorCamara           = '';
  instruccionActual     = INSTRUCCIONES['centro'];
  instrCambiando        = false;
  escaneando            = false;

  correoLogin = '';
  correoError = '';

  readonly ticksArray   = Array(INTRO_TICKS).fill(0);
  readonly ticksArray48 = Array(TOTAL_TICKS).fill(0);
  readonly tickAngle    = (2 * Math.PI) / INTRO_TICKS;
  readonly tick48Angle  = (2 * Math.PI) / TOTAL_TICKS;
  readonly Math         = Math;

  ticksVerdes = 0;
  scanLineY   = 60;

  // ── Pose ──────────────────────────────────────────────────────────────────
  private fasesCompletadas: Set<Fase> = new Set();
  private faseActual: Fase = 'centro';
  private faseIndex        = 0;
  private readonly TICKS_POR_FASE = Math.floor(TOTAL_TICKS / (FASES.length - 1));

  // Buffer suavizado: últimos N frames
  private detBuffer: Array<{ yaw: number; pitch: number }> = [];
  private readonly BUFFER_SIZE = 6;   // menos frames → más ágil

  // Cuántos frames CONSECUTIVOS en posición para dar fase por buena
  // A 80ms × 9 frames = ~720ms — razonable sin ser tedioso
  private posicionEstable      = 0;
  private readonly FRAMES_ESTABLES = 9;

  // ── Umbrales (grados)
  // YAW: positivo = gira derecha (desde la cámara), negativo = gira izquierda
  // PITCH: positivo = mira abajo, negativo = mira arriba
  //
  // Los valores se calibraron para que:
  //   • Centro:    |yaw| < 14  y  |pitch| < 12
  //   • Derecha/Izquierda: |yaw| > 18  (giro claro)
  //   • Arriba:    pitch < -10  (barbilla sube, nariz baja en imagen)
  //   • Abajo:     pitch >  10  (barbilla baja, nariz sube)
  private readonly UMBRAL_YAW_CENTRO   = 14;
  private readonly UMBRAL_PITCH_CENTRO = 12;
  private readonly UMBRAL_YAW_LADO     = 18;  // necesita giro más pronunciado
  private readonly UMBRAL_PITCH_ARRIBA = -10; // pitch negativo = mira arriba
  private readonly UMBRAL_PITCH_ABAJO  =  10; // pitch positivo = mira abajo

  // ── Infra ──────────────────────────────────────────────────────────────────
  private stream:            MediaStream | null = null;
  private faceApiLoaded      = false;
  private detectionInterval: any = null;
  private scanLineInterval:  any = null;
  private timers:            any[] = [];

  private descriptoresCapturados: number[][] = [];

  // ← protected para que el template acceda
  protected modo: 'registro' | 'login' = 'registro';

  constructor(
    private router: Router,
    private route:  ActivatedRoute,
    private bio:    BiometricaService,
    private cdr:    ChangeDetectorRef,
    private zone:   NgZone,
  ) {}

  // ── Ciclo de vida ─────────────────────────────────────────────────────────

  ngOnInit(): void {
    const qModo = this.route.snapshot.queryParamMap.get('modo');
    if (qModo === 'login') {
      this.modo = 'login';
      const qCorreo = this.route.snapshot.queryParamMap.get('correo');
      if (qCorreo) {
        this.correoLogin = qCorreo;
        this.pantalla    = 'intro';
      } else {
        this.pantalla = 'correo';
      }
    } else {
      this.modo     = 'registro';
      this.pantalla = 'intro';
    }
  }

  ngOnDestroy(): void { this.limpiar(); }

  // ── Ticks de color ────────────────────────────────────────────────────────

  tickColor(i: number): string {
    if (i < this.ticksVerdes)      return '#34C759';
    if (i === this.ticksVerdes)    return '#FFFFFF';
    return 'rgba(255,255,255,0.25)';
  }

  // ── Pantalla correo ───────────────────────────────────────────────────────

  validarCorreoLogin(): boolean {
    const re = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
    if (!this.correoLogin.trim()) {
      this.correoError = 'El correo es obligatorio.';
      return false;
    }
    if (!re.test(this.correoLogin.trim())) {
      this.correoError = 'Ingresa un correo válido.';
      return false;
    }
    this.correoError = '';
    return true;
  }

  continuarConCorreo(): void {
    if (!this.validarCorreoLogin()) return;
    this.pantalla = 'intro';
    this.cdr.detectChanges();
  }

  // ── Pantalla intro ────────────────────────────────────────────────────────

  async empezar(): Promise<void> {
    this.pantalla = 'camara';
    this.cdr.detectChanges();
    await this.delay(120);
    await this.cargarFaceApi();
    await this.iniciarCamara();
  }

  cancelar(): void {
    this.limpiar();
    this.router.navigate([this.modo === 'registro' ? '/configuracion' : '/login']);
  }

  reintentar(): void {
    this.errorCamara  = '';
    this.errorMensaje = '';
    this.ticksVerdes  = 0;
    this.faseIndex    = 0;
    this.faseActual   = 'centro';
    this.fasesCompletadas.clear();
    this.posicionEstable         = 0;
    this.detBuffer               = [];
    this.descriptoresCapturados  = [];
    this.pantalla                = 'intro';
    this.cdr.detectChanges();
  }

  // ── Carga de face-api ─────────────────────────────────────────────────────

  private cargarFaceApi(): Promise<void> {
    if (this.faceApiLoaded || (window as any).faceapi) {
      this.faceApiLoaded = true;
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      const script  = document.createElement('script');
      script.src    = 'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js';
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

  // ── Cámara ────────────────────────────────────────────────────────────────

  private async iniciarCamara(): Promise<void> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
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
        ? 'Permiso de cámara denegado. Actívalo en los ajustes.'
        : 'No se pudo acceder a la cámara.';
      this.mostrarErrorCamara(msg);
    }
  }

  private mostrarErrorCamara(msg: string): void {
    this.errorCamara = msg;
    this.escaneando  = false;
    this.cdr.detectChanges();
  }

  private iniciarScanLine(): void {
    let dir = 1, posY = 50;
    this.scanLineInterval = setInterval(() => {
      posY += dir * 3;
      if (posY > 300) dir = -1;
      if (posY < 50)  dir = 1;
      this.scanLineY = posY;
      this.cdr.detectChanges();
    }, 35);
  }

  // ── Detección ─────────────────────────────────────────────────────────────

  private iniciarDeteccion(): void {
    const faceapi = (window as any).faceapi;
    const video   = this.videoRef?.nativeElement;
    if (!video || !faceapi) return;

    const opciones = new faceapi.TinyFaceDetectorOptions({
      inputSize:       320,
      scoreThreshold:  0.45,   // un poco más permisivo para mejorar detección
    });

    this.detectionInterval = setInterval(async () => {
      if (this.pantalla !== 'camara') return;

      try {
        const deteccion = await faceapi
          .detectSingleFace(video, opciones)
          .withFaceLandmarks(true)
          .withFaceDescriptor();

        if (!deteccion) {
          // Cara no detectada — resetear estabilidad suavemente
          this.posicionEstable = Math.max(0, this.posicionEstable - 1);
          return;
        }

        const { yaw, pitch } = this.estimarPose(deteccion.landmarks);

        // Buffer deslizante para suavizar ruido
        this.detBuffer.push({ yaw, pitch });
        if (this.detBuffer.length > this.BUFFER_SIZE) this.detBuffer.shift();

        const promedioYaw   = this.detBuffer.reduce((s, d) => s + d.yaw,   0) / this.detBuffer.length;
        const promedioPitch = this.detBuffer.reduce((s, d) => s + d.pitch, 0) / this.detBuffer.length;

        const descriptorFrame = Array.from(deteccion.descriptor as Float32Array) as number[];

        this.zone.run(() => this.evaluarPose(promedioYaw, promedioPitch, descriptorFrame));

      } catch { /* ignorar frames con error */ }

    }, 80);
  }

  // ── Estimación de pose ────────────────────────────────────────────────────
  //
  // YAW  (giro horizontal):
  //   Usamos la distancia nariz→ojo izquierdo vs nariz→ojo derecho.
  //   Cuando giras a la derecha, el ojo derecho queda más cerca de la nariz
  //   → (distNoseLeft - distNoseRight) > 0  → yaw positivo
  //
  // PITCH (inclinación vertical):
  //   Usamos la relación entre la distancia ojos→nariz y ojos→barbilla.
  //   Cuando inclinas hacia abajo la barbilla baja → más espacio ojos→nariz
  //   que ojos→barbilla → pitch positivo.
  //   Cuando inclinas hacia arriba ocurre lo opuesto → pitch negativo.
  //
  private estimarPose(landmarks: any): { yaw: number; pitch: number } {
    const pts = landmarks.positions as Array<{ x: number; y: number }>;

    // Puntos clave
    const leftEye  = this.centroide(pts.slice(36, 42));  // ojo izquierdo
    const rightEye = this.centroide(pts.slice(42, 48));  // ojo derecho
    const nose     = pts[30];                             // punta de nariz
    const chin     = pts[8];                              // barbilla

    // ── YAW ──────────────────────────────────────────────────────────────────
    const totalEyes     = Math.abs(rightEye.x - leftEye.x) || 1;
    const distNoseLeft  = nose.x - leftEye.x;
    const distNoseRight = rightEye.x - nose.x;
    // Normalizado por la distancia entre ojos y escalado a grados aproximados
    const yaw = ((distNoseLeft - distNoseRight) / totalEyes) * 55;

    // ── PITCH ─────────────────────────────────────────────────────────────────
    // Centro ocular: promedio vertical de ambos ojos
    const eyeCenterY = (leftEye.y + rightEye.y) / 2;

    // Distancias verticales
    const eyeToNose = nose.y  - eyeCenterY;  // siempre positivo (nariz más baja)
    const eyeToChin = chin.y  - eyeCenterY;  // siempre positivo (barbilla aún más baja)

    // Ratio: cuánto de la cara (ojos→barbilla) ocupa el tramo ojos→nariz
    // Cara frontal:  ratio ≈ 0.45–0.50
    // Mira abajo:    la nariz SE ALEJA del centro → ratio SUBE (>0.5)
    // Mira arriba:   la nariz SE ACERCA → ratio BAJA (<0.42)
    const ratio = eyeToNose / (eyeToChin || 1);

    // Centrado en 0.46 (valor empírico frontal) y escalado a grados
    const pitch = (ratio - 0.46) * 120;

    return { yaw, pitch };
  }

  private centroide(pts: Array<{ x: number; y: number }>): { x: number; y: number } {
    return {
      x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
      y: pts.reduce((s, p) => s + p.y, 0) / pts.length,
    };
  }

  // ── Evaluación de pose ────────────────────────────────────────────────────

  private evaluarPose(yaw: number, pitch: number, descriptor: number[]): void {
    if (this.faseActual === 'completado') return;

    const enPosicion = this.estaEnPosicion(this.faseActual, yaw, pitch);

    if (enPosicion) {
      this.posicionEstable++;

      const ticksBase  = this.faseIndex * this.TICKS_POR_FASE;
      const progreso   = Math.min(this.posicionEstable / this.FRAMES_ESTABLES, 1);
      const ticksExtra = Math.round(progreso * this.TICKS_POR_FASE);
      this.ticksVerdes = Math.min(TOTAL_TICKS, ticksBase + ticksExtra);
      this.cdr.detectChanges();

      if (this.posicionEstable >= this.FRAMES_ESTABLES) {
        this.descriptoresCapturados.push(descriptor);
        this.completarFase();
      }
    } else {
      // Suavizar caída: no resetear de golpe
      this.posicionEstable = Math.max(0, this.posicionEstable - 2);
    }
  }

  private estaEnPosicion(fase: Fase, yaw: number, pitch: number): boolean {
    switch (fase) {
      case 'centro':
        return Math.abs(yaw) < this.UMBRAL_YAW_CENTRO &&
               Math.abs(pitch) < this.UMBRAL_PITCH_CENTRO;

      case 'derecha':
        // Desde la perspectiva del usuario: girar a su derecha
        // Sin espejo → landmarks van en la misma dirección que el giro real
        return yaw > this.UMBRAL_YAW_LADO;

      case 'izquierda':
        return yaw < -this.UMBRAL_YAW_LADO;

      case 'arriba':
        // Barbilla sube → nariz se acerca a los ojos → pitch negativo
        return pitch < this.UMBRAL_PITCH_ARRIBA;

      case 'abajo':
        // Barbilla baja → nariz se aleja de los ojos → pitch positivo
        return pitch > this.UMBRAL_PITCH_ABAJO;

      default:
        return false;
    }
  }

  // ── Fases ─────────────────────────────────────────────────────────────────

  private completarFase(): void {
    this.fasesCompletadas.add(this.faseActual);
    this.posicionEstable = 0;
    this.faseIndex++;

    this.ticksVerdes = Math.min(TOTAL_TICKS, this.faseIndex * this.TICKS_POR_FASE);
    this.cdr.detectChanges();

    const siguienteFase = FASES[this.faseIndex] as Fase;

    if (!siguienteFase || siguienteFase === 'completado') {
      this.faseActual  = 'completado';
      this.ticksVerdes = TOTAL_TICKS;
      this.cambiarInstruccion('completado');
      this.cdr.detectChanges();
      this.finalizarEscaneo();
    } else {
      this.faseActual = siguienteFase;
      this.cambiarInstruccion(siguienteFase);
    }
  }

  // ── Descriptor promedio ───────────────────────────────────────────────────

  private calcularDescriptorPromedio(): number[] {
    if (this.descriptoresCapturados.length === 0) return [];
    const len      = this.descriptoresCapturados[0].length; // 128
    const promedio = new Array(len).fill(0);
    for (const desc of this.descriptoresCapturados) {
      for (let i = 0; i < len; i++) promedio[i] += desc[i];
    }
    for (let i = 0; i < len; i++) {
      promedio[i] /= this.descriptoresCapturados.length;
    }
    return promedio;
  }

  // ── Finalizar ─────────────────────────────────────────────────────────────

  private finalizarEscaneo(): void {
    if (this.detectionInterval) { clearInterval(this.detectionInterval); this.detectionInterval = null; }
    if (this.scanLineInterval)  { clearInterval(this.scanLineInterval);  this.scanLineInterval  = null; }

    const t = setTimeout(() => {
      this.detenerCamara();
      this.enviarDescriptor();
    }, 800);
    this.timers.push(t);
  }

  private enviarDescriptor(): void {
    const descriptor = this.calcularDescriptorPromedio();

    if (descriptor.length !== 128) {
      this.pantalla     = 'error';
      this.errorMensaje = 'No se pudo extraer el descriptor facial. Inténtalo de nuevo.';
      this.cdr.detectChanges();
      return;
    }

    if (this.modo === 'registro') {
      this.bio.registrar(descriptor).subscribe({
        next: () => {
          this.pantalla = 'exito';
          this.cdr.detectChanges();
          const t = setTimeout(() => this.router.navigate(['/configuracion']), 2200);
          this.timers.push(t);
        },
        error: (err) => {
          this.pantalla     = 'error';
          this.errorMensaje = err?.error?.message ?? 'No se pudo registrar la biometría.';
          this.cdr.detectChanges();
        },
      });
    } else {
      const correo = this.correoLogin.trim().toLowerCase();
      this.bio.loginFacial(correo, descriptor).subscribe({
        next: (res) => {
          Auth.setToken(res.token);
          Auth.setRol(res.rol);
          this.pantalla = 'exito';
          this.cdr.detectChanges();
          const t = setTimeout(() => this.router.navigate(['/dashboard'], { replaceUrl: true }), 1500);
          this.timers.push(t);
        },
        error: (err) => {
          this.pantalla     = 'error';
          this.errorMensaje = err?.error?.message
            ?? 'El rostro no coincide. Inténtalo de nuevo o usa tu contraseña.';
          this.cdr.detectChanges();
        },
      });
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

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