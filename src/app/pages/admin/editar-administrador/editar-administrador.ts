import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpClient, HttpHeaders, HttpClientModule } from '@angular/common/http';
import { SidebarAdminComponent } from '../../../shared/sidebar-admin/sidebar-admin';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-editar-administrador',
  standalone: true,
  imports: [CommonModule, FormsModule, SidebarAdminComponent, RouterLink, HttpClientModule],
  templateUrl: './editar-administrador.html',
  styleUrls: ['./editar-administrador.scss']
})
export class EditarAdministrador implements OnInit {

  cargandoDatos = true;
  cargando      = false;
  exitoso       = false;
  dominio       = '';
  miId          = 0;

  showActual  = false;
  showPass    = false;
  showConfirm = false;
  confirmar   = '';

  form = {
    nombre:            '',
    apellido_paterno:  '',
    apellido_materno:  '',
    correo:            '',
    contrasena_actual: '',
    contrasena:        ''
  };

  errores: { [k: string]: string | undefined } = {};
  errorMsg = '';

  private apiBase = environment.apiUrl;

  constructor(
    private http:   HttpClient,
    private router: Router,
    private cdr:    ChangeDetectorRef
  ) {}

  private get headers(): HttpHeaders {
    const token = localStorage.getItem('token') ?? '';
    return new HttpHeaders({ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' });
  }

  get tieneUpperCase() { return /[A-Z]/.test(this.form.contrasena); }
  get tieneLowerCase() { return /[a-z]/.test(this.form.contrasena); }
  get tieneNumero()    { return /[0-9]/.test(this.form.contrasena); }
  get tieneEspecial()  { return /[!@#$%^&*()\-_=+\[\]{};':"\\|,.<>/?]/.test(this.form.contrasena); }

  ngOnInit(): void {
    try {
      const payload = JSON.parse(atob((localStorage.getItem('token') ?? '').split('.')[1]));
      this.miId = payload.id ?? 0;
    } catch { this.miId = 0; }
    this.cargarDatos();
  }

  cargarDatos(): void {
    this.http.get<any>(`${this.apiBase}/admin/mi-cuenta`, { headers: this.headers }).subscribe({
      next: (data) => {
        this.form.nombre           = data.nombre           ?? '';
        this.form.apellido_paterno = data.apellido_paterno ?? '';
        this.form.apellido_materno = data.apellido_materno ?? '';
        this.form.correo           = data.correo           ?? '';

        this.http.get<any>(`${this.apiBase}/admin/mi-institucion`, { headers: this.headers }).subscribe({
          next: (inst) => {
            this.dominio       = inst.dominio_correo ?? '';
            this.cargandoDatos = false;
            this.cdr.detectChanges();
          },
          error: () => { this.cargandoDatos = false; this.cdr.detectChanges(); }
        });
      },
      error: () => { this.cargandoDatos = false; this.cdr.detectChanges(); }
    });
  }

  v = {
    nombre: () => {
      const val = this.form.nombre.trim();
      if (!val)                                this.errores['nombre'] = 'El nombre es obligatorio.';
      else if (!/^[a-zA-ZÀ-ÿ\s]+$/.test(val)) this.errores['nombre'] = 'Solo se permiten letras.';
      else if (val.length < 2)                 this.errores['nombre'] = 'Mínimo 2 caracteres.';
      else                                     this.errores['nombre'] = undefined;
    },
    apellido_paterno: () => {
      const val = this.form.apellido_paterno.trim();
      if (!val)                                this.errores['apellido_paterno'] = 'El apellido paterno es obligatorio.';
      else if (!/^[a-zA-ZÀ-ÿ\s]+$/.test(val)) this.errores['apellido_paterno'] = 'Solo se permiten letras.';
      else if (val.length < 2)                 this.errores['apellido_paterno'] = 'Mínimo 2 caracteres.';
      else                                     this.errores['apellido_paterno'] = undefined;
    },
    apellido_materno: () => {
      const val = this.form.apellido_materno.trim();
      if (!val)                                this.errores['apellido_materno'] = 'El apellido materno es obligatorio.';
      else if (!/^[a-zA-ZÀ-ÿ\s]+$/.test(val)) this.errores['apellido_materno'] = 'Solo se permiten letras.';
      else if (val.length < 2)                 this.errores['apellido_materno'] = 'Mínimo 2 caracteres.';
      else                                     this.errores['apellido_materno'] = undefined;
    },
    correo: () => {
      const val = this.form.correo.trim();
      const re  = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
      if (!val)               this.errores['correo'] = 'El correo es obligatorio.';
      else if (!re.test(val)) this.errores['correo'] = 'Ingresa un correo válido.';
      else if (this.dominio && !val.endsWith(this.dominio))
        this.errores['correo'] = `Debe pertenecer al dominio ${this.dominio}.`;
      else                    this.errores['correo'] = undefined;
    },
    contrasena_actual: () => {
      if (!this.form.contrasena) { this.errores['contrasena_actual'] = undefined; return; }
      this.errores['contrasena_actual'] = !this.form.contrasena_actual
        ? 'Ingresa tu contraseña actual para poder cambiarla.' : undefined;
    },
    contrasena: () => {
      const val = this.form.contrasena;
      if (!val) {
        this.errores['contrasena'] = this.errores['contrasena_actual'] = this.errores['confirmar'] = undefined;
        return;
      }
      if (val.length < 8)            this.errores['contrasena'] = 'Mínimo 8 caracteres.';
      else if (!this.tieneUpperCase) this.errores['contrasena'] = 'Debe incluir al menos una mayúscula.';
      else if (!this.tieneLowerCase) this.errores['contrasena'] = 'Debe incluir al menos una minúscula.';
      else if (!this.tieneNumero)    this.errores['contrasena'] = 'Debe incluir al menos un número.';
      else if (!this.tieneEspecial)  this.errores['contrasena'] = 'Debe incluir al menos un carácter especial.';
      else                           this.errores['contrasena'] = undefined;
      this.v.contrasena_actual();
      if (this.confirmar.length > 0) this.v.confirmar();
    },
    confirmar: () => {
      if (!this.form.contrasena) { this.errores['confirmar'] = undefined; return; }
      if (!this.confirmar)
        this.errores['confirmar'] = 'Confirma tu nueva contraseña.';
      else if (this.form.contrasena !== this.confirmar)
        this.errores['confirmar'] = 'Las contraseñas no coinciden.';
      else
        this.errores['confirmar'] = undefined;
    }
  };

  private validarTodo(): boolean {
    Object.values(this.v).forEach(fn => fn());
    return Object.values(this.errores).every(e => e === undefined);
  }

  guardar(): void {
    this.errorMsg = '';
    if (!this.validarTodo()) return;

    this.cargando = true;
    this.cdr.detectChanges();

    const payload: any = {
      nombre:           this.form.nombre.trim(),
      apellido_paterno: this.form.apellido_paterno.trim(),
      apellido_materno: this.form.apellido_materno.trim(),
      correo:           this.form.correo.trim().toLowerCase(),
    };

    if (this.form.contrasena) {
      payload.contrasena_actual = this.form.contrasena_actual;
      payload.contrasena        = this.form.contrasena;
    }

    this.http.put<any>(`${this.apiBase}/admin/mi-cuenta`, payload, { headers: this.headers }).subscribe({
      next: () => { this.cargando = false; this.exitoso = true; this.cdr.detectChanges(); },
      error: (err) => {
        this.cargando = false;
        this.errorMsg = err?.error?.message ?? 'No se pudo actualizar la información.';
        this.cdr.detectChanges();
      }
    });
  }

  irADetalle(): void { this.router.navigate(['/admin/administradores', this.miId]); }
  cancelar(): void   { this.router.navigate(['/admin/administradores', this.miId]); }
}