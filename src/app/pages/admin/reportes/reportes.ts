import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { SidebarAdminComponent } from '../../../shared/sidebar-admin/sidebar-admin';
import { environment } from '../../../../environments/environment';

interface DiaSemana {
  dia:      string;
  valor:    number;
  esHoy:    boolean;
  esFuturo: boolean;
}

interface PuntoActivo {
  nombre: string;
  valor:  number;
}

interface ReportesData {
  total_accesos:   number;
  total_denegados: number;
  usuarios_unicos: number;
  por_dia:         { fecha: string; total: number }[];
  puntos_activos:  PuntoActivo[];
}

@Component({
  selector: 'app-reportes',
  standalone: true,
  imports: [CommonModule, FormsModule, SidebarAdminComponent],
  templateUrl: './reportes.html',
  styleUrls: ['./reportes.scss']
})
export class Reportes implements OnInit {

  cargando       = true;
  periodo        = 'semana';
  fechaInicio    = '';
  fechaFin       = '';
  errorFecha     = '';

  totalAccesos   = 0;
  totalDenegados = 0;
  usuariosUnicos = 0;
  diasSemana:    DiaSemana[]   = [];
  puntosActivos: PuntoActivo[] = [];

  constructor(private http: HttpClient, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.cargar();
  }

  private headers(): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${localStorage.getItem('token') ?? ''}` });
  }

  cambiarPeriodo(p: string): void {
    this.periodo     = p;
    this.fechaInicio = '';
    this.fechaFin    = '';
    this.errorFecha  = '';

    if (p === 'personalizado') {
      this.cargando = false;
      this.cdr.detectChanges();
      return;
    }

    this.cargar();
  }

  aplicarPersonalizado(): void {
    this.errorFecha = '';

    if (!this.fechaInicio || !this.fechaFin) {
      this.errorFecha = 'Selecciona ambas fechas.';
      return;
    }
    if (new Date(this.fechaInicio) > new Date(this.fechaFin)) {
      this.errorFecha = 'La fecha de inicio no puede ser mayor a la fecha fin.';
      return;
    }

    this.cargar();
  }

  cargar(): void {
    this.cargando = true;
    this.cdr.detectChanges();

    let url = `${environment.apiUrl}/admin/reportes?periodo=${this.periodo}`;
    if (this.periodo === 'personalizado' && this.fechaInicio && this.fechaFin) {
      url = `${environment.apiUrl}/admin/reportes?fecha_inicio=${this.fechaInicio}&fecha_fin=${this.fechaFin}`;
    }

    this.http.get<ReportesData>(url, { headers: this.headers() }).subscribe({
      next: (data) => {
        this.totalAccesos   = data?.total_accesos   ?? 0;
        this.totalDenegados = data?.total_denegados ?? 0;
        this.usuariosUnicos = data?.usuarios_unicos ?? 0;
        this.puntosActivos  = data?.puntos_activos  ?? [];
        this.diasSemana     = this.construirDias(data?.por_dia ?? []);
        this.cargando       = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error cargando reportes:', err);
        this.totalAccesos   = 0;
        this.totalDenegados = 0;
        this.usuariosUnicos = 0;
        this.puntosActivos  = [];
        this.diasSemana     = this.construirDias([]);
        this.cargando       = false;
        this.cdr.detectChanges();
      }
    });
  }

  get maxValor(): number {
    return Math.max(...this.diasSemana.map(d => d.valor), 1);
  }

  get porcentajeDenegados(): string {
    if (!this.totalAccesos) return '0%';
    return ((this.totalDenegados / this.totalAccesos) * 100).toFixed(1) + '%';
  }

  get etiquetaPeriodo(): string {
    if (this.periodo === 'semana') return 'esta semana';
    if (this.periodo === 'mes')    return 'este mes';
    if (this.periodo === 'personalizado' && this.fechaInicio && this.fechaFin)
      return `${this.fechaInicio} → ${this.fechaFin}`;
    return '';
  }

  private construirDias(porDia: { fecha: string; total: number }[]): DiaSemana[] {
    const hoy    = new Date();
    const result: DiaSemana[] = [];

    if (this.periodo === 'personalizado' && this.fechaInicio && this.fechaFin) {
      const inicio = new Date(this.fechaInicio);
      const fin    = new Date(this.fechaFin);
      const diff   = Math.round((fin.getTime() - inicio.getTime()) / 86400000);
      const dias   = Math.min(diff + 1, 60);

      for (let i = 0; i < dias; i++) {
        const d = new Date(inicio);
        d.setDate(inicio.getDate() + i);
        const fechaStr   = d.toISOString().split('T')[0];
        const encontrado = porDia.find(p =>
          new Date(p.fecha).toISOString().split('T')[0] === fechaStr
        );
        result.push({
          dia:      d.getDate().toString(),
          valor:    encontrado ? encontrado.total : 0,
          esHoy:    d.toDateString() === hoy.toDateString(),
          esFuturo: false
        });
      }
      return result;
    }

    const dias = this.periodo === 'mes' ? 30 : 7;
    for (let i = dias - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(hoy.getDate() - i);
      const fechaStr   = d.toISOString().split('T')[0];
      const encontrado = porDia.find(p =>
        new Date(p.fecha).toISOString().split('T')[0] === fechaStr
      );
      result.push({
        dia:      this.periodo === 'mes'
                    ? d.getDate().toString()
                    : ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'][d.getDay()],
        valor:    encontrado ? encontrado.total : 0,
        esHoy:    i === 0,
        esFuturo: false
      });
    }
    return result;
  }
}