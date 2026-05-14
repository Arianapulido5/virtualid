// src/app/pages/admin/soporte/soporte.ts
import { Component, OnInit, ChangeDetectorRef, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { SidebarAdminComponent } from '../../../shared/sidebar-admin/sidebar-admin';
import { environment } from '../../../../environments/environment';

interface MensajeApi {
  id: number; texto: string; es_admin: boolean;
  creado_en: string; nombre: string; apellido_paterno: string;
}
interface TicketApi {
  id: number; asunto: string; tipo: string; estado: string;
  creado_en: string; total_mensajes: number;
  usuario_id: number; nombre: string; apellido_paterno: string; apellido_materno: string;
  mensajes?: MensajeApi[];
  mensajes_nuevos_usuario: number;
}

@Component({
  selector: 'app-soporte',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, SidebarAdminComponent],
  templateUrl: './soporte.html',
  styleUrls: ['./soporte.scss']
})
export class Soporte implements OnInit {

  @ViewChild('chatScroll') chatScroll!: ElementRef;

  busqueda        = '';
  filtroActivo: 'En proceso' | 'Resueltos' | 'Todos' = 'Todos';
  ticketSeleccionado: TicketApi | null = null;
  nuevaRespuesta  = '';
  tickets: TicketApi[] = [];
  cargando = true;

  constructor(private http: HttpClient, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void { this.cargarTickets(); }

  private headers(): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${localStorage.getItem('token') ?? ''}` });
  }

  cargarTickets(): void {
    this.http.get<TicketApi[]>(`${environment.apiUrl}/soporte/tickets`, { headers: this.headers() })
      .subscribe({
        next: (data) => {
          this.tickets  = data;
          this.cargando = false;
          this.cdr.detectChanges();
        },
        error: () => { this.cargando = false; this.cdr.detectChanges(); }
      });
  }

  get abiertos():  number {
    return this.tickets.filter(t => t.estado === 'Nuevo' || t.estado === 'Abierto').length;
  }
  get enProceso(): number { return this.tickets.filter(t => t.estado === 'En proceso').length; }
  get resueltos(): number { return this.tickets.filter(t => t.estado === 'Resuelto').length; }

  get ticketsFiltrados(): TicketApi[] {
    let lista = [...this.tickets];
    if (this.filtroActivo === 'En proceso') lista = lista.filter(t => t.estado === 'En proceso');
    else if (this.filtroActivo === 'Resueltos') lista = lista.filter(t => t.estado === 'Resuelto');
    if (this.busqueda.trim()) {
      const q = this.busqueda.toLowerCase();
      lista = lista.filter(t =>
        `${t.nombre} ${t.apellido_paterno}`.toLowerCase().includes(q) ||
        t.asunto.toLowerCase().includes(q)
      );
    }
    return lista;
  }

  scrollAlFinal(): void {
    setTimeout(() => {
      if (this.chatScroll) {
        const el = this.chatScroll.nativeElement;
        el.scrollTop = el.scrollHeight;
      }
    }, 80);
  }

  seleccionarTicket(ticket: TicketApi): void {
    const t = this.tickets.find(t => t.id === ticket.id);
    if (t) t.mensajes_nuevos_usuario = 0;

    this.ticketSeleccionado = { ...ticket, mensajes: [], mensajes_nuevos_usuario: 0 };
    this.cdr.detectChanges();

    this.http.get<any>(
      `${environment.apiUrl}/soporte/tickets/${ticket.id}`,
      { headers: this.headers() }
    ).subscribe({
      next: (data: any) => {
        const tk = this.tickets.find(t => t.id === ticket.id);
        if (tk && tk.estado === 'Nuevo') tk.estado = 'Abierto';

        this.ticketSeleccionado = {
          ...ticket,
          estado: data.estado,
          mensajes: data.mensajes ?? [],
          mensajes_nuevos_usuario: 0
        };
        this.cdr.detectChanges();
        this.scrollAlFinal();
      },
      error: (err: any) => {
        console.error('Error cargando ticket:', err);
        this.cdr.detectChanges();
      }
    });
  }

  marcarResuelto(): void {
    if (!this.ticketSeleccionado) return;
    this.http.put<any>(
      `${environment.apiUrl}/soporte/tickets/${this.ticketSeleccionado.id}/resolver`,
      {},
      { headers: this.headers() }
    ).subscribe({
      next: () => {
        this.ticketSeleccionado!.estado = 'Resuelto';
        const t = this.tickets.find(t => t.id === this.ticketSeleccionado!.id);
        if (t) t.estado = 'Resuelto';
        this.cdr.detectChanges();
      }
    });
  }

  enviarRespuesta(): void {
    if (!this.nuevaRespuesta.trim() || !this.ticketSeleccionado) return;
    this.http.post<any>(
      `${environment.apiUrl}/soporte/tickets/${this.ticketSeleccionado.id}/mensajes`,
      { texto: this.nuevaRespuesta },
      { headers: this.headers() }
    ).subscribe({
      next: () => {
        this.nuevaRespuesta = '';
        const t = this.tickets.find(t => t.id === this.ticketSeleccionado!.id);
        if (t && (t.estado === 'Nuevo' || t.estado === 'Abierto')) t.estado = 'En proceso';
        this.seleccionarTicket(this.ticketSeleccionado!);
      }
    });
  }

  nombreCompleto(t: TicketApi): string {
    return `${t.nombre} ${t.apellido_paterno} ${t.apellido_materno ?? ''}`.trim();
  }

  tiempoRelativo(fecha: string): string {
    const diff = Math.floor((Date.now() - new Date(fecha).getTime()) / 1000);
    if (diff < 60)    return 'hace unos seg';
    if (diff < 3600)  return `hace ${Math.floor(diff/60)} min`;
    if (diff < 86400) return `hace ${Math.floor(diff/3600)}h`;
    return `hace ${Math.floor(diff/86400)}d`;
  }
}