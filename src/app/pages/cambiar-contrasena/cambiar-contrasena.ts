// src/app/pages/cambiar-contrasena/cambiar-contrasena.ts
import { Component, ChangeDetectorRef } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Auth } from '../../services/auth';

@Component({
  selector: 'app-cambiar-contrasena',
  standalone: true,
  imports: [RouterLink, FormsModule, CommonModule],
  templateUrl: './cambiar-contrasena.html',
  styleUrls: ['./cambiar-contrasena.scss']
})
export class CambiarContrasena {

  // ── Campos ────────────────────────────────────────────────
  contrasenaActual    = '';
  contrasenaNueva     = '';
  contrasenaConfirmar = '';

  // ── Estado UI ─────────────────────────────────────────────
  error        = '';
  mostrarModal = false;
  cargando     = false;

  // ── Visibilidad ───────────────────────────────────────────
  showActual    = false;
  showNueva     = false;
  showConfirmar = false;

  constructor(
    private authService: Auth,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  // ── Getters requisitos ────────────────────────────────────
  get hasMinLength() { return this.contrasenaNueva.length >= 8; }
  get hasUppercase() { return /[A-Z]/.test(this.contrasenaNueva); }
  get hasLowercase() { return /[a-z]/.test(this.contrasenaNueva); }
  get hasNumber()    { return /[0-9]/.test(this.contrasenaNueva); }
  get hasSpecial()   { return /[@#$%^&*!]/.test(this.contrasenaNueva); }

  cambiar() {
    this.error = '';

    // Validaciones frontend
    if (!this.contrasenaActual) {
      this.error = 'Debes ingresar tu contraseña actual.';
      return;
    }
    if (!this.hasMinLength || !this.hasUppercase || !this.hasLowercase || !this.hasNumber || !this.hasSpecial) {
      this.error = 'La nueva contraseña no cumple los requisitos de seguridad.';
      return;
    }
    if (this.contrasenaNueva !== this.contrasenaConfirmar) {
      this.error = 'Las contraseñas no coinciden.';
      return;
    }
    if (this.contrasenaActual === this.contrasenaNueva) {
      this.error = 'La nueva contraseña debe ser diferente a la contraseña actual.';
      return;
    }

    this.cargando = true;

    this.authService.cambiarContrasena(
      this.contrasenaActual,
      this.contrasenaNueva,
      this.contrasenaConfirmar
    ).subscribe({
      next: () => {
        this.cargando     = false;
        this.mostrarModal = true;
        this.contrasenaActual = this.contrasenaNueva = this.contrasenaConfirmar = '';
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.cargando = false;
        this.error = err.error?.mensaje || 'Ocurrió un error al cambiar la contraseña.';
        this.cdr.detectChanges();
      }
    });
  }

  irAConfiguracion(): void {
    this.router.navigate(['/configuracion']);
  }
}