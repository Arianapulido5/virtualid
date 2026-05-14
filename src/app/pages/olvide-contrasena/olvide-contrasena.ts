// src/app/pages/olvide-contrasena/olvide-contrasena.ts
import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { RouterLink, Router, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Auth } from '../../services/auth';

@Component({
  selector: 'app-olvide-contrasena',
  standalone: true,
  imports: [RouterLink, FormsModule, CommonModule],
  templateUrl: './olvide-contrasena.html',
  styleUrls: ['./olvide-contrasena.scss']
})
export class OlvideContrasena implements OnInit {

  // ── Paso 1: solicitar correo ──────────────────────────────
  correo   = '';
  enviado  = false;
  error    = '';
  cargando = false;

  // ── Paso 2: nueva contraseña con token ────────────────────
  token               = '';
  nuevaContrasena     = '';
  confirmarContrasena = '';
  showNueva           = false;
  showConfirmar       = false;
  errorReset          = '';
  cargandoReset       = false;
  resetExitoso        = false;

  constructor(
    private authService: Auth,
    private route:       ActivatedRoute,
    private router:      Router,
    private cdr:         ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.token = this.route.snapshot.queryParamMap.get('token') ?? '';
  }

  // ── Getters paso 1 ────────────────────────────────────────
  get correoEsValido(): boolean {
    return /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(this.correo.trim());
  }

  // ── Paso 1: enviar correo ─────────────────────────────────
  enviar(): void {
    this.error = '';
    if (!this.correo.trim())    { this.error = 'Ingresa tu correo electrónico.'; return; }
    if (!this.correoEsValido)   { this.error = 'Ingresa un correo válido.'; return; }

    this.cargando = true;
    this.authService.solicitarRecuperacion(this.correo.trim().toLowerCase()).subscribe({
      next: () => {
        this.cargando = false;
        this.enviado  = true;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.cargando = false;
        this.error    = err.error?.message ?? 'Error al enviar el correo. Intenta de nuevo.';
        this.cdr.detectChanges();
      }
    });
  }

  // ── Getters paso 2 ────────────────────────────────────────
  get hasMinLength()  { return this.nuevaContrasena.length >= 8; }
  get hasUppercase()  { return /[A-Z]/.test(this.nuevaContrasena); }
  get hasLowercase()  { return /[a-z]/.test(this.nuevaContrasena); }
  get hasNumber()     { return /[0-9]/.test(this.nuevaContrasena); }
  get hasSpecial()    { return /[!@#$%^&*()\-_=+\[\]{};':"\\|,.<>/?]/.test(this.nuevaContrasena); }
  get contrasenaOk()  { return this.hasMinLength && this.hasUppercase && this.hasLowercase && this.hasNumber && this.hasSpecial; }

  // ── Paso 2: restablecer contraseña ────────────────────────
  restablecerContrasena(): void {
    this.errorReset = '';

    if (!this.contrasenaOk) {
      this.errorReset = 'La contraseña no cumple los requisitos de seguridad.'; return;
    }
    if (this.nuevaContrasena !== this.confirmarContrasena) {
      this.errorReset = 'Las contraseñas no coinciden.'; return;
    }

    this.cargandoReset = true;
    this.authService.restablecerContrasena(this.token, this.nuevaContrasena).subscribe({
      next: () => {
        this.cargandoReset = false;
        this.resetExitoso  = true;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.cargandoReset = false;
        this.errorReset    = err.error?.message ?? 'El enlace es inválido o ya expiró.';
        this.cdr.detectChanges();
      }
    });
  }

  irALogin(): void {
    this.router.navigate(['/login']);
  }
}