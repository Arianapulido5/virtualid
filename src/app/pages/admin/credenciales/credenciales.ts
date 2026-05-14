import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpClient, HttpHeaders, HttpClientModule } from '@angular/common/http';
import { SidebarAdminComponent } from '../../../shared/sidebar-admin/sidebar-admin';
import { environment } from '../../../../environments/environment';

interface Credencial {
  id: number;
  iniciales: string;
  avatarColor: string;
  nombre: string;
  correo: string;
  noId: string;
  tipo: string;
  estado: string;
  fecha: string;
  usuario_id: number;
  punto_nombre: string;
}

const COLORES = ['purple', 'blue', 'teal', 'dark', 'green'];

@Component({
  selector: 'app-credenciales',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, SidebarAdminComponent, HttpClientModule],
  templateUrl: './credenciales.html',
  styleUrls: ['./credenciales.scss']
})
export class Credenciales implements OnInit {
  busqueda     = '';
  filtroActivo = 'todas';
  paginaActual = 1;
  cargando     = true;

  credenciales: Credencial[] = [];

  private apiBase = environment.apiUrl;

  constructor(private http: HttpClient, private cdr: ChangeDetectorRef) {}

  private get headers(): HttpHeaders {
    const token = localStorage.getItem('token') ?? '';
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  ngOnInit(): void { this.cargar(); }

  cargar(): void {
    this.cargando = true;
    this.http.get<any[]>(`${this.apiBase}/admin/credenciales`, { headers: this.headers }).subscribe({
      next: (data) => {
        this.credenciales = data.map((c, i) => ({
          id:           c.id,
          iniciales:    c.nombre_completo.split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase(),
          avatarColor:  COLORES[i % COLORES.length],
          nombre:       c.nombre_completo,
          correo:       c.usuario_correo,
          noId:         c.numero_empleado,
          tipo:         c.tipo_usuario === 'empleado' ? 'Empleado' : 'Estudiante',
          estado:       this.mapEstado(c.estado),
          fecha:        new Date(c.creado_en).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }),
          usuario_id:   c.usuario_id,
          punto_nombre: c.punto_nombre
        }));
        this.cargando = false;
        this.cdr.detectChanges();
      },
      error: () => { this.cargando = false; this.cdr.detectChanges(); }
    });
  }

  private mapEstado(e: string): string {
    return ({ pendiente: 'Pendiente', activa: 'Activa', revocada: 'Revocada' } as Record<string, string>)[e] ?? 'Pendiente';
  }

  get totalCredenciales() { return this.credenciales.length; }

  buscar(): void {
    this.paginaActual = 1;
    this.cdr.detectChanges();
  }

  setFiltro(f: string): void { this.filtroActivo = f; this.paginaActual = 1; }

  credencialesFiltradas(): Credencial[] {
    let lista = this.credenciales;

    if (this.filtroActivo !== 'todas') {
      const map: Record<string, string> = {
        activas:    'Activa',
        pendientes: 'Pendiente',
        revocadas:  'Revocada'
      };
      lista = lista.filter(c => c.estado === map[this.filtroActivo]);
    }

    if (this.busqueda.trim()) {
      const q = this.busqueda.toLowerCase();
      lista = lista.filter(c =>
        c.nombre.toLowerCase().includes(q) ||
        c.noId.toLowerCase().includes(q)   ||
        c.correo.toLowerCase().includes(q)
      );
    }

    return lista;
  }
}