// src/app/pages/login/login.ts
import { Component, ChangeDetectorRef } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Auth } from '../../services/auth';
import { PushService } from '../../services/push.service';
import { timeout, catchError } from 'rxjs/operators';
import { TimeoutError, throwError } from 'rxjs';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [RouterLink, NgIf, FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.scss'
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
    private router:      Router,
    private cdr:         ChangeDetectorRef,
    private pushService: PushService        // ← agregado
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

    this.authService.login(this.correo.trim(), this.contrasena)
      .pipe(
        timeout(30000),
        catchError(err => {
          if (err instanceof TimeoutError) {
            return throwError(() => ({ timedOut: true }));
          }
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

          // ── Registrar dispositivo para notificaciones push ──
          this.pushService.inicializar();

          this.cdr.detectChanges();
          this.router.navigate(['/dashboard']);
        },
        error: (err: any) => {
          this.cargando = false;

          if (err?.timedOut) {
            this.errorGeneral = 'El servidor tardó demasiado. Intenta de nuevo en unos segundos.';
          } else if (!navigator.onLine) {
            this.errorGeneral = 'Sin conexión a internet. Verifica tu red.';
          } else if (err.status === 0) {
            this.errorGeneral = 'No se pudo conectar al servidor. Intenta de nuevo.';
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
        }
      });
  }
}