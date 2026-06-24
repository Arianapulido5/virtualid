import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { SidebarAdminComponent } from '../../../shared/sidebar-admin/sidebar-admin';
import { environment } from '../../../../environments/environment';

interface DiaSemana {
  dia:            string;
  valor:          number;
  valorEntradas:  number;
  valorSalidas:   number;
  valorDenegados: number;
  esHoy:          boolean;
  esFuturo:       boolean;
}

interface PuntoActivo {
  nombre: string;
  valor:  number;
  id?:    number;
}

interface RegistroHoy {
  creado_en:       string;
  tipo_movimiento: string;
  exitoso:         boolean;
}

interface ReportesData {
  total_accesos:   number;
  total_denegados: number;
  total_salidas:   number;
  usuarios_unicos: number;
  por_dia:         { fecha: string; entradas: number; salidas: number; denegados: number }[];
  registros_hoy:   RegistroHoy[];
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
  periodo        = 'hoy';
  fechaInicio    = '';
  fechaFin       = '';
  errorFecha     = '';

  fechaSeleccionada: Date = new Date();
  semanaOffset           = 0;
  mesOffset              = 0;

  totalAccesos   = 0;
  totalDenegados = 0;
  totalSalidas   = 0;
  usuariosUnicos = 0;
  diasSemana:    DiaSemana[]   = [];
  puntosActivos: PuntoActivo[] = [];

  filtroActivo: 'total' | 'accesos' | 'salidas' | 'denegados' = 'total';

constructor(private http: HttpClient, private cdr: ChangeDetectorRef, private router: Router) {}
  ngOnInit(): void {
    this.cargar();
  }

