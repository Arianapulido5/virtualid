// src/app/pages/admin/login-admin/login-admin.ts
import { Component, ChangeDetectorRef } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Auth } from '../../../services/auth';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [RouterLink, NgIf, FormsModule],
  templateUrl: './login-admin.html',
  styleUrl: './login-admin.scss'
})
export class Login {
  showPassword = false;
  cargando     = false;
  correo       = '';
  contrasena   = '';
  errorGeneral = '';

  errores: { correo?: string; contrasena?: string } = {};

  constructor(
    private authService: Auth,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  togglePassword() { this.showPassword = !this.showPassword; }

  validarCorreo() {
    const v  = this.correo.trim();
    const re = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
    if (!v)               this.errores.correo = 'El correo es obligatorio.';
    else if (!re.test(v)) this.errores.correo = 'Ingresa un correo válido (ej: usuario@dominio.com).';
    else                  this.errores.correo = undefined;
  }

  validarContrasena() {
    const v = this.contrasena;
    if (!v)                this.errores.contrasena = 'La contraseña es obligatoria.';
    else if (v.length < 8) this.errores.contrasena = 'La contraseña debe tener al menos 8 caracteres.';
    else                   this.errores.contrasena = undefined;
  }

  private formularioValido(): boolean {
    this.validarCorreo();
    this.validarContrasena();
    return Object.values(this.errores).every(v => v === undefined);
  }

  iniciarSesion() {
    this.errorGeneral = '';
    if (!this.formularioValido()) return;

    this.cargando = true;
    this.authService.login(this.correo.trim(), this.contrasena).subscribe({
      next: (res: any) => {
        this.cargando = false;

        // Si NO es admin, no permitir acceso por este login
        if (res.rol !== 'admin') {
          this.errorGeneral = 'Esta cuenta no tiene permisos de administrador.';
          this.cdr.detectChanges();
          return;
        }

        localStorage.setItem('token', res.token);
        localStorage.setItem('rol', res.rol);
        this.cdr.detectChanges();
        this.router.navigate(['/admin/dashboard']);
      },
      error: (err: any) => {
        this.cargando = false;
        const msg: string = err.error?.message || 'Error al iniciar sesión.';
        if (msg.toLowerCase().includes('incorrectos')) {
          this.errores.contrasena = 'Correo o contraseña incorrectos.';
          this.errores.correo     = ' ';
        } else {
          this.errorGeneral = msg;
        }
        this.cdr.detectChanges();
      }
    });
  }
}