import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders, HttpClientModule } from '@angular/common/http';
import { Router } from '@angular/router';
import { SidebarAdminComponent } from '../../../shared/sidebar-admin/sidebar-admin';
import { environment } from '../../../../environments/environment';

interface Administrador {
  id: number;
  nombre: string;
  apellido_paterno: string;
  apellido_materno: string;
  correo: string;
  numero_empleado: string;
  creado_en: string;
  es_principal: boolean;
  iniciales: string;
  avatarColor: string;
}

const COLORES = ['purple', 'blue', 'teal', 'dark'];

@Component({
  selector: 'app-administradores',
  standalone: true,
  imports: [CommonModule, FormsModule, SidebarAdminComponent, HttpClientModule],
  templateUrl: './administradores.html',
  styleUrls: ['./administradores.scss']
})
export class Administradores implements OnInit {

  cargando   = true;
  procesando = false;
  admins: Administrador[] = [];
  miId = 0;

  confirmVisible = false;
  confirmTitulo  = '';
  confirmMensaje = '';
  private confirmCallback: (() => void) | null = null;

  modalVisible = false;
  modalTitulo  = '';
  modalMensaje = '';
  modalTipo: 'exito' | 'error' = 'exito';

  private apiBase = environment.apiUrl;

  constructor(
    private http: HttpClient,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  private get headers(): HttpHeaders {
    const token = localStorage.getItem('token') ?? '';
    return new HttpHeaders({ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' });
  }

  ngOnInit(): void {
    try {
      const payload = JSON.parse(atob((localStorage.getItem('token') ?? '').split('.')[1]));
      this.miId = payload.id ?? 0;
    } catch { this.miId = 0; }
    this.cargarAdmins();
  }

  cargarAdmins(): void {
    this.cargando = true;
    this.http.get<any[]>(`${this.apiBase}/admin/administradores`, { headers: this.headers }).subscribe({
      next: (rows) => {
        this.admins = rows.map((a, i) => ({
          ...a,
          iniciales:   (a.nombre.charAt(0) + a.apellido_paterno.charAt(0)).toUpperCase(),
          avatarColor: COLORES[i % COLORES.length]
        }));
        this.cargando = false;
        this.cdr.detectChanges();
      },
      error: () => { this.cargando = false; this.cdr.detectChanges(); }
    });
  }

  esMiCuenta(admin: Administrador): boolean { return admin.id === this.miId; }

  verDetalle(admin: Administrador): void {
    this.router.navigate(['/admin/administradores', admin.id]);
  }

  irAgregar(): void {
    this.router.navigate(['/admin/agregar-administrador']);
  }

  pedirEliminar(admin: Administrador): void {
    this.pedirConfirmacion(
      'Eliminar administrador',
      `¿Estás seguro de que deseas eliminar a ${admin.nombre} ${admin.apellido_paterno}? Perderá acceso al panel de forma permanente.`,
      () => this.ejecutarEliminar(admin.id)
    );
  }

  private ejecutarEliminar(id: number): void {
    this.procesando = true;
    this.http.delete(`${this.apiBase}/admin/administradores/${id}`, { headers: this.headers }).subscribe({
      next: () => {
        this.procesando = false;
        this.admins = this.admins.filter(a => a.id !== id);
        this.mostrarResultado('Administrador eliminado', 'El administrador ha sido eliminado y ya no tiene acceso al panel.', 'exito');
      },
      error: (err) => {
        this.procesando = false;
        this.mostrarResultado('Error al eliminar', err?.error?.message ?? 'No se pudo eliminar el administrador.', 'error');
      }
    });
  }

  private pedirConfirmacion(titulo: string, mensaje: string, accion: () => void): void {
    this.confirmTitulo = titulo; this.confirmMensaje = mensaje;
    this.confirmCallback = accion; this.confirmVisible = true;
    this.cdr.detectChanges();
  }

  confirmarAccion(): void {
    this.confirmVisible = false;
    if (this.confirmCallback) { this.confirmCallback(); this.confirmCallback = null; }
    this.cdr.detectChanges();
  }

  cancelarConfirmacion(): void {
    this.confirmVisible = false; this.confirmCallback = null;
    this.cdr.detectChanges();
  }

  private mostrarResultado(titulo: string, mensaje: string, tipo: 'exito' | 'error'): void {
    this.modalTitulo = titulo; this.modalMensaje = mensaje;
    this.modalTipo = tipo; this.modalVisible = true;
    this.cdr.detectChanges();
  }

  cerrarModal(): void { this.modalVisible = false; this.cdr.detectChanges(); }

  formatearFecha(fecha: string): string {
    return new Date(fecha).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
  }
}