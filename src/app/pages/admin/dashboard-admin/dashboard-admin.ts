import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { SidebarAdminComponent } from '../../../shared/sidebar-admin/sidebar-admin';
import { environment } from '../../../../environments/environment';

interface ActividadItem {
  id?:               number;
  exitoso:           boolean;
  motivo_denegacion: string | null;
  creado_en:         string;
  nombre:            string;
  apellido_paterno:  string;
  punto_nombre:      string;
}

interface CredencialPendiente {
  id:               number;
  tipo_usuario:     string;
  creado_en:        string;
  nombre:           string;
  apellido_paterno: string;
  apellido_materno: string;
}

interface DashboardData {
  stats: {
    usuarios_activos:        number;
    credenciales_activas:    number;
    credenciales_pendientes: number;
    accesos_hoy:             number;
    accesos_exitosos_hoy:    number;
    accesos_denegados_hoy:   number;
    porcentaje_exitosos:     number;
  };
  actividad_reciente:      ActividadItem[];
  credenciales_pendientes: CredencialPendiente[];
}

const MAX_ACTIVIDAD = 5;

@Component({
  selector: 'app-dashboard-admin',
  standalone: true,
  imports: [CommonModule, SidebarAdminComponent],
  templateUrl: './dashboard-admin.html',
  styleUrls: ['./dashboard-admin.scss']
})
export class DashboardAdmin implements OnInit {

  cargando = true;

  stats = {
    usuarios_activos:        0,
    credenciales_activas:    0,
    credenciales_pendientes: 0,
    accesos_hoy:             0,
    accesos_exitosos_hoy:    0,
    accesos_denegados_hoy:   0,
    porcentaje_exitosos:     0
  };

  actividad:  ActividadItem[]       = [];
  pendientes: CredencialPendiente[] = [];

  constructor(
    private http: HttpClient,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void { this.cargar(); }

  private headers(): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${localStorage.getItem('token') ?? ''}` });
  }

  cargar(): void {
    this.cargando = true;
    this.http.get<DashboardData>(
      `${environment.apiUrl}/admin/dashboard`,
      { headers: this.headers() }
    ).subscribe({
      next: (data) => {
        this.stats      = data.stats;
        this.actividad  = data.actividad_reciente;
        this.pendientes = data.credenciales_pendientes;
        this.cargando   = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.cargando = false;
        this.cdr.detectChanges();
      }
    });
  }

  get actividadVisible(): ActividadItem[] {
    return this.actividad.slice(0, MAX_ACTIVIDAD);
  }

  irUsuarios(): void    { this.router.navigate(['/admin/usuarios']); }
  irCredenciales(): void { this.router.navigate(['/admin/credenciales']); }

  revisar(id: number): void { this.router.navigate(['/admin/credenciales', id, 'validar']); }
  verHistorial(): void { this.router.navigate(['/admin/historial-global']); }

  verDetalleAcceso(a: ActividadItem): void {
    if (a.id) this.router.navigate(['/admin/acceso', a.id]);
    else      this.router.navigate(['/admin/historial-global']);
  }

  iniciales(p: CredencialPendiente): string {
    return (p.nombre[0] + p.apellido_paterno[0]).toUpperCase();
  }

  avatarColor(index: number): string {
    return ['purple', 'teal', 'dark', 'blue'][index % 4];
  }

  nombreCompleto(p: CredencialPendiente): string {
    return `${p.nombre} ${p.apellido_paterno}`;
  }

  dotColor(a: ActividadItem): string { return a.exitoso ? 'green' : 'red'; }

  textoActividad(a: ActividadItem): string {
    const nombre = `${a.nombre} ${a.apellido_paterno}`;
    if (!a.exitoso) return `${nombre} — denegado en ${a.punto_nombre}`;
    return `${nombre} accedió a ${a.punto_nombre}`;
  }

  tiempoRelativo(fecha: string): string {
    const diff = Math.floor((Date.now() - new Date(fecha).getTime()) / 1000);
    if (diff < 60)    return 'Hace unos seg';
    if (diff < 3600)  return `Hace ${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `Hace ${Math.floor(diff / 3600)}h`;
    return `Hace ${Math.floor(diff / 86400)}d`;
  }
}