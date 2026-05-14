import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpClient, HttpHeaders, HttpClientModule } from '@angular/common/http';
import { SidebarAdminComponent } from '../../../shared/sidebar-admin/sidebar-admin';
import { ModalMensajeComponent } from '../../../shared/modal-mensaje/modal-mensaje';
import { environment } from '../../../../environments/environment';

interface Credencial {
  id: number;
  tipo_usuario: string;
  estado: string;
  activa: boolean;
  creado_en: string;
  punto_nombre: string;
  punto_tipo: string;
}

@Component({
  selector: 'app-detalle-usuario',
  standalone: true,
  imports: [CommonModule, SidebarAdminComponent, HttpClientModule, ModalMensajeComponent, RouterLink],
  templateUrl: './detalle-usuario.html',
  styleUrls: ['./detalle-usuario.scss']
})
export class DetalleUsuario implements OnInit {
  cargando     = true;
  mostrarModal = false;
  procesando   = false;

  confirmVisible = false;
  confirmTitulo  = '';
  confirmMensaje = '';
  private confirmCallback: (() => void) | null = null;

  modalVisible = false;
  modalTitulo  = '';
  modalMensaje = '';
  modalTipo: 'exito' | 'error' = 'exito';
  private _redirigirAlCerrar = false;

  usuario: any = {
    id: 0, iniciales: '', avatarColor: 'purple',
    nombre: '', correo: '', tipo: '',
    noId: '', telefono: '—', fechaNacimiento: '—',
    ciudad: '—', bloqueado: false
  };

  credenciales: Credencial[] = [];

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

  private pedirConfirmacion(titulo: string, mensaje: string, accion: () => void): void {
    this.confirmTitulo   = titulo;
    this.confirmMensaje  = mensaje;
    this.confirmCallback = accion;
    this.confirmVisible  = true;
    this.cdr.detectChanges();
  }

  confirmarAccion(): void {
    this.confirmVisible = false;
    if (this.confirmCallback) { this.confirmCallback(); this.confirmCallback = null; }
    this.cdr.detectChanges();
  }

  cancelarConfirmacion(): void {
    this.confirmVisible  = false;
    this.confirmCallback = null;
    this.cdr.detectChanges();
  }

  private mostrarResultado(titulo: string, mensaje: string, tipo: 'exito' | 'error' = 'exito'): void {
    this.modalTitulo  = titulo;
    this.modalMensaje = mensaje;
    this.modalTipo    = tipo;
    this.modalVisible = true;
    this.cdr.detectChanges();
  }

  cerrarModal(): void {
    this.modalVisible = false;
    if (this._redirigirAlCerrar) {
      this._redirigirAlCerrar = false;
      this.router.navigate(['/admin/usuarios']);
    }
    this.cdr.detectChanges();
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;

    this.http.get<any>(`${this.apiBase}/admin/usuarios/${id}`, { headers: this.headers }).subscribe({
      next: (u) => {
        this.usuario = {
          id:              u.id,
          iniciales:       (u.nombre.charAt(0) + u.apellido_paterno.charAt(0)).toUpperCase(),
          avatarColor:     'purple',
          nombre:          `${u.nombre} ${u.apellido_paterno} ${u.apellido_materno}`,
          correo:          u.correo,
          tipo:            u.tipo === 'empleado' ? 'Empleado' : 'Estudiante',
          noId:            u.numero_empleado,
          telefono:        u.telefono || '—',
          fechaNacimiento: u.fecha_nacimiento
            ? new Date(u.fecha_nacimiento).toLocaleDateString('es-MX') : '—',
          ciudad:   u.ciudad && u.estado ? `${u.ciudad}, ${u.estado}` : (u.ciudad || '—'),
          bloqueado: u.bloqueado
        };
        this.cargando = false;
        this.cdr.detectChanges();
      },
      error: () => { this.router.navigate(['/admin/usuarios']); }
    });

    this.http.get<Credencial[]>(
      `${this.apiBase}/admin/usuarios/${id}/credenciales`,
      { headers: this.headers }
    ).subscribe({
      next: (data) => { this.credenciales = data; this.cdr.detectChanges(); },
      error: () => {}
    });
  }

  toggleBloqueo(): void {
    if (this.procesando) return;
    const titulo  = this.usuario.bloqueado ? 'Desbloquear usuario' : 'Bloquear usuario';
    const mensaje = this.usuario.bloqueado
      ? `¿Estás seguro de que deseas desbloquear a ${this.usuario.nombre}? Podrá volver a crear y usar sus credenciales.`
      : `¿Estás seguro de que deseas bloquear a ${this.usuario.nombre}? No podrá crear ni usar credenciales hasta que sea desbloqueado.`;
    this.pedirConfirmacion(titulo, mensaje, () => this.ejecutarBloqueo());
  }

