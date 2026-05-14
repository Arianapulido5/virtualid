import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders, HttpClientModule } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export interface Notificacion {
  id: number;
  nombre: string;
  iniciales: string;
  avatarColor: string;
  rol: string;
  hora: string;
  fecha: string;
  asunto: string;
  tipo: string;
  ticket: string;
  cuerpo: string;
  tiempoRelativo: string;
  autorCorto: string;
  leida: boolean;
  abierta: boolean;
}

interface MensajeApi {
  id: number;
  tipo: string;
  asunto: string;
  mensaje: string;
  leido: boolean;
  creado_en: string;
  remitente_nombre: string;
  remitente_apellido: string;
}

@Component({
  selector: 'app-mensajes',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  templateUrl: './mensajes.html',
  styleUrls: ['./mensajes.scss'],
})
export class Mensajes implements OnInit {
  searchQuery: string = '';
  tabActivo: string = 'todas';
  notificacionSeleccionada: Notificacion | null = null;

  notificaciones: Notificacion[] = [];
  notificacionesFiltradas: Notificacion[] = [];

  constructor(private http: HttpClient, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.cargarDesdeBD();
  }

  cargarDesdeBD(): void {
    const token = localStorage.getItem('token') ?? '';
    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });

    this.http
      .get<MensajeApi[]>(`${environment.apiUrl}/mensajes/mis-mensajes`, { headers })
      .subscribe({
        next: (data) => {
          this.notificaciones = data.map((m) => this.mapear(m));
          this.aplicarFiltros();
          this.cdr.detectChanges();
        },
        error: () => {
          this.notificaciones = [];
          this.notificacionesFiltradas = [];
          this.cdr.detectChanges();
        },
      });
  }

  private mapear(m: MensajeApi): Notificacion {
    const nombre = `${m.remitente_nombre} ${m.remitente_apellido}`;
    const iniciales = `${m.remitente_nombre.charAt(0)}${m.remitente_apellido.charAt(0)}`.toUpperCase();
    const fecha = new Date(m.creado_en);

    return {
      id:            m.id,
      nombre,
      iniciales,
      avatarColor:   '#4D0F60',
      rol:           'administrador',
      hora:          fecha.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
      fecha:         this.etiquetatFecha(fecha),
      asunto:        m.asunto,
      tipo:          m.tipo.charAt(0).toUpperCase() + m.tipo.slice(1),
      ticket:        `T-${String(m.id).padStart(4, '0')}`,
      cuerpo:        m.mensaje,
      tiempoRelativo: this.tiempoRelativo(fecha),
      autorCorto:    m.remitente_nombre,
      leida:         m.leido,
      abierta:       m.leido,
    };
  }

  private etiquetatFecha(d: Date): string {
    if (d.toDateString() === new Date().toDateString()) return 'Hoy';
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
  }

  private tiempoRelativo(d: Date): string {
    const diff = Math.floor((Date.now() - d.getTime()) / 60000);
    if (diff < 60)   return `${diff} min`;
    if (diff < 1440) return `${Math.floor(diff / 60)} horas`;
    return `${Math.floor(diff / 1440)} días`;
  }

  setTab(tab: string): void {
    this.tabActivo = tab;
    this.aplicarFiltros();
  }

  filtrarNotificaciones(): void {
    this.aplicarFiltros();
  }

  aplicarFiltros(): void {
    let resultado = [...this.notificaciones];

    if (this.tabActivo === 'sinLeer') {
      resultado = resultado.filter((n) => !n.leida);
    } else if (this.tabActivo === 'abiertos') {
      resultado = resultado.filter((n) => n.abierta);
    }

    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      resultado = resultado.filter(
        (n) =>
          n.nombre.toLowerCase().includes(q) ||
          n.asunto.toLowerCase().includes(q) ||
          n.cuerpo.toLowerCase().includes(q)
      );
    }

    this.notificacionesFiltradas = resultado;
  }

  abrirNotificacion(notif: Notificacion): void {
    notif.leida  = true;
    notif.abierta = true;
    this.notificacionSeleccionada = notif;

    const token   = localStorage.getItem('token') ?? '';
    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
    this.http
      .put(`${environment.apiUrl}/mensajes/${notif.id}/leido`, {}, { headers })
      .subscribe();
  }

  cerrarNotificacion(): void {
    this.notificacionSeleccionada = null;
    this.aplicarFiltros();
  }
}