  private headers(): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${localStorage.getItem('token') ?? ''}` });
  }

  private toLocalDateStr(d: Date): string {
    const y   = d.getFullYear();
    const m   = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  get esFechaHoy(): boolean {
    return this.fechaSeleccionada.toDateString() === new Date().toDateString();
  }

  get esSemanaActual(): boolean {
    return this.semanaOffset === 0;
  }

  get esMesActual(): boolean {
    return this.mesOffset === 0;
  }

  get totalMovimientos(): number {
    return this.totalAccesos + this.totalSalidas;
  }

  seleccionarFiltro(f: 'total' | 'accesos' | 'salidas' | 'denegados'): void {
    this.filtroActivo = f;
  }

  diaAnterior(): void {
    const nueva = new Date(this.fechaSeleccionada);
    nueva.setDate(nueva.getDate() - 1);
    this.fechaSeleccionada = nueva;
    this.cargar();
  }

  diaSiguiente(): void {
    if (this.esFechaHoy) return;
    const nueva = new Date(this.fechaSeleccionada);
    nueva.setDate(nueva.getDate() + 1);
    this.fechaSeleccionada = nueva;
    this.cargar();
  }

  semanaAnterior(): void {
    this.semanaOffset--;
    this.cargar();
  }

  semanaSiguiente(): void {
    if (this.esSemanaActual) return;
    this.semanaOffset++;
    this.cargar();
  }

  mesAnterior(): void {
    this.mesOffset--;
    this.cargar();
  }

  mesSiguiente(): void {
    if (this.esMesActual) return;
    this.mesOffset++;
    this.cargar();
  }

  cambiarPeriodo(p: string): void {
    this.periodo           = p;
    this.fechaInicio       = '';
    this.fechaFin          = '';
    this.errorFecha        = '';
    this.fechaSeleccionada = new Date();
    this.semanaOffset      = 0;
    this.mesOffset         = 0;
    this.filtroActivo      = 'total';

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

  private getFechasMes(): { inicio: string; fin: string } {
    const hoy    = new Date();
    const anio   = hoy.getFullYear();
    const mes    = hoy.getMonth() + this.mesOffset;
    const inicio = new Date(anio, mes, 1);
    const fin    = new Date(anio, mes + 1, 0);
    return {
      inicio: this.toLocalDateStr(inicio),
      fin:    this.toLocalDateStr(fin)
    };
  }

  private getDomingoSemana(): Date {
    const hoy    = new Date();
    const domingo = new Date(hoy);
    domingo.setDate(hoy.getDate() - hoy.getDay() + (this.semanaOffset * 7));
    return domingo;
  }

  cargar(): void {
    this.cargando = true;
    this.cdr.detectChanges();

    let url = `${environment.apiUrl}/admin/reportes?periodo=${this.periodo}`;

    if (this.periodo === 'personalizado' && this.fechaInicio && this.fechaFin) {
      url = `${environment.apiUrl}/admin/reportes?fecha_inicio=${this.fechaInicio}&fecha_fin=${this.fechaFin}`;
    } else if (this.periodo === 'hoy') {
      url += `&fecha=${this.toLocalDateStr(this.fechaSeleccionada)}`;
    } else if (this.periodo === 'semana') {
      url += `&semana_offset=${this.semanaOffset}`;
    } else if (this.periodo === 'mes') {
      const { inicio, fin } = this.getFechasMes();
      url = `${environment.apiUrl}/admin/reportes?fecha_inicio=${inicio}&fecha_fin=${fin}`;
    }

    this.http.get<ReportesData>(url, { headers: this.headers() }).subscribe({
      next: (data) => {
        this.totalAccesos   = data?.total_accesos   ?? 0;
        this.totalDenegados = data?.total_denegados ?? 0;
        this.totalSalidas   = data?.total_salidas   ?? 0;
        this.usuariosUnicos = data?.usuarios_unicos ?? 0;
        this.puntosActivos  = data?.puntos_activos  ?? [];
        this.diasSemana     = this.construirDias(data?.por_dia ?? [], data?.registros_hoy ?? []);
        this.cargando       = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error cargando reportes:', err);
        this.totalAccesos   = 0;
        this.totalDenegados = 0;
        this.totalSalidas   = 0;
        this.usuariosUnicos = 0;
        this.puntosActivos  = [];
        this.diasSemana     = this.construirDias([], []);
        this.cargando       = false;
        this.cdr.detectChanges();
      }
    });
  }

  get maxValor(): number {
    if (this.filtroActivo === 'accesos')   return Math.max(...this.diasSemana.map(d => d.valorEntradas),  10);
    if (this.filtroActivo === 'salidas')   return Math.max(...this.diasSemana.map(d => d.valorSalidas),   10);
    if (this.filtroActivo === 'denegados') return Math.max(...this.diasSemana.map(d => d.valorDenegados), 10);
    return Math.max(...this.diasSemana.map(d => d.valor), 10);
  }

  get porcentajeDenegados(): string {
    if (!this.totalAccesos) return '0%';
    return ((this.totalDenegados / this.totalAccesos) * 100).toFixed(1) + '%';
  }

  get etiquetaPeriodo(): string {
    if (this.periodo === 'hoy') {
      if (this.esFechaHoy) return 'Hoy';
      const ops: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' };
      return this.fechaSeleccionada.toLocaleDateString('es-MX', ops);
    }
    if (this.periodo === 'semana') return this.esSemanaActual ? 'Esta semana' : this.tituloGrafica;
    if (this.periodo === 'mes')    return this.tituloGrafica;
    if (this.periodo === 'personalizado' && this.fechaInicio && this.fechaFin) {
      const [iy, im, id] = this.fechaInicio.split('-').map(Number);
      const [fy, fm, fd] = this.fechaFin.split('-').map(Number);
      const dIni = new Date(iy, im - 1, id);
      const dFin = new Date(fy, fm - 1, fd);
      const mismoAnio = iy === fy;
      const opsIni: Intl.DateTimeFormatOptions = mismoAnio
        ? { day: 'numeric', month: 'long' }
        : { day: 'numeric', month: 'long', year: 'numeric' };
      const opsFin: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' };
      return `${dIni.toLocaleDateString('es-MX', opsIni)} – ${dFin.toLocaleDateString('es-MX', opsFin)}`;
    }
    return '';
  }

  get tituloGrafica(): string {
    if (this.periodo === 'hoy') {
      const opciones: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long' };
      const texto    = this.fechaSeleccionada.toLocaleDateString('es-MX', opciones);
      const textoCap = texto.charAt(0).toUpperCase() + texto.slice(1);
      return this.esFechaHoy ? `Hoy, ${texto}` : textoCap;
    }
    if (this.periodo === 'semana') {
      const domingo  = this.getDomingoSemana();
      const sabado   = new Date(domingo);
      sabado.setDate(domingo.getDate() + 6);
      const ops: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long' };
      const ini  = domingo.toLocaleDateString('es-MX', ops);
      const fin  = sabado.toLocaleDateString('es-MX', ops);
      const anio = sabado.getFullYear();
      return this.esSemanaActual
        ? `Esta semana, ${ini} – ${fin} ${anio}`
        : `${ini} – ${fin} ${anio}`;
    }
    if (this.periodo === 'mes') {
      const hoy   = new Date();
      const fecha = new Date(hoy.getFullYear(), hoy.getMonth() + this.mesOffset, 1);
      const ops: Intl.DateTimeFormatOptions = { month: 'long', year: 'numeric' };
      const texto = fecha.toLocaleDateString('es-MX', ops);
      return texto.charAt(0).toUpperCase() + texto.slice(1);
    }
    return this.periodo === 'personalizado' ? 'Accesos personalizados' : 'Accesos por día';
  }

  private construirDias(
    porDia:       { fecha: string; entradas: number; salidas: number; denegados: number }[],
    registrosHoy: RegistroHoy[]
  ): DiaSemana[] {
    const hoy    = new Date();
    const result: DiaSemana[] = [];

    if (this.periodo === 'hoy') {
      const esHoyReal  = this.esFechaHoy;
      const horaActual = hoy.getHours();

      const entradasPorHora  = new Array(24).fill(0);
      const salidasPorHora   = new Array(24).fill(0);
      const denegadosPorHora = new Array(24).fill(0);

      for (const r of registrosHoy) {
        const fechaMX = new Date(r.creado_en).toLocaleString('en-US', { timeZone: 'America/Mexico_City' });
        const h = new Date(fechaMX).getHours();
        if (h < 0 || h >= 24) continue;
        if (r.tipo_movimiento === 'salida') salidasPorHora[h]++;
        else entradasPorHora[h]++;
        if (r.exitoso === false) denegadosPorHora[h]++;
      }

      for (let h = 0; h < 24; h++) {
        result.push({
          dia:            h.toString().padStart(2, '0') + 'h',
          valor:          entradasPorHora[h] + salidasPorHora[h],
          valorEntradas:  entradasPorHora[h],
          valorSalidas:   salidasPorHora[h],
          valorDenegados: denegadosPorHora[h],
          esHoy:          esHoyReal && h === horaActual,
          esFuturo:       esHoyReal && h > horaActual
        });
      }
      return result;
    }

    if (this.periodo === 'semana') {
      const domingo = this.getDomingoSemana();

      for (let i = 0; i < 7; i++) {
        const d = new Date(domingo);
        d.setDate(domingo.getDate() + i);
        const fechaStr   = this.toLocalDateStr(d);
        const encontrado = porDia.find(p => {
        const fStr = typeof p.fecha === 'string'
            ? p.fecha.toString().split('T')[0]
            : this.toLocalDateStr(new Date(p.fecha));
          return fStr === fechaStr;
        });
        result.push({
          dia:            ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'][d.getDay()],
          valor:          encontrado ? (encontrado.entradas + encontrado.salidas) : 0,
          valorEntradas:  encontrado ? encontrado.entradas  : 0,
          valorSalidas:   encontrado ? encontrado.salidas   : 0,
          valorDenegados: encontrado ? encontrado.denegados : 0,
          esHoy:          d.toDateString() === hoy.toDateString(),
          esFuturo:       d > hoy
        });
      }
      return result;
    }

    if (this.periodo === 'mes') {
      const anio      = hoy.getFullYear();
      const mes       = hoy.getMonth() + this.mesOffset;
      const diasEnMes = new Date(anio, mes + 1, 0).getDate();

      for (let i = 0; i < diasEnMes; i++) {
        const d        = new Date(anio, mes, i + 1);
        const fechaStr = this.toLocalDateStr(d);
        const encontrado = porDia.find(p => {
        const fStr = typeof p.fecha === 'string'
          ? p.fecha.toString().split('T')[0]
          : this.toLocalDateStr(new Date(p.fecha));
        return fStr === fechaStr;
      });
        result.push({
          dia:            (i + 1).toString(),
          valor:          encontrado ? (encontrado.entradas + encontrado.salidas) : 0,
          valorEntradas:  encontrado ? encontrado.entradas  : 0,
          valorSalidas:   encontrado ? encontrado.salidas   : 0,
          valorDenegados: encontrado ? encontrado.denegados : 0,
          esHoy:          d.toDateString() === hoy.toDateString(),
          esFuturo:       d > hoy
        });
      }
      return result;
    }

    if (this.periodo === 'personalizado' && this.fechaInicio && this.fechaFin) {
      const [iy, im, id] = this.fechaInicio.split('-').map(Number);
      const [fy, fm, fd] = this.fechaFin.split('-').map(Number);
      const inicio = new Date(iy, im - 1, id);
      const fin    = new Date(fy, fm - 1, fd);
      const diff   = Math.round((fin.getTime() - inicio.getTime()) / 86400000);
      const dias   = Math.min(diff + 1, 60);

      for (let i = 0; i < dias; i++) {
        const d = new Date(inicio);
        d.setDate(inicio.getDate() + i);
        const fechaStr   = this.toLocalDateStr(d);        
        const encontrado = porDia.find(p => {
        const fStr = typeof p.fecha === 'string'
          ? p.fecha.toString().split('T')[0]
          : this.toLocalDateStr(new Date(p.fecha));
        return fStr === fechaStr;
      });

        result.push({
          dia:            d.getDate().toString(),
          valor:          encontrado ? (encontrado.entradas + encontrado.salidas) : 0,
          valorEntradas:  encontrado ? encontrado.entradas  : 0,
          valorSalidas:   encontrado ? encontrado.salidas   : 0,
          valorDenegados: encontrado ? encontrado.denegados : 0,
          esHoy:          d.toDateString() === hoy.toDateString(),
          esFuturo:       false
        });
      }
      return result;
    }

    return result;
  }

irAHistorialPunto(punto: PuntoActivo): void {
  if (!punto.id) return;
  this.router.navigate(['/admin/puntos-acceso', punto.id, 'historial']);
}
}