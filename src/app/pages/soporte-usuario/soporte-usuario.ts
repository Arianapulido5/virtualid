import { Component, OnInit, ChangeDetectorRef, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../../environments/environment';

interface TicketApi {
  id: number;
  asunto: string;
  tipo: string;
  estado: string;
  creado_en: string;
  ultimo_mensaje_en: string;
  total_mensajes: number;
  visto_por_admin: boolean;
  tiene_respuesta_admin: boolean;
  mensajes_nuevos_admin: number;
}

interface MensajeApi {
  id: number;
  texto: string;
  es_admin: boolean;
  creado_en: string;
  nombre: string;
  apellido_paterno: string;
}

interface DetalleApi extends TicketApi {
  nombre: string;
  apellido_paterno: string;
  mensajes: MensajeApi[];
}

@Component({
  selector: 'app-soporte-usuario',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './soporte-usuario.html',
  styleUrls: ['./soporte-usuario.scss']
})
export class SoporteUsuario implements OnInit {

  @ViewChild('chatScroll') chatScroll!: ElementRef;

  vista: 'lista' | 'nuevo' | 'detalle' = 'lista';
  tickets: TicketApi[] = [];
  detalle: DetalleApi | null = null;

  cargando = true;
  enviando = false;
  mostrarModal = false;
  errorMsg = '';

  nuevoMsg = '';
  busqueda = '';

  filtroActivo: 'Todos' | 'Enviados' | 'Recibidos' | 'Abierto' | 'Resuelto' = 'Todos';

  form = { asunto: '', tipo: 'Otro', mensaje: '' };
  tipos = ['Credencial', 'Acceso', 'Cuenta', 'Otro'];

  private colores: Record<string, string> = {
    Credencial: '#4D0F60',
    Acceso: '#32488C',
    Cuenta: '#A93845',
    Otro: '#4A4D56'
  };

  constructor(
    private http: HttpClient,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.cargarTickets();
  }

  private headers(): HttpHeaders {
    return new HttpHeaders({
      Authorization: `Bearer ${localStorage.getItem('token') ?? ''}`
    });
  }

  cargarTickets(silencioso = false): void {
    if (!silencioso) this.cargando = true;

    this.http.get<TicketApi[]>(
      `${environment.apiUrl}/soporte/tickets/mis-tickets`,
      { headers: this.headers() }
    ).subscribe({
      next: (data) => {
        this.tickets = data;
        this.cargando = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.cargando = false;
        this.cdr.detectChanges();
      }
    });
  }

  get ticketsFiltrados(): TicketApi[] {
    let lista = [...this.tickets];
    switch (this.filtroActivo) {
      case 'Recibidos': lista = lista.filter(t => t.tiene_respuesta_admin && t.estado !== 'Resuelto'); break;
      case 'Abierto':   lista = lista.filter(t => t.visto_por_admin && t.estado !== 'Resuelto'); break;
      case 'Resuelto':  lista = lista.filter(t => t.estado === 'Resuelto'); break;
    }
    if (this.busqueda.trim()) {
      const q = this.busqueda.toLowerCase();
      lista = lista.filter(t => t.asunto.toLowerCase().includes(q) || t.tipo.toLowerCase().includes(q));
    }
    return lista;
  }

  cerrarModal(): void {
    this.mostrarModal = false;
    this.vista = 'lista';
    this.cdr.detectChanges();
  }

  volverALista(): void {
    this.detalle = null;
    this.vista = 'lista';
    this.cargarTickets(true);
    this.cdr.detectChanges();
  }

  abrirDetalle(ticket: TicketApi): void {
    const ticketEnLista = this.tickets.find(t => t.id === ticket.id);
    if (ticketEnLista) ticketEnLista.mensajes_nuevos_admin = 0;
    this.cdr.detectChanges();

    this.http.get<DetalleApi>(
      `${environment.apiUrl}/soporte/tickets/${ticket.id}`,
      { headers: this.headers() }
    ).subscribe({
      next: (data) => {
        if (ticketEnLista && ticketEnLista.estado === 'Nuevo') {
          ticketEnLista.estado = 'Abierto';
          ticketEnLista.visto_por_admin = true;
        }
        this.detalle = { ...data, mensajes_nuevos_admin: 0 };
        this.vista = 'detalle';
        this.cdr.detectChanges();
        this.scrollAlFinal();
      },
      error: () => {
        this.errorMsg = 'No se pudo cargar el ticket.';
        this.cdr.detectChanges();
      }
    });
  }

  crearTicket(): void {
    if (!this.form.asunto.trim() || !this.form.mensaje.trim()) {
      this.errorMsg = 'Asunto y mensaje son obligatorios.';
      return;
    }
    this.enviando = true;
    this.errorMsg = '';

    this.http.post<any>(
      `${environment.apiUrl}/soporte/tickets`,
      this.form,
      { headers: this.headers() }
    ).subscribe({
      next: () => {
        this.enviando = false;
        this.vista = 'lista';
        this.mostrarModal = true;
        this.form = { asunto: '', tipo: 'Otro', mensaje: '' };
        this.cargarTickets(true);
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.enviando = false;
        this.errorMsg = err.error?.message || 'Error al enviar el mensaje.';
        this.cdr.detectChanges();
      }
    });
  }

  enviarRespuesta(): void {
    if (!this.nuevoMsg.trim() || !this.detalle) return;
    const ticketActual = this.detalle;

    this.http.post<any>(
      `${environment.apiUrl}/soporte/tickets/${ticketActual.id}/mensajes`,
      { texto: this.nuevoMsg },
      { headers: this.headers() }
    ).subscribe({
      next: () => {
        this.nuevoMsg = '';
        this.abrirDetalle(ticketActual);
        this.scrollAlFinal();
      },
      error: () => {
        this.errorMsg = 'No se pudo enviar.';
        this.cdr.detectChanges();
      }
    });
  }

  scrollAlFinal(): void {
    setTimeout(() => {
      if (this.chatScroll) {
        const contenedor = this.chatScroll.nativeElement;
        contenedor.scrollTop = contenedor.scrollHeight;
      }
    }, 80);
  }

  labelEstado(t: { visto_por_admin: boolean; estado: string }): string {
    if (t.estado === 'Resuelto') return 'Resuelto';
    if (t.estado === 'En proceso') return 'En proceso';
    if (t.visto_por_admin) return 'Abierto';
    return 'Nuevo';
  }

  badgeClass(t: { visto_por_admin: boolean; estado: string }): string {
    const label = this.labelEstado(t);
    if (label === 'Nuevo') return 'badge--nuevo';
    if (label === 'Abierto') return 'badge--abierto';
    if (label === 'En proceso') return 'badge--proceso';
    if (label === 'Resuelto') return 'badge--resuelto';
    return '';
  }

  descripcionEstado(t: { visto_por_admin: boolean; estado: string }): string {
    const label = this.labelEstado(t);
    if (label === 'Nuevo') return 'Tu mensaje aún no ha sido visto por el administrador';
    if (label === 'Abierto') return 'El administrador vio tu mensaje, esperando respuesta';
    if (label === 'En proceso') return 'El administrador ha respondido';
    if (label === 'Resuelto') return 'Ticket cerrado';
    return '';
  }

  mensajeEmpty(): string {
    if (this.filtroActivo === 'Enviados') return 'No tienes mensajes enviados sin respuesta.';
    if (this.filtroActivo === 'Recibidos') return 'No tienes respuestas del administrador.';
    if (this.filtroActivo === 'Abierto') return 'No tienes mensajes abiertos.';
    if (this.filtroActivo === 'Resuelto') return 'No tienes mensajes resueltos.';
    return 'No tienes mensajes.';
  }

  colorTipo(tipo: string): string { return this.colores[tipo] ?? '#4A4D56'; }
  inicialTipo(tipo: string): string { return tipo.charAt(0).toUpperCase(); }

  fechaUltimoMensaje(fecha: string): string {
    if (!fecha) return '';
    const d = new Date(fecha);
    const hoy = new Date();
    if (d.toDateString() === hoy.toDateString()) {
      return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
  }

  tiempoRelativo(fecha: string): string {
    const diff = Math.floor((Date.now() - new Date(fecha).getTime()) / 1000);
    if (diff < 60) return 'hace unos seg';
    if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `hace ${Math.floor(diff / 3600)}h`;
    return `hace ${Math.floor(diff / 86400)}d`;
  }
}