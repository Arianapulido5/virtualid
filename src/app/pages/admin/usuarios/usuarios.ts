// src/app/pages/admin/usuarios/usuarios.ts
import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpClient, HttpHeaders, HttpClientModule } from '@angular/common/http';
import { SidebarAdminComponent } from '../../../shared/sidebar-admin/sidebar-admin';
import { environment } from '../../../../environments/environment';

interface Usuario {
  id: number;
  iniciales: string;
  avatarColor: string;
  nombre: string;
  correo: string;
  noId: string;
  tipo: string;
  ultimoAcceso: string;
}

const COLORES = ['purple', 'blue', 'teal', 'dark'];

@Component({
  selector: 'app-usuarios',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, SidebarAdminComponent, HttpClientModule],
  templateUrl: './usuarios.html',
  styleUrls: ['./usuarios.scss']
})
export class Usuarios implements OnInit {
  searchTerm   = '';
  filtroActivo = 'todos';
  cargando     = true;
  usuarios:          Usuario[] = [];
  usuariosFiltrados: Usuario[] = [];

  get totalUsuarios() { return this.usuarios.length; }

  constructor(private http: HttpClient, private cdr: ChangeDetectorRef) {}

  ngOnInit() { this.cargarUsuarios(); }

  formatearFecha(fecha: string | null): string {
    if (!fecha) return 'Sin accesos';
    return new Date(fecha).toLocaleString('es-MX', {
      day:    '2-digit',
      month:  '2-digit',
      year:   'numeric',
      hour:   '2-digit',
      minute: '2-digit'
    });
  }

  cargarUsuarios() {
    const token   = localStorage.getItem('token') ?? '';
    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });

    this.http.get<any[]>(`${environment.apiUrl}/admin/usuarios`, { headers }).subscribe({
      next: (rows) => {
        this.usuarios = rows.map((u, i) => ({
          id:           u.id,
          iniciales:    (u.nombre.charAt(0) + u.apellido_paterno.charAt(0)).toUpperCase(),
          avatarColor:  COLORES[i % COLORES.length],
          nombre:       `${u.nombre} ${u.apellido_paterno} ${u.apellido_materno}`,
          correo:       u.correo,
          noId:         u.numero_empleado,
          tipo:         u.tipo === 'empleado' ? 'Empleado' : 'Estudiante',
          ultimoAcceso: this.formatearFecha(u.ultimo_acceso)
        }));
        this.cargando = false;
        this.filtrar();
        this.cdr.detectChanges();
      },
      error: () => {
        this.cargando = false;
        this.cdr.detectChanges();
      }
    });
  }

  setFiltro(filtro: string) { this.filtroActivo = filtro; this.filtrar(); }

  filtrar() {
    let lista = [...this.usuarios];
    if (this.filtroActivo === 'estudiantes') lista = lista.filter(u => u.tipo === 'Estudiante');
    else if (this.filtroActivo === 'empleados') lista = lista.filter(u => u.tipo === 'Empleado');
    if (this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase();
      lista = lista.filter(u =>
        u.nombre.toLowerCase().includes(term) ||
        u.noId.toLowerCase().includes(term)   ||
        u.correo.toLowerCase().includes(term)
      );
    }
    this.usuariosFiltrados = lista;
  }
}