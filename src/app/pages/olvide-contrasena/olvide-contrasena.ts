// src/app/pages/olvide-contrasena/olvide-contrasena.ts
import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
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

  // ── Paso 1: verificar correo ──────────────────────────────
  correo   = '';
  error    = '';
  cargando = false;

  // ── Paso 2: nueva contraseña ──────────────────────────────
  // El token se guarda aquí tras verificar el correo exitosamente.
  // Cuando token !== '' el template muestra el formulario de nueva contraseña.
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
    private router:      Router,
    private cdr:         ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // Nada que leer de la URL — el flujo es 100% en memoria
  }

  // ── Getters paso 1 ────────────────────────────────────────
  get correoEsValido(): boolean {
    return /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(this.correo.trim());
  }

  // ── Paso 1: verificar correo en la BD ─────────────────────
  enviar(): void {
    this.error = '';
    if (!this.correo.trim())  { this.error = 'Ingresa tu correo electrónico.'; return; }
    if (!this.correoEsValido) { this.error = 'Ingresa un correo válido.'; return; }

    this.cargando = true;
    this.cdr.detectChanges();

    this.authService.verificarCorreoRecuperacion(this.correo.trim().toLowerCase()).subscribe({
      next: (res) => {
        // Correo existe → guardamos el token y pasamos al paso 2 directamente
        this.cargando = false;
        this.token    = res.token;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.cargando = false;
        this.error    = err.error?.message ?? 'Error al verificar el correo. Intenta de nuevo.';
        this.cdr.detectChanges();
      }
    });
  }

  // ── Getters paso 2 ────────────────────────────────────────
  get hasMinLength() { return this.nuevaContrasena.length >= 8; }
  get hasUppercase() { return /[A-Z]/.test(this.nuevaContrasena); }
  get hasLowercase() { return /[a-z]/.test(this.nuevaContrasena); }
  get hasNumber()    { return /[0-9]/.test(this.nuevaContrasena); }
  get hasSpecial()   { return /[!@#$%^&*()\-_=+\[\]{};':"\\|,.<>/?]/.test(this.nuevaContrasena); }
  get contrasenaOk() { return this.hasMinLength && this.hasUppercase && this.hasLowercase && this.hasNumber && this.hasSpecial; }

  // ── Paso 2: guardar nueva contraseña en la BD ─────────────
  restablecerContrasena(): void {
    this.errorReset = '';

    if (!this.contrasenaOk) {
      this.errorReset = 'La contraseña no cumple los requisitos de seguridad.'; return;
    }
    if (this.nuevaContrasena !== this.confirmarContrasena) {
      this.errorReset = 'Las contraseñas no coinciden.'; return;
    }

    this.cargandoReset = true;
    this.cdr.detectChanges();

    this.authService.restablecerContrasena(this.token, this.nuevaContrasena).subscribe({
      next: () => {
        this.cargandoReset = false;
        this.resetExitoso  = true;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.cargandoReset = false;
        const msg: string  = err.error?.message ?? 'Error al guardar la contraseña.';

        // Si el token de 15 min expiró, volver al paso 1
        if (err.status === 400 && msg.toLowerCase().includes('expiró')) {
          this.token     = '';
          this.errorReset = '';
          this.error     = msg + ' Ingresa tu correo nuevamente.';
        } else {
          this.errorReset = msg;
        }
        this.cdr.detectChanges();
      }
    });
  }

  irALogin(): void {
    this.router.navigate(['/login']);
  }
}