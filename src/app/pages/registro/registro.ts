// src/app/pages/registro/registro.ts
import { Component, ChangeDetectorRef } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { NgIf, CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Auth } from '../../services/auth';

@Component({
  selector: 'app-registro',
  standalone: true,
  imports: [RouterLink, NgIf, CommonModule, FormsModule],
  templateUrl: './registro.html',
  styleUrl: './registro.scss'
})
export class Registro {
  showPassword   = false;
  showConfirm    = false;
  cargando       = false;
  aceptaTerminos = false;
  mostrarModal   = false;
  mostrarModalError = false;      // ← NUEVO
  modalErrorTitulo  = '';         // ← NUEVO
  modalErrorMensaje = '';         // ← NUEVO

  nombre           = '';
  apellido_paterno = '';
  apellido_materno = '';
  correo           = '';
  numero_empleado  = '';
  tipo             = '';
  contrasena       = '';
  confirmar        = '';

  telefono         = '';
  direccion        = '';
  ciudad           = '';
  estado           = '';
  codigo_postal    = '';
  fecha_nacimiento = '';

  errorGeneral = '';

  readonly estadosMexico = [
    'Aguascalientes','Baja California','Baja California Sur','Campeche',
    'Chiapas','Chihuahua','Ciudad de México','Coahuila','Colima','Durango',
    'Estado de México','Guanajuato','Guerrero','Hidalgo','Jalisco',
    'Michoacán','Morelos','Nayarit','Nuevo León','Oaxaca','Puebla',
    'Querétaro','Quintana Roo','San Luis Potosí','Sinaloa','Sonora',
    'Tabasco','Tamaulipas','Tlaxcala','Veracruz','Yucatán','Zacatecas'
  ];

  readonly hoy = new Date().toISOString().split('T')[0];

  errores: {
    nombre?: string; apellido_paterno?: string; apellido_materno?: string;
    correo?: string; numero_empleado?: string; tipo?: string;
    contrasena?: string; confirmar?: string; terminos?: string;
    telefono?: string; codigo_postal?: string; fecha_nacimiento?: string;
  } = {};

  get tieneUpperCase() { return /[A-Z]/.test(this.contrasena); }
  get tieneNumero()    { return /[0-9]/.test(this.contrasena); }
  get tieneEspecial()  { return /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(this.contrasena); }

  constructor(private authService: Auth, private router: Router, private cdr: ChangeDetectorRef) {}

  togglePassword() { this.showPassword = !this.showPassword; }
  toggleConfirm()  { this.showConfirm  = !this.showConfirm;  }

  cerrarModalError() {
    this.mostrarModalError = false;
    this.cdr.detectChanges();
  }

  private mostrarError(titulo: string, mensaje: string) {
    this.modalErrorTitulo  = titulo;
    this.modalErrorMensaje = mensaje;
    this.mostrarModalError = true;
    this.cdr.detectChanges();
  }

