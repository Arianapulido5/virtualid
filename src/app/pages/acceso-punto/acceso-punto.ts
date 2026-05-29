import { Component, OnInit, OnDestroy, ChangeDetectorRef, NgZone, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import jsQR from 'jsqr';

@Component({
  selector: 'app-acceso-punto',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './acceso-punto.html',
  styleUrls: ['./acceso-punto.scss']
})
export class AccesoPunto implements OnInit, OnDestroy {

  @ViewChild('video',  { static: false }) videoRef?:  ElementRef<HTMLVideoElement>;
  @ViewChild('canvas', { static: false }) canvasRef?: ElementRef<HTMLCanvasElement>;

  puntoId     = 0;
  estado: 'inicio' | 'escaneando' | 'procesando' | 'exitoso' | 'denegado' = 'inicio';
  mensaje     = '';
  usuario     = '';
  tipoUsuario = '';
  tipoMovimiento: 'entrada' | 'salida' = 'entrada';
  errorCamara = '';

  private stream:       MediaStream | null = null;
  private scanInterval: any;

  constructor(
    private route:  ActivatedRoute,
    private http:   HttpClient,
    private cdr:    ChangeDetectorRef,
    private ngZone: NgZone
  ) {}

  ngOnInit(): void {
    this.puntoId = parseInt(this.route.snapshot.paramMap.get('id') ?? '0');
  }

  ngOnDestroy(): void {
    this.detenerCamara();
    clearInterval(this.scanInterval);
  }

  // ── Getters de texto e ícono según movimiento y resultado ─────────────────

  get textoResultado(): string {
    if (this.estado === 'exitoso') {
      return this.tipoMovimiento === 'salida' ? 'Salida correcta' : 'Acceso permitido';
    }
    return this.tipoMovimiento === 'salida' ? 'Salida denegada' : 'Acceso denegado';
  }

  get claseTextoResultado(): string {
    return this.estado === 'exitoso' ? 'acceso-ok' : 'acceso-no';
  }

  get iconoResultado(): string {
    if (this.estado === 'exitoso') {
      return this.tipoMovimiento === 'salida' ? '🚪' : '✅';
    }
    return '❌';
  }

  // ── Control de cámara ─────────────────────────────────────────────────────

  async iniciarDesdeBoton(): Promise<void> {
    this.errorCamara = '';
    this.estado      = 'escaneando';
    this.cdr.detectChanges();
    setTimeout(() => this.iniciarCamara(), 100);
  }

  siguienteEscaneo(): void {
    this.resetearEstado();
    setTimeout(() => this.iniciarEscaneo(), 100);
  }

  escanearOtro(): void {
    this.resetearEstado();
    setTimeout(() => this.iniciarEscaneo(), 100);
  }

  private resetearEstado(): void {
    this.mensaje        = '';
    this.usuario        = '';
    this.tipoUsuario    = '';
    this.tipoMovimiento = 'entrada';
    this.estado         = 'escaneando';
    clearInterval(this.scanInterval);
    this.cdr.detectChanges();
  }

  private async iniciarCamara(): Promise<void> {
    try {
      if (!this.videoRef?.nativeElement) {
        this.errorCamara = 'Error al inicializar la cámara. Intenta de nuevo.';
        this.estado      = 'inicio';
        this.cdr.detectChanges();
        return;
      }

      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } }
      });
      const video     = this.videoRef.nativeElement;
      video.srcObject = this.stream;
      await video.play();
      this.iniciarEscaneo();
      this.cdr.detectChanges();
    } catch (err: any) {
      this.ngZone.run(() => {
        this.estado      = 'inicio';
        this.errorCamara = err.name === 'NotAllowedError'
          ? 'Permiso denegado. Ve a Ajustes → Safari → Cámara y permite el acceso.'
          : `No se pudo acceder a la cámara: ${err.name}`;
        this.cdr.detectChanges();
      });
    }
  }

  private detenerCamara(): void {
    this.stream?.getTracks().forEach(t => t.stop());
  }

  private iniciarEscaneo(): void {
    if (!this.videoRef?.nativeElement || !this.canvasRef?.nativeElement) return;

    const video  = this.videoRef.nativeElement;
    const canvas = this.canvasRef.nativeElement;
    const ctx    = canvas.getContext('2d')!;

    clearInterval(this.scanInterval);

    this.scanInterval = setInterval(() => {
      if (this.estado !== 'escaneando') return;
      if (!this.videoRef?.nativeElement) return;
      if (video.readyState !== video.HAVE_ENOUGH_DATA) return;

      canvas.width  = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert'
      });

      if (code?.data) {
        this.ngZone.run(() => this.procesarQR(code.data));
      }
    }, 300);
  }

  private procesarQR(token: string): void {
    if (this.estado !== 'escaneando') return;
    this.estado = 'procesando';
    clearInterval(this.scanInterval);
    this.cdr.detectChanges();

    this.http.post<any>(environment.qrValidarUrl, {
      token,
      punto_acceso_id: this.puntoId
    }).subscribe({
      next: (data) => {
        this.ngZone.run(() => {
          this.estado         = data.exitoso ? 'exitoso' : 'denegado';
          this.usuario        = data.usuario?.nombre      ?? '';
          this.tipoUsuario    = data.usuario?.tipo_usuario ?? '';
          this.mensaje        = data.message;
          this.tipoMovimiento = data.tipo_movimiento === 'salida' ? 'salida' : 'entrada';
          this.cdr.detectChanges();
        });
      },
      error: (err) => {
        this.ngZone.run(() => {
          this.estado         = 'denegado';
          this.mensaje        = err.error?.message ?? 'Error al validar. Intenta de nuevo.';
          this.tipoMovimiento = err.error?.tipo_movimiento === 'salida' ? 'salida' : 'entrada';
          this.cdr.detectChanges();
        });
      }
    });
  }
}