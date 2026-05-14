// src/app/pages/detalle-acceso-usuario/detalle-acceso-usuario.ts
import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient, HttpHeaders, HttpClientModule } from '@angular/common/http';
import { environment } from '../../../environments/environment';

interface AccesoDetalle {
  id:                 number;
  exitoso:            boolean;
  motivo_denegacion:  string | null;
  creado_en:          string;
  ip:                 string | null;
  punto_nombre:       string;
  punto_tipo:         string;
  institucion_nombre: string;
  ciudad:             string;
  estado:             string;
}

@Component({
  selector: 'app-detalle-acceso-usuario',
  standalone: true,
  imports: [CommonModule, HttpClientModule],
  templateUrl: './detalle-acceso-usuario.html',
  styleUrls: ['./detalle-acceso-usuario.scss']
})
export class DetalleAccesoUsuario implements OnInit {
  cargando = true;
  acceso: AccesoDetalle | null = null;

  private apiBase = environment.apiUrl;

  constructor(
    private route:  ActivatedRoute,
    private router: Router,
    private http:   HttpClient,
    private cdr:    ChangeDetectorRef
  ) {}

  private get headers(): HttpHeaders {
    const token = localStorage.getItem('token') ?? '';
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) { this.cargando = false; return; }

    this.http.get<AccesoDetalle[]>(
      `${this.apiBase}/historial`,
      { headers: this.headers }
    ).subscribe({
      next: (data) => {
        this.acceso  = data.find(a => a.id === +id) ?? null;
        this.cargando = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        if (err.status === 401 || err.status === 403) {
          this.router.navigate(['/login']);
          return;
        }
        this.cargando = false;
        this.cdr.detectChanges();
      }
    });
  }

  getTipoIcon(tipo: string): string {
    const map: Record<string, string> = {
      edificio:    '🏛',
      biblioteca:  '📚',
      laboratorio: '🔬',
      cafeteria:   '☕',
      deportiva:   '⚽',
      otro:        '📍'
    };
    return map[tipo] ?? '📍';
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
    const d   = new Date(fecha);
    const hoy = new Date();
    const ayer = new Date(); ayer.setDate(hoy.getDate() - 1);
    if (d.toDateString() === hoy.toDateString())  return 'Hoy';
    if (d.toDateString() === ayer.toDateString()) return 'Ayer';
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
  }

  formatFechaLarga(fecha: string): string {
    return new Date(fecha).toLocaleDateString('es-MX', {
      weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
    });
  }

  volver(): void {
    this.router.navigate(['/historial']);
  }
}