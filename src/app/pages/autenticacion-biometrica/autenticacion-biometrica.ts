// src/app/pages/autenticacion-biometrica/autenticacion-biometrica.ts
// REEMPLAZA el contenido completo de este archivo

import {
  Component, OnInit, OnDestroy, ChangeDetectorRef,
  ViewChild, ElementRef
} from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { BiometricaService } from '../../services/biometrica.service';

type Modo         = 'registro' | 'login';
type Pantalla     = 'selector' | 'face' | 'huella' | 'error';
type FaceEtapa    = 'intro' | 'camara' | 'exito';
type HuellaEtapa  = 'intro' | 'sensor' | 'exito';
type HuellaEstado = 'esperando' | 'leyendo' | 'exito' | 'error';

@Component({
  selector: 'app-autenticacion-biometrica',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './autenticacion-biometrica.html',
  styleUrl: './autenticacion-biometrica.scss',
})
export class AutenticacionBiometrica implements OnInit, OnDestroy {

  @ViewChild('videoRef') videoRef!: ElementRef<HTMLVideoElement>;

  // ── Estado general ──────────────────────────────────────────────────────────
  modo: Modo         = 'registro';
  pantalla: Pantalla = 'selector';
  errorMensaje       = '';

  // ── Face ID ─────────────────────────────────────────────────────────────────
  faceEtapa: FaceEtapa = 'intro';
  instruccionActual    = 'Centra tu cara en el óvalo';
  faceError            = '';
  faceProgresoDash     = '0 753';    // circunferencia del óvalo ≈ 753
  faceLineaY           = 20;
  faceProgresoVal      = 0;          // 0–100

  private stream: MediaStream | null = null;
  private faceTimers: any[]          = [];

  // Instrucciones secuenciadas
  private readonly instrucciones = [
    { texto: 'Centra tu cara en el óvalo',         ms: 0 },
    { texto: 'Mueve la cabeza lentamente a la derecha ›',  ms: 3000 },
    { texto: '‹ Ahora gira hacia la izquierda',    ms: 6000 },
    { texto: '↑ Inclina la cabeza hacia arriba',   ms: 9000 },
    { texto: '↓ Ahora hacia abajo',                ms: 12000 },
    { texto: '✓ Perfecto, procesando...',           ms: 15000 },
  ];

  // ── Huella dactilar ─────────────────────────────────────────────────────────
  huellaEtapa: HuellaEtapa = 'intro';
  huellaEstado: HuellaEstado = 'esperando';
  instruccionHuella          = 'Toca el sensor de huellas';
  huellaDash                 = '0 452';  // circunferencia r=72 ≈ 452
  huellaLinea1Opac           = 0.3;
  huellaLinea2Opac           = 0.2;
  huellaLinea3Opac           = 0.15;
  huellaLinea4Opac           = 0.1;
  private huellaTimers: any[] = [];

  // ── Login biométrico ────────────────────────────────────────────────────────
  correo             = '';
  userId: number | null = null;
  optsAutenticacion: any = null;

  constructor(
    private router: Router,
    private route:  ActivatedRoute,
    private bio:    BiometricaService,
    private cdr:    ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    const qModo   = this.route.snapshot.queryParamMap.get('modo');
    const qCorreo = this.route.snapshot.queryParamMap.get('correo');

    if (qModo === 'login' && qCorreo) {
      this.modo   = 'login';
      this.correo = qCorreo;
      this.iniciarLoginBiometrico();
    } else {
      this.modo = 'registro';
    }
  }

  ngOnDestroy(): void {
    this.detenerCamara();
    this.limpiarTimers();
  }

  // ─── Navegación ─────────────────────────────────────────────────────────────

  volverSelector(): void {
    this.detenerCamara();
    this.limpiarTimers();
    this.faceEtapa   = 'intro';
    this.huellaEtapa = 'intro';
    this.pantalla    = 'selector';
    this.cdr.detectChanges();
  }

  reintentar(): void {
    this.pantalla = 'selector';
    this.cdr.detectChanges();
  }

  usarContrasena(): void { this.router.navigate(['/login']); }

