// src/app/pages/autenticacion-biometrica/autenticacion-biometrica.ts
import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { BiometricaService } from '../../services/biometrica.service';

type Modo = 'registro' | 'login';
type Estado = 'idle' | 'cargando' | 'exito' | 'error';

@Component({
  selector: 'app-autenticacion-biometrica',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './autenticacion-biometrica.html',
  styleUrl: './autenticacion-biometrica.scss',
})
export class AutenticacionBiometrica implements OnInit {
  modo: Modo     = 'registro'; // 'registro' cuando viene desde configuración
  estado: Estado = 'idle';
  mensaje        = '';
  soportado      = true;

  // Para modo login (cuando viene redirigido desde login.ts)
  correo  = '';
  userId: number | null = null;
  optsAutenticacion: any = null;

  constructor(
    private router:     Router,
    private route:      ActivatedRoute,
    private bio:        BiometricaService,
    private cdr:        ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // Detectar modo por queryParam: ?modo=login&correo=x@x.com
    const qModo   = this.route.snapshot.queryParamMap.get('modo');
    const qCorreo = this.route.snapshot.queryParamMap.get('correo');

    if (qModo === 'login' && qCorreo) {
      this.modo   = 'login';
      this.correo = qCorreo;
      this.iniciarLoginBiometrico();
    } else {
      this.modo = 'registro';
    }

    // Verificar soporte del dispositivo
    BiometricaService.soportado().then((ok) => {
      this.soportado = ok;
      this.cdr.detectChanges();
    });
  }

  // ── REGISTRO ──────────────────────────────────────────────────────────────

  registrar(): void {
    this.estado  = 'cargando';
    this.mensaje = '';
    this.cdr.detectChanges();

    this.bio.registrar().subscribe({
      next: (res) => {
        this.estado  = 'exito';
        this.mensaje = res.message || 'Biometría registrada correctamente.';
        this.cdr.detectChanges();
        // Volver a configuración tras 1.5 s
        setTimeout(() => this.router.navigate(['/configuracion']), 1500);
      },
      error: (err) => {
        this.estado  = 'error';
        this.mensaje = err?.error?.message ?? err?.message ?? 'No se pudo registrar la biometría.';
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
        this.userId           = opts.userId;
        this.optsAutenticacion = opts;
        // Lanzar el autenticador inmediatamente
        this.autenticarConBiometria();
      },
      error: (err) => {
        const sinBio = err?.error?.sin_biometrica;
        this.estado  = 'error';
        this.mensaje = sinBio
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

  // ── NAVEGACIÓN ────────────────────────────────────────────────────────────

  usarContrasena(): void {
    // Vuelve al login con login manual
    this.router.navigate(['/login']);
  }

  cancelar(): void {
    if (this.modo === 'registro') {
      this.router.navigate(['/configuracion']);
    } else {
      this.router.navigate(['/login']);
    }
  }

  reintentar(): void {
    this.estado  = 'idle';
    this.mensaje = '';
    this.cdr.detectChanges();
    if (this.modo === 'login') {
      this.iniciarLoginBiometrico();
    }
  }
}