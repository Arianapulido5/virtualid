// src/app/pages/login/login.ts
import { Component, ChangeDetectorRef, OnInit } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Auth } from '../../services/auth';
import { BiometricaService } from '../../services/biometrica.service';
import { PushService } from '../../services/push.service';
import { timeout, catchError } from 'rxjs/operators';
import { TimeoutError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [RouterLink, NgIf, FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login implements OnInit {
  showPassword = false;
  cargando     = false;
  correo       = '';
  contrasena   = '';
  errorGeneral = '';
  errores: { correo?: string; contrasena?: string } = {};

  // Biometría
  biometricaDisponible = false;  // el dispositivo soporta WebAuthn plataforma
  verificandoBio       = false;
  private api = environment.apiUrl;

  constructor(
    private authService: Auth,
    private router:      Router,
    private cdr:         ChangeDetectorRef,
    private pushService: PushService,
    private http:        HttpClient
  ) {}

  ngOnInit(): void {
    // Verificar si el dispositivo soporta WebAuthn
    BiometricaService.soportado().then((ok) => {
      this.biometricaDisponible = ok;
      this.cdr.detectChanges();
    });
  }

  togglePassword() { this.showPassword = !this.showPassword; }

  validarCorreo() {
    const v  = this.correo.trim();
    const re = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
    if (!v)               this.errores.correo = 'El correo es obligatorio.';
    else if (!re.test(v)) this.errores.correo = 'Ingresa un correo válido.';
    else                  this.errores.correo = undefined;
  }

  validarContrasena() {
    const v = this.contrasena;
    if (!v)                this.errores.contrasena = 'La contraseña es obligatoria.';
    else if (v.length < 8) this.errores.contrasena = 'Mínimo 8 caracteres.';
    else                   this.errores.contrasena = undefined;
  }

  private formularioValido(): boolean {
    this.validarCorreo();
    this.validarContrasena();
    return Object.values(this.errores).every((v) => v === undefined);
  }

  // ── LOGIN MANUAL ──────────────────────────────────────────────────────────

  iniciarSesion() {
    this.errorGeneral = '';
    if (!this.formularioValido()) return;

    this.cargando = true;
    this.cdr.detectChanges();

    this.authService
      .login(this.correo.trim(), this.contrasena)
      .pipe(
        timeout(30000),
        catchError((err) => {
          if (err instanceof TimeoutError) return throwError(() => ({ timedOut: true }));
          return throwError(() => err);
        })
      )
      .subscribe({
        next: (res: any) => {
          this.cargando = false;
          if (res.rol === 'admin') {
            this.errorGeneral =
              'Esta cuenta es de administrador. Usa el acceso de administrador.';
            this.cdr.detectChanges();
            return;
          }
          Auth.setToken(res.token);
          Auth.setRol(res.rol);
          this.cdr.detectChanges();
          this.router.navigate(['/dashboard']);
        },
        error: (err: any) => {
          this.cargando = false;
          if (err?.timedOut) {
            this.errorGeneral = 'El servidor tardó demasiado. Intenta de nuevo.';
          } else if (!navigator.onLine) {
            this.errorGeneral = 'Sin conexión a internet.';
          } else if (err.status === 0) {
            this.errorGeneral = 'No se pudo conectar al servidor.';
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
        },
      });
  }

  // ── LOGIN BIOMÉTRICO ──────────────────────────────────────────────────────
  // Cuando el usuario escribe su correo y pulsa "Acceder con biometría",
  // primero preguntamos al backend si tiene biometría activa. Si sí,
  // redirigimos a la pantalla de autenticación biométrica con el correo.

  // ── REEMPLAZA el método iniciarBiometria() en src/app/pages/login/login.ts ────
// El resto del archivo no cambia.

iniciarBiometria(): void {
  // Si el usuario ya escribió su correo, lo usamos directamente en la URL.
  // Si no, la pantalla de autenticación biométrica le pedirá el correo.
  const correo = this.correo.trim().toLowerCase();

  const queryParams: any = { modo: 'login' };
  if (correo && !this.errores.correo) {
    queryParams.correo = correo;
  }

  this.router.navigate(['/biometrica'], { queryParams });
}
}