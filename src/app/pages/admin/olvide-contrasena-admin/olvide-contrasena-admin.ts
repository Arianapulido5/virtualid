// src/app/pages/admin/olvide-contrasena-admin/olvide-contrasena-admin.ts
import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Auth } from '../../../services/auth';

@Component({
  selector: 'app-olvide-contrasena-admin',
  standalone: true,
  imports: [RouterLink, FormsModule, CommonModule],
  templateUrl: './olvide-contrasena-admin.html',
  styleUrls: ['./olvide-contrasena-admin.scss']
})
export class OlvideContrasenaAdmin implements OnInit {

  correo   = '';
  error    = '';
  cargando = false;

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

  ngOnInit(): void {}

  get correoEsValido(): boolean {
    return /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(this.correo.trim());
  }

  enviar(): void {
    this.error = '';
    if (!this.correo.trim())  { this.error = 'Ingresa tu correo electrónico.'; return; }
    if (!this.correoEsValido) { this.error = 'Ingresa un correo válido.'; return; }

    this.cargando = true;
    this.cdr.detectChanges();

    this.authService.verificarCorreoRecuperacion(this.correo.trim().toLowerCase()).subscribe({
      next: (res) => {
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

  get hasMinLength() { return this.nuevaContrasena.length >= 8; }
  get hasUppercase() { return /[A-Z]/.test(this.nuevaContrasena); }
  get hasLowercase() { return /[a-z]/.test(this.nuevaContrasena); }
  get hasNumber()    { return /[0-9]/.test(this.nuevaContrasena); }
  get hasSpecial()   { return /[!@#$%^&*()\-_=+\[\]{};':"\\|,.<>/?]/.test(this.nuevaContrasena); }
  get contrasenaOk() { return this.hasMinLength && this.hasUppercase && this.hasLowercase && this.hasNumber && this.hasSpecial; }

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

        if (err.status === 400 && msg.toLowerCase().includes('expiró')) {
          this.token      = '';
          this.errorReset = '';
          this.error      = msg + ' Ingresa tu correo nuevamente.';
        } else {
          this.errorReset = msg;
        }
        this.cdr.detectChanges();
      }
    });
  }

  irALogin(): void {
    this.router.navigate(['/admin/login']);
  }
}