  private ejecutarBloqueo(): void {
    this.procesando = true;
    this.http.put(
      `${this.apiBase}/admin/usuarios/${this.usuario.id}/bloquear`,
      {}, { headers: this.headers }
    ).subscribe({
      next: (res: any) => {
        this.usuario.bloqueado = res.bloqueado;
        this.procesando = false;
        this.mostrarResultado(
          res.bloqueado ? 'Usuario bloqueado' : 'Usuario desbloqueado',
          res.bloqueado
            ? `${this.usuario.nombre} ha sido bloqueado correctamente.`
            : `${this.usuario.nombre} ha sido desbloqueado correctamente.`,
          'exito'
        );
      },
      error: (err) => {
        this.procesando = false;
        this.mostrarResultado('Error al cambiar estado', err?.error?.message ?? 'No se pudo cambiar el estado.', 'error');
      }
    });
  }

  confirmarEliminar(): void {
    if (this.procesando) return;
    this.pedirConfirmacion(
      'Eliminar usuario',
      `¿Estás seguro de que deseas eliminar a ${this.usuario.nombre}? Esta acción es permanente.`,
      () => this.ejecutarEliminacion()
    );
  }

  private ejecutarEliminacion(): void {
    this.procesando = true;
    this.http.delete(
      `${this.apiBase}/admin/usuarios/${this.usuario.id}`,
      { headers: this.headers }
    ).subscribe({
      next: () => {
        this.procesando = false;
        this._redirigirAlCerrar = true;
        this.mostrarResultado('Usuario eliminado', `${this.usuario.nombre} ha sido eliminado correctamente.`, 'exito');
      },
      error: (err) => {
        this.procesando = false;
        this.mostrarResultado('Error al eliminar', err?.error?.message ?? 'No se pudo eliminar el usuario.', 'error');
      }
    });
  }

  revocarCredencial(credencialId: number): void {
    const cred = this.credenciales.find(x => x.id === credencialId);
    const nombre = cred?.punto_nombre ?? 'esta credencial';
    this.pedirConfirmacion(
      'Revocar credencial',
      `¿Estás seguro de que deseas revocar la credencial de "${nombre}"?`,
      () => this.ejecutarRevocacion(credencialId)
    );
  }

  private ejecutarRevocacion(credencialId: number): void {
    this.http.put(
      `${this.apiBase}/admin/credenciales/${credencialId}/revocar`,
      { motivo: 'Revocada por el administrador desde el panel de usuario.' },
      { headers: this.headers }
    ).subscribe({
      next: () => {
        const c = this.credenciales.find(x => x.id === credencialId);
        if (c) { c.estado = 'revocada'; c.activa = false; }
        this.mostrarResultado('Credencial revocada', 'La credencial ha sido revocada correctamente.', 'exito');
      },
      error: (err) => {
        this.mostrarResultado('Error al revocar', err?.error?.message ?? 'No se pudo revocar.', 'error');
      }
    });
  }

  rehabilitarCredencial(credencialId: number): void {
    const cred = this.credenciales.find(x => x.id === credencialId);
    const nombre = cred?.punto_nombre ?? 'esta credencial';
    this.pedirConfirmacion(
      'Rehabilitar credencial',
      `¿Estás seguro de que deseas rehabilitar la credencial de "${nombre}"?`,
      () => this.ejecutarRehabilitacion(credencialId)
    );
  }

  private ejecutarRehabilitacion(credencialId: number): void {
    this.http.put(
      `${this.apiBase}/admin/credenciales/${credencialId}/rehabilitar`,
      {}, { headers: this.headers }
    ).subscribe({
      next: () => {
        const c = this.credenciales.find(x => x.id === credencialId);
        if (c) { c.estado = 'activa'; c.activa = true; }
        this.mostrarResultado('Credencial rehabilitada', 'La credencial ha sido rehabilitada correctamente.', 'exito');
      },
      error: (err) => {
        this.mostrarResultado('Error al rehabilitar', err?.error?.message ?? 'No se pudo rehabilitar.', 'error');
      }
    });
  }

  abrirMensaje(): void { this.mostrarModal = true; }

  onMensajeEnviado(datos: any): void {
    this.http.post(
      `${this.apiBase}/mensajes`,
      { destinatario_id: this.usuario.id, tipo: datos.tipo, asunto: datos.asunto, mensaje: datos.mensaje },
      { headers: this.headers }
    ).subscribe({
      next: () => {
        this.mostrarResultado('Mensaje enviado', `Mensaje enviado correctamente a ${this.usuario.nombre}.`, 'exito');
      },
      error: () => {
        this.mostrarResultado('Error al enviar', 'No se pudo enviar el mensaje.', 'error');
      }
    });
  }

  onModalCerrado(): void { this.mostrarModal = false; }

  getTipoIcon(tipo: string): string {
    const map: Record<string, string> = {
      edificio: '🏛', biblioteca: '📚', laboratorio: '🔬',
      cafeteria: '☕', deportiva: '⚽', otro: '📍'
    };
    return map[tipo] ?? '📍';
  }

  getEstadoColor(estado: string): string {
    return ({ activa: '#2e7d32', pendiente: '#e65100', revocada: '#A93845' } as Record<string, string>)[estado] ?? '#4A4D56';
  }
}