import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpClient, HttpHeaders, HttpClientModule } from '@angular/common/http';
import { SidebarAdminComponent } from '../../../shared/sidebar-admin/sidebar-admin';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-detalle-admin',
  standalone: true,
  imports: [CommonModule, SidebarAdminComponent, HttpClientModule, RouterLink],
  templateUrl: './detalle-admin.html',
  styleUrls: ['./detalle-admin.scss']
})
export class DetalleAdmin implements OnInit {

  cargando   = true;
  procesando = false;

  confirmVisible = false;
  confirmTitulo  = '';
  confirmMensaje = '';
  private confirmCallback: (() => void) | null = null;

  modalVisible = false;
  modalTitulo  = '';
  modalMensaje = '';
  modalTipo: 'exito' | 'error' = 'exito';
  private _redirigirAlCerrar   = false;

  admin: any = {
    id: 0, iniciales: '', avatarColor: 'purple',
    nombre: '', correo: '', noId: '',
    esPrincipal: false, creado_en: ''
  };

  miId = 0;

  private apiBase = environment.apiUrl;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient,
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

    const id = this.route.snapshot.paramMap.get('id');
    if (!id) { this.router.navigate(['/admin/administradores']); return; }

    this.http.get<any[]>(`${this.apiBase}/admin/administradores`, { headers: this.headers }).subscribe({
      next: (rows) => {
        const found = rows.find(a => a.id === parseInt(id));
        if (!found) { this.router.navigate(['/admin/administradores']); return; }

        this.admin = {
          id:          found.id,
          iniciales:   (found.nombre.charAt(0) + found.apellido_paterno.charAt(0)).toUpperCase(),
          avatarColor: this.colorPorId(found.id),
          nombre:      `${found.nombre} ${found.apellido_paterno} ${found.apellido_materno}`,
          correo:      found.correo,
          noId:        found.numero_empleado,
          esPrincipal: found.es_principal,
          creado_en:   found.creado_en
        };
        this.cargando = false;
        this.cdr.detectChanges();
      },
      error: () => { this.router.navigate(['/admin/administradores']); }
    });
  }

  private colorPorId(id: number): string {
    return ['purple', 'blue', 'teal', 'dark'][id % 4];
  }

  get esMiPropioDetalle(): boolean { return this.admin.id === this.miId; }

  irAEditar(): void { this.router.navigate(['/admin/editar-administrador']); }

  confirmarEliminar(): void {
    if (this.procesando || this.admin.esPrincipal || this.esMiPropioDetalle) return;
    this.pedirConfirmacion(
      'Eliminar administrador',
      `¿Estás seguro de que deseas eliminar a ${this.admin.nombre}? Perderá acceso al panel de administración de forma permanente.`,
      () => this.ejecutarEliminacion()
    );
  }

  private ejecutarEliminacion(): void {
    this.procesando = true;
    this.http.delete(
      `${this.apiBase}/admin/administradores/${this.admin.id}`,
      { headers: this.headers }
    ).subscribe({
      next: () => {
        this.procesando         = false;
        this._redirigirAlCerrar = true;
        this.mostrarResultado('Administrador eliminado', `${this.admin.nombre} ha sido eliminado del panel.`, 'exito');
      },
      error: (err) => {
        this.procesando = false;
        this.mostrarResultado('Error al eliminar', err?.error?.message ?? 'No se pudo eliminar.', 'error');
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

  cerrarModal(): void {
    this.modalVisible = false;
    if (this._redirigirAlCerrar) {
      this._redirigirAlCerrar = false;
      this.router.navigate(['/admin/administradores']);
    }
    this.cdr.detectChanges();
  }

  formatearFecha(fecha: string): string {
    return new Date(fecha).toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });
  }
}