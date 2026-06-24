import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { SidebarAdminComponent } from '../../../shared/sidebar-admin/sidebar-admin';
import { environment } from '../../../../environments/environment';

interface Registro {
  id:                number;
  exitoso:           boolean;
  motivo_denegacion: string | null;
  creado_en:         string;
  tipo_movimiento:   string;
  punto_id:          number;
  punto_nombre:      string;
  punto_tipo:        string;
}

interface PuntoFiltro { id: number; nombre: string; }

@Component({
  selector: 'app-historial-usuario',
  standalone: true,
  imports: [CommonModule, FormsModule, SidebarAdminComponent, RouterLink],
  templateUrl: './historial-usuario.html',
  styleUrls: ['./historial-usuario.scss']
})
export class HistorialUsuario implements OnInit {
  cargando = true;
  usuarioId = 0;
  nombreUsuario = '';
  backUrl = '';

  filtroPunto     = 'todos';
  filtroResultado = 'todos';
  filtroPeriodo   = 'todos';
  filtroFecha     = '';

  registros: Registro[]    = [];
  puntos:    PuntoFiltro[] = [];

  constructor(
    private http: HttpClient,
    private router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.usuarioId = parseInt(this.route.snapshot.paramMap.get('id') ?? '0');
    this.backUrl   = `/admin/usuarios/${this.usuarioId}`;
    this.cargar();
  }

  private headers(): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${localStorage.getItem('token') ?? ''}` });
  }

  cargar(): void {
    this.cargando = true;
    this.cdr.detectChanges();

    const params: Record<string, string> = {};
    if (this.filtroPeriodo === 'fecha' && this.filtroFecha) {
      params['fecha'] = this.filtroFecha;
    } else if (this.filtroPeriodo !== 'todos') {
      params['periodo'] = this.filtroPeriodo;
    }
    if (this.filtroPunto !== 'todos')     params['punto_id']  = this.filtroPunto;
    if (this.filtroResultado !== 'todos') params['resultado'] = this.filtroResultado;

    const query = new URLSearchParams(params).toString();
    const url   = `${environment.apiUrl}/historial/usuario/${this.usuarioId}${query ? '?' + query : ''}`;

    this.http.get<{ usuario: any; registros: Registro[]; puntos: PuntoFiltro[] }>(url, { headers: this.headers() })
      .subscribe({
        next: (data) => {
          const u = data.usuario;
          this.nombreUsuario = `${u.nombre} ${u.apellido_paterno} ${u.apellido_materno}`.trim();
          this.registros     = data.registros;
          this.puntos        = data.puntos;
          this.cargando      = false;
          this.cdr.detectChanges();
        },
        error: () => {
          this.cargando = false;
          this.router.navigate([`/admin/usuarios/${this.usuarioId}`]);
        }
      });
  }

  onFiltroChange(): void {
    if (this.filtroPeriodo !== 'fecha') { this.filtroFecha = ''; this.cargar(); }
  }

  onFechaChange(): void { if (this.filtroFecha) this.cargar(); }

  verDetalle(r: Registro): void { this.router.navigate(['/admin/acceso', r.id]); }

  puntoIcon(tipo: string): string {
    const map: Record<string, string> = {
      edificio: '🏛', biblioteca: '📚', laboratorio: '🔬',
      cafeteria: '☕', deportiva: '⚽', otro: '📍'
    };
    return map[tipo] ?? '📍';
  }

  formatFecha(fecha: string): string {
    const d = new Date(fecha), hoy = new Date(), ayer = new Date();
    ayer.setDate(hoy.getDate() - 1);
    const hora = d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
    if (d.toDateString() === hoy.toDateString())  return `Hoy, ${hora}`;
    if (d.toDateString() === ayer.toDateString()) return `Ayer, ${hora}`;
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }) + `, ${hora}`;
  }
}