  cancelar(): void {
    this.router.navigate([this.modo === 'registro' ? '/configuracion' : '/login']);
  }

  // ─── FACE ID ─────────────────────────────────────────────────────────────────

  iniciarRegistroFaceId(): void {
    this.pantalla  = 'face';
    this.faceEtapa = 'intro';
    this.cdr.detectChanges();
  }

  async empezarFaceId(): Promise<void> {
    this.faceEtapa = 'camara';
    this.faceError = '';
    this.cdr.detectChanges();

    // Pequeño delay para que el DOM renderice el <video>
    await this.delay(150);

    // Solicitar cámara frontal
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 640 } },
        audio: false
      });

      const video = this.videoRef?.nativeElement;
      if (video) {
        video.srcObject = this.stream;
        await video.play();
      }

      // Lanzar secuencia de instrucciones y progreso
      this.lanzarSecuenciaFaceId();

    } catch (err: any) {
      this.faceError = err?.name === 'NotAllowedError'
        ? 'Permiso de cámara denegado. Ve a ajustes del navegador para habilitarlo.'
        : 'No se pudo acceder a la cámara. Verifica que no esté en uso por otra app.';
      this.cdr.detectChanges();
    }
  }

  private lanzarSecuenciaFaceId(): void {
    const periodoTotal = 18000;  // 18 s total
    const circunf      = 753;    // 2π × 120 ≈ 753

    // Instrucciones secuenciadas
    for (const ins of this.instrucciones) {
      const t = setTimeout(() => {
        this.instruccionActual = ins.texto;
        this.cdr.detectChanges();
      }, ins.ms);
      this.faceTimers.push(t);
    }

    // Progreso suave de la barra oval
    const pasos    = 180;
    const intervMs = periodoTotal / pasos;
    let   paso     = 0;

    const intervalo = setInterval(() => {
      paso++;
      this.faceProgresoVal = Math.min(100, (paso / pasos) * 100);
      const llena = (this.faceProgresoVal / 100) * circunf;
      this.faceProgresoDash = `${llena.toFixed(1)} ${circunf}`;

      // Línea de escaneo oscilante
      const t = (paso / pasos) * Math.PI * 6;
      this.faceLineaY = 70 + Math.sin(t) * 50;

      this.cdr.detectChanges();

      if (paso >= pasos) {
        clearInterval(intervalo);
        this.completarRegistroFaceId();
      }
    }, intervMs);

    this.faceTimers.push(intervalo);
  }

  private async completarRegistroFaceId(): Promise<void> {
    this.instruccionActual = '✓ Procesando...';
    this.cdr.detectChanges();

    await this.delay(800);
    this.detenerCamara();

    // Llamar al servicio real de WebAuthn
    this.bio.registrar().subscribe({
      next: () => {
        this.faceEtapa = 'exito';
        this.cdr.detectChanges();
        setTimeout(() => this.router.navigate(['/configuracion']), 2000);
      },
      error: (err) => {
        this.faceError = err?.error?.message ?? err?.message ?? 'No se pudo registrar la biometría.';
        this.cdr.detectChanges();
      }
    });
  }

  reiniciarFaceId(): void {
    this.faceError       = '';
    this.faceProgresoDash = '0 753';
    this.faceLineaY      = 20;
    this.faceProgresoVal = 0;
    this.limpiarTimers();
    this.empezarFaceId();
  }

  // ─── HUELLA DACTILAR ─────────────────────────────────────────────────────────

  iniciarRegistroHuella(): void {
    this.pantalla    = 'huella';
    this.huellaEtapa = 'intro';
    this.cdr.detectChanges();
  }

  empezarHuella(): void {
    this.huellaEtapa  = 'sensor';
    this.huellaEstado = 'esperando';
    this.instruccionHuella = 'Coloca tu dedo en el sensor';
    this.huellaDash        = '0 452';
    this.huellaLinea1Opac  = 0.3;
    this.huellaLinea2Opac  = 0.2;
    this.huellaLinea3Opac  = 0.15;
    this.huellaLinea4Opac  = 0.1;
    this.cdr.detectChanges();

    // Lanzar el flujo de WebAuthn que invoca el sensor nativo del dispositivo
    this.lanzarAnimacionHuella();

    this.bio.registrar().subscribe({
      next: () => {
        // El sensor aprobó → animar éxito
        this.huellaEstado     = 'exito';
        this.instruccionHuella = '¡Huella registrada!';
        this.huellaDash        = '452 452';
        this.huellaLinea1Opac  = 1;
        this.huellaLinea2Opac  = 1;
        this.huellaLinea3Opac  = 1;
        this.huellaLinea4Opac  = 1;
        this.cdr.detectChanges();

        setTimeout(() => {
          this.huellaEtapa = 'exito';
          this.cdr.detectChanges();
          setTimeout(() => this.router.navigate(['/configuracion']), 1800);
        }, 1000);
      },
      error: (err) => {
        const msg = err?.error?.message ?? err?.message ?? '';
        const cancelado = msg.toLowerCase().includes('cancel') || msg.toLowerCase().includes('notallowed');

        this.huellaEstado     = 'error';
        this.instruccionHuella = cancelado
          ? 'Operación cancelada'
          : (msg || 'No se pudo leer la huella');

        this.limpiarTimers();
        this.cdr.detectChanges();

        // Volver a "esperando" tras 2 s para que el usuario reintente
        if (cancelado) {
          const t = setTimeout(() => {
            this.pantalla = 'error';
            this.errorMensaje = 'Registro cancelado. Inténtalo de nuevo.';
            this.cdr.detectChanges();
          }, 1500);
          this.huellaTimers.push(t);
        }
      }
    });
  }

  private lanzarAnimacionHuella(): void {
    const secuencia = [
      { ms: 0,    texto: 'Coloca tu dedo en el sensor',           dash: '45 452',  l1: 0.4, l2: 0.2, l3: 0.15, l4: 0.1 },
      { ms: 1500, texto: 'Mantén el dedo quieto...',              dash: '135 452', l1: 0.7, l2: 0.5, l3: 0.2,  l4: 0.15 },
      { ms: 3000, texto: 'Leyendo tu huella dactilar...',         dash: '270 452', l1: 0.9, l2: 0.75, l3: 0.5, l4: 0.3 },
      { ms: 5000, texto: 'Levanta y vuelve a colocar el dedo',   dash: '360 452', l1: 1.0, l2: 0.9,  l3: 0.75, l4: 0.5 },
      { ms: 7000, texto: 'Casi listo...',                         dash: '420 452', l1: 1.0, l2: 1.0,  l3: 0.9,  l4: 0.7 },
    ];

    for (const paso of secuencia) {
      const t = setTimeout(() => {
        if (this.huellaEstado === 'esperando' || this.huellaEstado === 'leyendo') {
          this.huellaEstado     = paso.ms > 1000 ? 'leyendo' : 'esperando';
          this.instruccionHuella = paso.texto;
          this.huellaDash        = paso.dash;
          this.huellaLinea1Opac  = paso.l1;
          this.huellaLinea2Opac  = paso.l2;
          this.huellaLinea3Opac  = paso.l3;
          this.huellaLinea4Opac  = paso.l4;
          this.cdr.detectChanges();
        }
      }, paso.ms);
      this.huellaTimers.push(t);
    }
  }

  // ─── LOGIN biométrico ────────────────────────────────────────────────────────

  private iniciarLoginBiometrico(): void {
    this.bio.autenticarInicio(this.correo).subscribe({
      next: (opts) => {
        this.userId            = opts.userId;
        this.optsAutenticacion = opts;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.pantalla    = 'error';
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

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private detenerCamara(): void {
    this.stream?.getTracks().forEach(t => t.stop());
    this.stream = null;
    if (this.videoRef?.nativeElement) {
      this.videoRef.nativeElement.srcObject = null;
    }
  }

  private limpiarTimers(): void {
    [...this.faceTimers, ...this.huellaTimers].forEach(t => clearTimeout(t));
    this.faceTimers   = [];
    this.huellaTimers = [];
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}