  validarNombre() {
    const v = this.nombre.trim();
    if (!v)                                this.errores.nombre = 'El nombre es obligatorio.';
    else if (!/^[a-zA-ZÀ-ÿ\s]+$/.test(v)) this.errores.nombre = 'Solo se permiten letras.';
    else if (v.length < 2)                 this.errores.nombre = 'Mínimo 2 caracteres.';
    else                                   this.errores.nombre = undefined;
  }
  validarApellidoPaterno() {
    const v = this.apellido_paterno.trim();
    if (!v)                                this.errores.apellido_paterno = 'El apellido paterno es obligatorio.';
    else if (!/^[a-zA-ZÀ-ÿ\s]+$/.test(v)) this.errores.apellido_paterno = 'Solo se permiten letras.';
    else if (v.length < 2)                 this.errores.apellido_paterno = 'Mínimo 2 caracteres.';
    else                                   this.errores.apellido_paterno = undefined;
  }
  validarApellidoMaterno() {
    const v = this.apellido_materno.trim();
    if (!v)                                this.errores.apellido_materno = 'El apellido materno es obligatorio.';
    else if (!/^[a-zA-ZÀ-ÿ\s]+$/.test(v)) this.errores.apellido_materno = 'Solo se permiten letras.';
    else if (v.length < 2)                 this.errores.apellido_materno = 'Mínimo 2 caracteres.';
    else                                   this.errores.apellido_materno = undefined;
  }
  validarCorreo() {
    const v = this.correo.trim();
    const re = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
    if (!v)               this.errores.correo = 'El correo es obligatorio.';
    else if (!re.test(v)) this.errores.correo = 'Ingresa un correo válido.';
    else                  this.errores.correo = undefined;
  }
  validarNumeroEmpleado() {
    this.numero_empleado = this.numero_empleado.replace(/\D/g, '').slice(0, 10);
    const v = this.numero_empleado;
    if (!v)                   this.errores.numero_empleado = 'El número de empleado es obligatorio.';
    else if (v.length !== 10) this.errores.numero_empleado = `Debe tener exactamente 10 dígitos (${v.length}/10).`;
    else                      this.errores.numero_empleado = undefined;
  }
  validarTipo() {
    if (!this.tipo) this.errores.tipo = 'Selecciona si eres estudiante o empleado.';
    else            this.errores.tipo = undefined;
  }
  validarContrasena() {
    const v = this.contrasena;
    if (!v)                        this.errores.contrasena = 'La contraseña es obligatoria.';
    else if (v.length < 8)         this.errores.contrasena = 'Mínimo 8 caracteres.';
    else if (!this.tieneUpperCase) this.errores.contrasena = 'Debe incluir al menos una mayúscula.';
    else if (!this.tieneNumero)    this.errores.contrasena = 'Debe incluir al menos un número.';
    else if (!this.tieneEspecial)  this.errores.contrasena = 'Debe incluir al menos un carácter especial.';
    else                           this.errores.contrasena = undefined;
    if (this.confirmar.length > 0) this.validarConfirmar();
  }
  validarConfirmar() {
    if (!this.confirmar)                         this.errores.confirmar = 'Confirma tu contraseña.';
    else if (this.contrasena !== this.confirmar)  this.errores.confirmar = 'Las contraseñas no coinciden.';
    else                                         this.errores.confirmar = undefined;
  }
  validarTerminos() {
    if (!this.aceptaTerminos) this.errores.terminos = 'Debes aceptar los términos y condiciones.';
    else                      this.errores.terminos = undefined;
  }
  validarTelefono() {
    const v = this.telefono.replace(/\D/g, '').slice(0, 10);
    this.telefono = v;
    if (v && v.length !== 10) this.errores.telefono = 'Debe tener exactamente 10 dígitos.';
    else                      this.errores.telefono = undefined;
  }
  validarCodigoPostal() {
    const v = this.codigo_postal.replace(/\D/g, '').slice(0, 5);
    this.codigo_postal = v;
    if (v && v.length !== 5) this.errores.codigo_postal = 'Debe tener exactamente 5 dígitos.';
    else                     this.errores.codigo_postal = undefined;
  }
  validarFechaNacimiento() {
    if (!this.fecha_nacimiento) { this.errores.fecha_nacimiento = undefined; return; }
    const f = new Date(this.fecha_nacimiento);
    if (f >= new Date()) this.errores.fecha_nacimiento = 'La fecha debe ser anterior a hoy.';
    else                 this.errores.fecha_nacimiento = undefined;
  }

  private formularioValido(): boolean {
    this.validarNombre(); this.validarApellidoPaterno(); this.validarApellidoMaterno();
    this.validarCorreo(); this.validarNumeroEmpleado(); this.validarTipo();
    this.validarContrasena(); this.validarConfirmar(); this.validarTerminos();
    this.validarTelefono(); this.validarCodigoPostal(); this.validarFechaNacimiento();
    return Object.values(this.errores).every(v => v === undefined);
  }

  crearCuenta() {
    if (this.cargando) return;                          // ← evita doble submit
    this.errorGeneral = '';
    if (!this.formularioValido()) return;
    this.cargando = true;

    const datos: any = {
      nombre:           this.nombre.trim(),
      apellido_paterno: this.apellido_paterno.trim(),
      apellido_materno: this.apellido_materno.trim(),
      correo:           this.correo.trim().toLowerCase(),
      numero_empleado:  this.numero_empleado,
      contrasena:       this.contrasena,
      tipo:             this.tipo,
    };
    if (this.telefono)         datos.telefono         = this.telefono;
    if (this.direccion.trim()) datos.direccion        = this.direccion.trim();
    if (this.ciudad.trim())    datos.ciudad           = this.ciudad.trim();
    if (this.estado)           datos.estado           = this.estado;
    if (this.codigo_postal)    datos.codigo_postal    = this.codigo_postal;
    if (this.fecha_nacimiento) datos.fecha_nacimiento = this.fecha_nacimiento;

    this.authService.registro(datos).subscribe({
      next: () => {
        this.cargando = false;
        this.mostrarModal = true;
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.cargando = false;

        // Captura el mensaje sin importar la estructura que mande el backend
        const msg: string =
          err.error?.message ??
          err.error?.error   ??
          err.message        ??
          'Ocurrió un error inesperado. Intenta de nuevo.';

        const msgLower = msg.toLowerCase();

        if (err.status === 409) {
          // Conflicto: correo o número de empleado duplicado
          if (msgLower.includes('correo') || msgLower.includes('email')) {
            this.mostrarError(
              '¡Correo ya registrado!',
              'Este correo electrónico ya tiene una cuenta. Prueba con otro correo o inicia sesión.'
            );
          } else if (msgLower.includes('empleado') || msgLower.includes('numero') || msgLower.includes('número')) {
            this.mostrarError(
              '¡Número ya registrado!',
              'Este número de empleado/estudiante ya tiene una cuenta. Verifica el número e intenta de nuevo.'
            );
          } else {
            // 409 genérico — el mensaje del backend va directo al modal
            this.mostrarError('¡Usuario ya existe!', msg);
          }
        } else {
          // Cualquier otro error (500, red, etc.)
          this.mostrarError('Error al crear la cuenta', msg);
        }
      }
    });
  }

  irAlLogin() { this.router.navigate(['/login']); }
}