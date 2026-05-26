// src/app/pages/login/login.ts
import { Component, ChangeDetectorRef, OnInit, OnDestroy, ViewChild, ElementRef, NgZone } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Auth } from '../../services/auth';
import { BiometricaService } from '../../services/biometrica.service';
import { PushService } from '../../services/push.service';
import { timeout, catchError } from 'rxjs/operators';
import { TimeoutError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [RouterLink, NgIf, FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login implements OnInit, OnDestroy {

  @ViewChild('faceVideoRef') faceVideoRef!: ElementRef<HTMLVideoElement>;

  showPassword = false;
  cargando     = false;
  correo       = '';
  contrasena   = '';
  errorGeneral = '';
  errores: { correo?: string; contrasena?: string } = {};

  // ── Modal facial ──────────────────────────────────────────────────────────
  faceModalVisible = false;
  faceScanning     = false;
  faceProcessing   = false;
  faceError        = '';
  faceScanLineY    = 60;
  biometricaDisponible = false;

  private faceStream:       MediaStream | null = null;
  private scanLineInterval: any  = null;
  private faceApiLoaded          = false;
  private timers:           any[] = [];

  private api = environment.apiUrl;

  constructor(
    private authService: Auth,
    private router:      Router,
    private cdr:         ChangeDetectorRef,
    private pushService: PushService,
    private http:        HttpClient,
    private zone:        NgZone,
  ) {}

  ngOnInit(): void {
    BiometricaService.soportado().then((ok) => {
      this.biometricaDisponible = ok;
      this.cdr.detectChanges();
    });
  }

  ngOnDestroy(): void {
    this.limpiarCamara();
    this.timers.forEach(t => clearTimeout(t));
  }

  togglePassword() { this.showPassword = !this.showPassword; }

  validarCorreo() {
    const v  = this.correo.trim();
    const re = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
    if (!v)               this.errores.correo = 'El correo es obligatorio.';
    else if (!re.test(v)) this.errores.correo = 'Ingresa un correo válido.';
    else                  this.errores.correo = undefined;
  }

  validarContrasena() {
    const v = this.contrasena;
    if (!v)                this.errores.contrasena = 'La contraseña es obligatoria.';
    else if (v.length < 8) this.errores.contrasena = 'Mínimo 8 caracteres.';
    else                   this.errores.contrasena = undefined;
  }

  private formularioValido(): boolean {
    this.validarCorreo();
    this.validarContrasena();
    return Object.values(this.errores).every((v) => v === undefined);
  }

  // ── LOGIN MANUAL ──────────────────────────────────────────────────────────

  iniciarSesion() {
    this.errorGeneral = '';
    if (!this.formularioValido()) return;

    this.cargando = true;
    this.cdr.detectChanges();

    this.authService
      .login(this.correo.trim(), this.contrasena)
      .pipe(
        timeout(30000),
        catchError((err) => {
          if (err instanceof TimeoutError) return throwError(() => ({ timedOut: true }));
          return throwError(() => err);
        })
      )
      .subscribe({
        next: (res: any) => {
          this.cargando = false;
          if (res.rol === 'admin') {
            this.errorGeneral = 'Esta cuenta es de administrador. Usa el acceso de administrador.';
            this.cdr.detectChanges();
            return;
          }
          Auth.setToken(res.token);
          Auth.setRol(res.rol);
          this.cdr.detectChanges();
          this.router.navigate(['/dashboard']);
        },
        error: (err: any) => {
          this.cargando = false;
          if (err?.timedOut) {
            this.errorGeneral = 'El servidor tardó demasiado. Intenta de nuevo.';
          } else if (!navigator.onLine) {
            this.errorGeneral = 'Sin conexión a internet.';
          } else if (err.status === 0) {
            this.errorGeneral = 'No se pudo conectar al servidor.';
          } else {
            const msg: string = err.error?.message || 'Error al iniciar sesión.';
            if (msg.toLowerCase().includes('incorrectos')) {
              this.errores.contrasena = 'Correo o contraseña incorrectos.';
              this.errores.correo     = ' ';
            } else {
              this.errorGeneral = msg;
            }
          }
          this.cdr.detectChanges();
        },
      });
  }

  // ── LOGIN BIOMÉTRICO — abre cámara directo, sin pedir correo ─────────────

  async iniciarBiometria(): Promise<void> {
    this.faceError        = '';
    this.faceModalVisible = true;
    this.faceScanning     = false;
    this.faceProcessing   = false;
    this.cdr.detectChanges();

    await this.delay(120);
    await this.cargarFaceApi();
    await this.abrirCamara();
  }

  cerrarModalFace(): void {
    this.limpiarCamara();
    this.faceModalVisible = false;
    this.faceError        = '';
    this.cdr.detectChanges();
  }

  async reintentarFace(): Promise<void> {
    this.faceError = '';
    await this.abrirCamara();
  }

  // ── Carga de face-api ────────────────────────────────────────────────────

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

  private async abrirCamara(): Promise<void> {
    this.faceScanning   = false;
    this.faceProcessing = false;
    this.cdr.detectChanges();

    try {
      this.faceStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });

      const video = this.faceVideoRef?.nativeElement;
      if (!video) {
        this.faceError = 'No se encontró el elemento de video.';
        this.cdr.detectChanges();
        return;
      }

      video.srcObject = this.faceStream;
      await video.play();

      this.faceScanning = true;
      this.iniciarScanLine();
      this.cdr.detectChanges();

      // Auto-captura tras 1.8 s — tiempo para que el usuario encuadre su cara
      const t = setTimeout(() => this.capturarYEnviar(), 1800);
      this.timers.push(t);

    } catch (err: any) {
      this.faceError    = err?.name === 'NotAllowedError'
        ? 'Permiso de cámara denegado. Actívalo en los ajustes del navegador.'
        : 'No se pudo acceder a la cámara.';
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

  // ── Captura y envío — solo manda el descriptor, sin correo ───────────────

  private async capturarYEnviar(): Promise<void> {
    if (!this.faceScanning) return;

    const faceapi = (window as any).faceapi;
    const video   = this.faceVideoRef?.nativeElement;
    if (!faceapi || !video) {
      this.faceError = 'Error interno.';
      this.cdr.detectChanges();
      return;
    }

    this.faceProcessing = true;
    this.cdr.detectChanges();

    try {
      const det = await faceapi
        .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.45 }))
        .withFaceLandmarks(true)
        .withFaceDescriptor();

      if (!det) {
        this.faceProcessing = false;
        this.faceError      = 'No se detectó ningún rostro. Centra tu cara y vuelve a intentarlo.';
        this.limpiarCamara();
        this.cdr.detectChanges();
        return;
      }

      const descriptor = Array.from(det.descriptor as Float32Array) as number[];
      this.limpiarCamara();

      // Solo se manda el descriptor — el backend busca entre TODOS los usuarios
      this.http.post<{ token: string; rol: string }>(`${this.api}/biometrica/login`, { descriptor })
        .subscribe({
          next: (res) => {
            this.zone.run(() => {
              this.faceProcessing   = false;
              this.faceModalVisible = false;
              Auth.setToken(res.token);
              Auth.setRol(res.rol);
              this.cdr.detectChanges();
              this.router.navigate(['/dashboard'], { replaceUrl: true });
            });
          },
          error: (err: any) => {
            this.zone.run(() => {
              this.faceProcessing = false;
              const msg: string = err?.error?.message ?? '';
              if (
                err?.status === 404 ||
                msg.toLowerCase().includes('no encontrado') ||
                msg.toLowerCase().includes('no coincide') ||
                msg.toLowerCase().includes('no se reconoció')
              ) {
                this.faceError = 'No se reconoció ningún rostro registrado. Intenta de nuevo o usa tu contraseña.';
              } else if (
                msg.toLowerCase().includes('sin_biometrica') ||
                msg.toLowerCase().includes('ninguna cuenta')
              ) {
                this.faceError = 'Ninguna cuenta tiene Face ID activado. Actívalo en Configuración.';
              } else if (err?.status === 403) {
                this.faceError = 'Tu cuenta está bloqueada. Contacta al administrador.';
              } else {
                this.faceError = msg || 'No se pudo verificar la identidad.';
              }
              this.cdr.detectChanges();
            });
          },
        });

    } catch {
      this.faceProcessing = false;
      this.faceError      = 'Error al procesar el rostro. Inténtalo de nuevo.';
      this.limpiarCamara();
      this.cdr.detectChanges();
    }
  }

  // ── Limpieza ──────────────────────────────────────────────────────────────

  private limpiarCamara(): void {
    this.faceScanning = false;
    if (this.scanLineInterval) {
      clearInterval(this.scanLineInterval);
      this.scanLineInterval = null;
    }
    this.faceStream?.getTracks().forEach(t => t.stop());
    this.faceStream = null;
    const video = this.faceVideoRef?.nativeElement;
    if (video) video.srcObject = null;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(r => setTimeout(r, ms));
  }
}