import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient, HttpHeaders, HttpClientModule } from '@angular/common/http';
import { SidebarAdminComponent } from '../../../shared/sidebar-admin/sidebar-admin';
import { environment } from '../../../../environments/environment';

interface AccesoDetalle {
  id:                number;
  exitoso:           boolean;
  motivo_denegacion: string | null;
  creado_en:         string;
  nombre:            string;
  apellido_paterno:  string;
  apellido_materno:  string;
  correo:            string;
  tipo_usuario:      string;
  numero_id:         string | null;
  usuario_id:        number;
  punto_nombre:      string;
  punto_tipo:        string;
  institucion_nombre: string;
}

@Component({
  selector: 'app-detalle-acceso',
  standalone: true,
  imports: [CommonModule, SidebarAdminComponent, HttpClientModule],
  templateUrl: './detalle-acceso.html',
  styleUrls: ['./detalle-acceso.scss']
})
export class DetalleAcceso implements OnInit {
  cargando = true;
  acceso: AccesoDetalle | null = null;

  private apiBase = environment.apiUrl;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) {}

  private get headers(): HttpHeaders {
    const token = localStorage.getItem('token') ?? '';
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) { this.cargando = false; return; }

    this.http.get<AccesoDetalle>(
      `${this.apiBase}/historial/acceso/${id}`,
      { headers: this.headers }
    ).subscribe({
      next: (data) => {
        this.acceso  = data;
        this.cargando = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.cargando = false;
        this.cdr.detectChanges();
      }
    });
  }

  get nombreCompleto(): string {
    if (!this.acceso) return '';
    return `${this.acceso.nombre} ${this.acceso.apellido_paterno} ${this.acceso.apellido_materno ?? ''}`.trim();
  }

  get iniciales(): string {
    if (!this.acceso) return '';
    return (this.acceso.nombre[0] + this.acceso.apellido_paterno[0]).toUpperCase();
  }

  get avatarColor(): string {
    const colors = ['purple', 'blue', 'teal', 'dark', 'green'];
    if (!this.acceso) return 'purple';
    return colors[this.acceso.usuario_id % colors.length];
  }

  get puntoIcon(): string {
    const map: Record<string, string> = {
      edificio: '🏛', biblioteca: '📚', laboratorio: '🔬',
      cafeteria: '☕', deportiva: '⚽', otro: '📍'
    };
    return map[this.acceso?.punto_tipo ?? ''] ?? '📍';
  }

  formatFechaCompleta(fecha: string): string {
    return new Date(fecha).toLocaleString('es-MX', {
      weekday: 'long', day: '2-digit', month: 'long',
      year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  }

  formatFechaSola(fecha: string): string {
    return new Date(fecha).toLocaleDateString('es-MX', {
      weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
    });
  }

  formatHora(fecha: string): string {
    return new Date(fecha).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  }

  formatHoraExacta(fecha: string): string {
    return new Date(fecha).toLocaleTimeString('es-MX', {
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
  }

  formatDia(fecha: string): string {
    const d = new Date(fecha), hoy = new Date(), ayer = new Date();
    ayer.setDate(hoy.getDate() - 1);
    if (d.toDateString() === hoy.toDateString())  return 'Hoy';
    if (d.toDateString() === ayer.toDateString()) return 'Ayer';
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
  }

  volver(): void { this.router.navigate(['/admin/historial-global']); }

  verUsuario(): void {
    if (this.acceso?.usuario_id) this.router.navigate(['/admin/usuarios', this.acceso.usuario_id]);
  }
}