// agregar-punto-acceso.ts
import { Component, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';
import { SidebarAdminComponent } from '../../../shared/sidebar-admin/sidebar-admin';
import { PuntosAccesoService } from '../../../services/puntos-acceso';

@Component({
  selector: 'app-agregar-punto-acceso',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule, SidebarAdminComponent],
  templateUrl: './agregar-punto-acceso.html',
  styleUrls: ['./agregar-punto-acceso.scss']
})
export class AgregarPuntoAcceso {

  form = {
    nombre:              '',
    descripcion:         '',
    tipo:                'edificio',
    nivelAcceso:         'abierto',
    permite_estudiantes: true,
    permite_empleados:   true,
  };

  guardando = false;
  exitoso   = false;
  error     = '';

  tipos = [
    { value: 'edificio',    label: 'Edificio',    icon: '\uD83C\uDFDB', color: 'blue'    },
    { value: 'biblioteca',  label: 'Biblioteca',  icon: '\uD83D\uDCDA', color: 'blue2'   },
    { value: 'laboratorio', label: 'Laboratorio', icon: '\uD83D\uDD2C', color: 'red'     },
    { value: 'cafeteria',   label: 'Cafetería',   icon: '\u2615',       color: 'orange'  },
    { value: 'deportiva',   label: 'Deportiva',   icon: '\u26BD',       color: 'green'   },
    { value: 'otro',        label: 'Otro',        icon: '\uD83D\uDCCD', color: 'default' },
  ];

  constructor(
    private router:  Router,
    private service: PuntosAccesoService,
    private cdr:     ChangeDetectorRef
  ) {}

  tipoActivo()           { return this.tipos.find(t => t.value === this.form.tipo) ?? this.tipos[0]; }
  iconoActivo(): string  { return this.tipoActivo().icon;  }
  colorPreview(): string { return this.tipoActivo().color; }

  formularioValido(): boolean {
    return !!(this.form.nombre.trim() && this.form.tipo &&
              (this.form.permite_estudiantes || this.form.permite_empleados));
  }

  guardar(): void {
    if (!this.formularioValido() || this.guardando) return;
    this.guardando = true;
    this.error     = '';
    this.cdr.detectChanges();

    this.service.create({
      nombre:              this.form.nombre.trim(),
      descripcion:         this.form.descripcion.trim() || undefined,
      tipo:                this.form.tipo,
      nivel_acceso:        this.form.nivelAcceso,
      permite_estudiantes: this.form.permite_estudiantes,
      permite_empleados:   this.form.permite_empleados,
    }).subscribe({
      next: () => {
        this.guardando = false;
        this.exitoso   = true;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.error     = err?.error?.message ?? 'Error al guardar el punto de acceso.';
        this.guardando = false;
        this.cdr.detectChanges();
      }
    });
  }

  irAPuntos(): void { this.router.navigate(['/admin/puntos-acceso']); }
  cancelar():  void { this.router.navigate(['/admin/puntos-acceso']); }
}