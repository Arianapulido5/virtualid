// src/app/pages/autenticacion-biometrica/autenticacion-biometrica.ts
import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { BiometricaService } from '../../services/biometrica.service';

type Modo   = 'registro' | 'login';
type Estado = 'idle' | 'cargando' | 'exito' | 'error';

@Component({
  selector: 'app-autenticacion-biometrica',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './autenticacion-biometrica.html',
  styleUrl: './autenticacion-biometrica.scss',
})
export class AutenticacionBiometrica implements OnInit {
  modo: Modo     = 'registro';
  estado: Estado = 'idle';
  mensaje        = '';
  soportado      = true;

  // Para modo login
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

    BiometricaService.soportado().then((ok) => {
      this.soportado = ok;
      this.cdr.detectChanges();
    });
  }

  // ── REGISTRO ──────────────────────────────────────────────────────────────

  /** Lanza el diálogo nativo del dispositivo (huella O Face ID — el SO elige) */
  registrar(): void {
    this._iniciarRegistro();
  }

  /** Botón específico huella — agrega hint al navegador si lo soporta */
  registrarHuella(): void {
    this._iniciarRegistro('fingerprint');
  }

  /** Botón específico Face ID — agrega hint al navegador si lo soporta */
  registrarFaceId(): void {
    this._iniciarRegistro('face');
  }

  private _iniciarRegistro(hint?: 'fingerprint' | 'face'): void {
    this.estado  = 'cargando';
    this.mensaje = hint === 'fingerprint'
      ? 'Toca el sensor de huella dactilar...'
      : hint === 'face'
        ? 'Mira la cámara para Face ID...'
        : 'Sigue las instrucciones del dispositivo...';
    this.cdr.detectChanges();

    this.bio.registrar().subscribe({
      next: (res) => {
        this.estado  = 'exito';
        this.mensaje = res.message || 'Biometría registrada correctamente.';
        this.cdr.detectChanges();
        setTimeout(() => this.router.navigate(['/configuracion']), 1500);
      },
      error: (err) => {
        this.estado  = 'error';
        const raw    = err?.error?.message ?? err?.message ?? '';
        if (raw.toLowerCase().includes('cancel') || raw.toLowerCase().includes('notallowed')) {
          this.mensaje = 'Registro cancelado. Inténtalo de nuevo.';
        } else {
          this.mensaje = raw || 'No se pudo registrar la biometría.';
        }
        this.cdr.detectChanges();
      },
    });
  }

  // ── LOGIN BIOMÉTRICO ──────────────────────────────────────────────────────

  private iniciarLoginBiometrico(): void {
    this.estado  = 'cargando';
    this.mensaje = 'Verificando tu identidad...';
    this.cdr.detectChanges();

    this.bio.autenticarInicio(this.correo).subscribe({
      next: (opts) => {
        this.userId            = opts.userId;
        this.optsAutenticacion = opts;
        this.autenticarConBiometria();
      },
      error: (err) => {
        this.estado  = 'error';
        this.mensaje = err?.error?.sin_biometrica
          ? 'No tienes biometría registrada en este dispositivo.'
          : (err?.error?.message ?? 'No se pudo iniciar la autenticación.');
        this.cdr.detectChanges();
      },
    });
  }

  autenticarConBiometria(): void {
    if (!this.userId || !this.optsAutenticacion) return;
    this.estado  = 'cargando';
    this.mensaje = 'Toca el sensor o usa Face ID...';
    this.cdr.detectChanges();

    this.bio.autenticarFin(this.userId, this.optsAutenticacion).subscribe({
      next: (res) => {
        localStorage.setItem('token', res.token);
        localStorage.setItem('rol',   res.rol);
        this.estado  = 'exito';
        this.mensaje = '¡Autenticación exitosa!';
        this.cdr.detectChanges();
        setTimeout(() => this.router.navigate(['/dashboard'], { replaceUrl: true }), 800);
      },
      error: (err) => {
        this.estado  = 'error';
        this.mensaje = err?.error?.message ?? err?.message ?? 'Autenticación fallida.';
        this.cdr.detectChanges();
      },
    });
  }

  // ── HELPERS ───────────────────────────────────────────────────────────────

  usarContrasena(): void { this.router.navigate(['/login']); }

  cancelar(): void {
    this.router.navigate([this.modo === 'registro' ? '/configuracion' : '/login']);
  }

  reintentar(): void {
    this.estado  = 'idle';
    this.mensaje = '';
    this.cdr.detectChanges();
    if (this.modo === 'login') this.iniciarLoginBiometrico();
  }
}