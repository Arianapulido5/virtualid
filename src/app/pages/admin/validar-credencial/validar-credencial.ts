// src/app/pages/admin/validar-credencial/validar-credencial.ts
import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpClient, HttpHeaders, HttpClientModule } from '@angular/common/http';
import { SidebarAdminComponent } from '../../../shared/sidebar-admin/sidebar-admin';
import { environment } from '../../../../environments/environment';

interface VerifItem {
  label: string;
  resultado: string;
  tipo: 'ok' | 'warn' | 'err';
}

@Component({
  selector: 'app-validar-credencial',
  standalone: true,
  imports: [CommonModule, FormsModule, SidebarAdminComponent, HttpClientModule, RouterLink],
  templateUrl: './validar-credencial.html',
  styleUrls: ['./validar-credencial.scss']
})
export class ValidarCredencial implements OnInit {
  notas      = '';
  cargando   = true;
  procesando = false;

  // ── Modal confirmación ──
  confirmVisible = false;
  confirmTitulo  = '';
  confirmMensaje = '';
  private confirmCallback: (() => void) | null = null;

  // ── Modal resultado ──
  modalVisible = false;
  modalTitulo  = '';
  modalMensaje = '';
  modalTipo: 'exito' | 'error' = 'exito';
  private navegarAlCerrar = false;

  credencial: any = null;
  verificacion: VerifItem[] = [];

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

  // ── Modal confirmación ──
  private pedirConfirmacion(titulo: string, mensaje: string, accion: () => void): void {
    this.confirmTitulo   = titulo;
    this.confirmMensaje  = mensaje;
    this.confirmCallback = accion;
    this.confirmVisible  = true;
    this.cdr.detectChanges();
  }

  confirmarAccion(): void {
    this.confirmVisible = false;
    if (this.confirmCallback) {
      this.confirmCallback();
      this.confirmCallback = null;
    }
    this.cdr.detectChanges();
  }

  cancelarConfirmacion(): void {
    this.confirmVisible  = false;
    this.confirmCallback = null;
    this.cdr.detectChanges();
  }

  // ── Modal resultado ──
  private mostrarResultado(
    titulo: string,
    mensaje: string,
    tipo: 'exito' | 'error' = 'exito',
    navegar = false
  ): void {
    this.modalTitulo     = titulo;
    this.modalMensaje    = mensaje;
    this.modalTipo       = tipo;
    this.navegarAlCerrar = navegar;
    this.modalVisible    = true;
    this.cdr.detectChanges();
  }

  cerrarModal(): void {
    this.modalVisible = false;
    if (this.navegarAlCerrar) {
      this.router.navigate(['/admin/credenciales']);
    }
    this.cdr.detectChanges();
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;

    this.http.get<any>(`${this.apiBase}/admin/credenciales/${id}`, { headers: this.headers }).subscribe({
      next: (data) => {
        this.credencial = data;
        this.verificacion = [
          {
            label:     'Correo registrado',
            resultado: data.correo ? 'Verificado' : 'Sin correo',
            tipo:      data.correo ? 'ok' : 'warn'
          },
          {
            label:     'Número de ID registrado',
            resultado: data.numero_id ? 'Encontrado' : 'Sin número',
            tipo:      data.numero_id ? 'ok' : 'warn'
          },
          {
            label:     'Punto de acceso activo',
            resultado: 'Activo',
            tipo:      'ok'
          },
          {
            label:     'Usuario bloqueado',
            resultado: data.bloqueado ? 'Sí — cuenta bloqueada' : 'No',
            tipo:      data.bloqueado ? 'err' : 'ok'
          },
          {
            label:     'Estado de credencial',
            resultado: data.estado,
            tipo:      data.estado === 'pendiente' ? 'warn' : data.estado === 'activa' ? 'ok' : 'err'
          },
        ];
        this.cargando = false;
        this.cdr.detectChanges();
      },
      error: () => { this.router.navigate(['/admin/credenciales']); }
    });
  }

  // ── Aprobar ──
  aprobar(): void {
    if (this.procesando) return;
    this.pedirConfirmacion(
      'Aprobar credencial',
      `¿Estás seguro de que deseas aprobar esta credencial de tipo "${this.credencial?.tipo_usuario}"? Se notificará al usuario y quedará activa de inmediato.`,
      () => this.ejecutarAprobacion()
    );
  }

  private ejecutarAprobacion(): void {
    this.procesando = true;
    const id = this.route.snapshot.paramMap.get('id');

    this.http.put(
      `${this.apiBase}/admin/credenciales/${id}/aprobar`,
      {},
      { headers: this.headers }
    ).subscribe({
      next: () => {
        if (this.credencial) { this.credencial.estado = 'activa'; this.credencial.activa = true; }
        this.procesando = false;
        this.mostrarResultado(
          '¡Credencial aprobada!',
          'La credencial ha sido aprobada correctamente. Se envió una notificación al usuario.',
          'exito', true
        );
      },
      error: (err) => {
        this.procesando = false;
        this.mostrarResultado('Error al aprobar', err?.error?.message ?? 'No se pudo aprobar la credencial.', 'error');
      }
    });
  }

  // ── Revocar ──
  revocar(): void {
    if (this.procesando) return;
    this.pedirConfirmacion(
      'Rechazar / Revocar credencial',
      '¿Estás seguro de que deseas revocar esta credencial? Se notificará al usuario y no se puede deshacer.',
      () => this.ejecutarRevocacion()
    );
  }

  private ejecutarRevocacion(): void {
    this.procesando = true;
    const id = this.route.snapshot.paramMap.get('id');

    this.http.put(
      `${this.apiBase}/admin/credenciales/${id}/revocar`,
      { motivo: this.notas },
      { headers: this.headers }
    ).subscribe({
      next: () => {
        if (this.credencial) { this.credencial.estado = 'revocada'; this.credencial.activa = false; }
        this.procesando = false;
        this.mostrarResultado(
          'Credencial revocada',
          'La credencial ha sido revocada correctamente. Se envió una notificación al usuario.',
          'exito', true
        );
      },
      error: (err) => {
        this.procesando = false;
        this.mostrarResultado('Error al revocar', err?.error?.message ?? 'No se pudo revocar la credencial.', 'error');
      }
    });
  }

  // ── Rehabilitar ──
  rehabilitar(): void {
    if (this.procesando) return;
    this.pedirConfirmacion(
      'Rehabilitar credencial',
      `¿Estás seguro de que deseas rehabilitar esta credencial de tipo "${this.credencial?.tipo_usuario}"? Quedará activa de nuevo y se notificará al usuario.`,
      () => this.ejecutarRehabilitacion()
    );
  }

  private ejecutarRehabilitacion(): void {
    this.procesando = true;
    const id = this.route.snapshot.paramMap.get('id');

    this.http.put(
      `${this.apiBase}/admin/credenciales/${id}/rehabilitar`,
      {},
      { headers: this.headers }
    ).subscribe({
      next: () => {
        if (this.credencial) { this.credencial.estado = 'activa'; this.credencial.activa = true; }
        this.procesando = false;
        this.mostrarResultado(
          '¡Credencial rehabilitada!',
          'La credencial ha sido rehabilitada correctamente. Se envió una notificación al usuario.',
          'exito', true
        );
      },
      error: (err) => {
        this.procesando = false;
        this.mostrarResultado('Error al rehabilitar', err?.error?.message ?? 'No se pudo rehabilitar la credencial.', 'error');
      }
    });
  }
}