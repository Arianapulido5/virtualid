// src/app/pages/informacion-personal/informacion-personal.ts
import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, AbstractControl } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { Auth, InfoPersonalData } from '../../services/auth';

@Component({
  selector: 'app-informacion-personal',
  standalone: true,
  imports: [RouterLink, ReactiveFormsModule, CommonModule, HttpClientModule],
  templateUrl: './informacion-personal.html',
  styleUrls: ['./informacion-personal.scss']
})
export class InformacionPersonal implements OnInit {

  form!: FormGroup;
  cargando     = true;
  guardando    = false;
  mostrarModal = false;
  errorApi     = '';
  readonly hoy = new Date().toISOString().split('T')[0];

  readonly estadosMexico = [
    'Aguascalientes','Baja California','Baja California Sur','Campeche',
    'Chiapas','Chihuahua','Ciudad de México','Coahuila','Colima','Durango',
    'Estado de México','Guanajuato','Guerrero','Hidalgo','Jalisco',
    'Michoacán','Morelos','Nayarit','Nuevo León','Oaxaca','Puebla',
    'Querétaro','Quintana Roo','San Luis Potosí','Sinaloa','Sonora',
    'Tabasco','Tamaulipas','Tlaxcala','Veracruz','Yucatán','Zacatecas'
  ];

  constructor(
    private fb:      FormBuilder,
    private router:  Router,
    private authSvc: Auth,
    private cdr:     ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.construirFormulario();
    this.cargarDatos();
  }

  private construirFormulario(): void {
    const soloLetras = /^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s'-]+$/;
    this.form = this.fb.group({
      nombre:           ['', [Validators.required, Validators.minLength(2), Validators.maxLength(80),  Validators.pattern(soloLetras)]],
      apellido_paterno: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(80),  Validators.pattern(soloLetras)]],
      apellido_materno: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(80),  Validators.pattern(soloLetras)]],
      correo:           ['', [Validators.required, Validators.email, Validators.maxLength(150)]],
      telefono:         ['', [Validators.pattern(/^\d{10}$/)]],
      direccion:        ['', [Validators.maxLength(255)]],
      ciudad:           ['', [Validators.maxLength(100)]],
      estado:           [''],
      codigo_postal:    ['', [Validators.pattern(/^\d{5}$/)]],
      fecha_nacimiento: ['', [this.validadorFechaAnterior]]
    });
  }

  private validadorFechaAnterior(control: AbstractControl) {
    if (!control.value) return null;
    const fecha = new Date(control.value);
    const hoy   = new Date();
    hoy.setHours(0, 0, 0, 0);
    return fecha < hoy ? null : { fechaFutura: true };
  }

  private cargarDatos(): void {
    this.cargando = true;
    this.errorApi = '';

    this.authSvc.obtenerInformacion().subscribe({
      next: (info: InfoPersonalData) => {
        let fechaNac = '';
        if (info.fecha_nacimiento) {
          fechaNac = (info.fecha_nacimiento as string).includes('T')
            ? (info.fecha_nacimiento as string).split('T')[0]
            : (info.fecha_nacimiento as string);
        }
        this.form.patchValue({
          nombre:           info.nombre           ?? '',
          apellido_paterno: info.apellido_paterno  ?? '',
          apellido_materno: info.apellido_materno  ?? '',
          correo:           info.correo            ?? '',
          telefono:         info.telefono          ?? '',
          direccion:        info.direccion         ?? '',
          ciudad:           info.ciudad            ?? '',
          estado:           info.estado            ?? '',
          codigo_postal:    info.codigo_postal     ?? '',
          fecha_nacimiento: fechaNac
        });
        this.cargando = false;
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.cargando = false;
        this.cdr.detectChanges();
        if (err.status === 401 || err.status === 403) {
          localStorage.removeItem('token');
          this.router.navigate(['/login']);
        } else {
          this.errorApi = 'No se pudieron cargar tus datos. Intenta de nuevo.';
        }
      }
    });
  }

  campo(nombre: string): AbstractControl { return this.form.get(nombre)!; }

  mostrarError(nombre: string): boolean {
    const c = this.campo(nombre);
    return c.invalid && (c.dirty || c.touched);
  }

  mensajeError(nombre: string): string {
    const c = this.campo(nombre);
    if (!c.errors) return '';
    if (c.errors['required'])    return 'Este campo es obligatorio.';
    if (c.errors['minlength'])   return `Mínimo ${c.errors['minlength'].requiredLength} caracteres.`;
    if (c.errors['maxlength'])   return `Máximo ${c.errors['maxlength'].requiredLength} caracteres.`;
    if (c.errors['email'])       return 'Ingresa un correo válido.';
    if (c.errors['pattern']) {
      if (nombre === 'telefono')      return 'Debe tener exactamente 10 dígitos.';
      if (nombre === 'codigo_postal') return 'Debe tener exactamente 5 dígitos.';
      return 'Solo se permiten letras.';
    }
    if (c.errors['fechaFutura']) return 'La fecha debe ser anterior a hoy.';
    return '';
  }

  guardar(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    this.guardando = true;
    this.errorApi  = '';
    this.cdr.detectChanges();

    const v = this.form.value;
    const payload: InfoPersonalData = {
      nombre:           v.nombre.trim(),
      apellido_paterno: v.apellido_paterno.trim(),
      apellido_materno: v.apellido_materno.trim(),
      correo:           v.correo.trim().toLowerCase(),
    };
    if (v.telefono?.trim())      payload.telefono         = v.telefono.trim();
    if (v.direccion?.trim())     payload.direccion        = v.direccion.trim();
    if (v.ciudad?.trim())        payload.ciudad           = v.ciudad.trim();
    if (v.estado)                payload.estado           = v.estado;
    if (v.codigo_postal?.trim()) payload.codigo_postal    = v.codigo_postal.trim();
    if (v.fecha_nacimiento)      payload.fecha_nacimiento = v.fecha_nacimiento;

    this.authSvc.guardarInformacion(payload).subscribe({
      next: () => {
        this.guardando    = false;
        this.mostrarModal = true;
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.guardando = false;
        this.cdr.detectChanges();
        if (err.status === 401 || err.status === 403) {
          localStorage.removeItem('token');
          this.router.navigate(['/login']);
        } else if (err.status === 400 && err.error?.errores) {
          this.errorApi = err.error.errores.join(' ');
        } else if (err.status === 409) {
          this.errorApi = err.error?.message ?? 'Ese correo ya está en uso.';
        } else {
          this.errorApi = 'Error al guardar. Intenta de nuevo.';
        }
      }
    });
  }

  irAConfiguracion(): void {
    this.router.navigate(['/configuracion']);
  }
}