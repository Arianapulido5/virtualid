import { Component, OnInit, OnDestroy, ChangeDetectorRef, NgZone, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
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
  errorCamara = '';

  private stream:       MediaStream | null = null;
  private scanInterval: any;

  private readonly backendUrl = 'https://frumentaceous-overnervously-johnnie.ngrok-free.dev/api/qr/validar';

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

  async iniciarDesdeBoton(): Promise<void> {
    this.errorCamara = '';
    this.estado      = 'escaneando';
    this.cdr.detectChanges();
    setTimeout(() => this.iniciarCamara(), 100);
  }

  escanearOtro(): void {
    this.mensaje     = '';
    this.usuario     = '';
    this.tipoUsuario = '';
    this.estado      = 'escaneando';
    // Limpiar intervalo anterior y reiniciar escaneo
    clearInterval(this.scanInterval);
    this.cdr.detectChanges();
    setTimeout(() => this.iniciarEscaneo(), 100);
  }

  siguienteEscaneo(): void {
    this.mensaje     = '';
    this.usuario     = '';
    this.tipoUsuario = '';
    this.estado      = 'escaneando';
    // Limpiar intervalo anterior y reiniciar escaneo
    clearInterval(this.scanInterval);
    this.cdr.detectChanges();
    setTimeout(() => this.iniciarEscaneo(), 100);
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

    this.http.post<any>(this.backendUrl, {
      token,
      punto_acceso_id: this.puntoId
    }).subscribe({
      next: (data) => {
        this.ngZone.run(() => {
          this.estado      = data.exitoso ? 'exitoso' : 'denegado';
          this.usuario     = data.usuario?.nombre      ?? '';
          this.tipoUsuario = data.usuario?.tipo_usuario ?? '';
          this.mensaje     = data.message;
          this.cdr.detectChanges();
        });
      },
      error: (err) => {
        this.ngZone.run(() => {
          this.estado  = 'denegado';
          this.mensaje = err.error?.message ?? 'Error al validar. Intenta de nuevo.';
          this.cdr.detectChanges();
        });
      }
    });
  }
}