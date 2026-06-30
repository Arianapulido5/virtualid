import { Component, OnInit, ChangeDetectorRef, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';
import { SidebarAdminComponent } from '../../../shared/sidebar-admin/sidebar-admin';
import { PuntosAccesoService } from '../../../services/puntos-acceso';

@Component({
  selector: 'app-editar-punto-acceso',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule, SidebarAdminComponent],
  templateUrl: './editar-punto-acceso.html',
  styleUrls: ['./editar-punto-acceso.scss']
})
export class EditarPuntoAcceso implements OnInit {

  @ViewChild('dropdownRef') dropdownRef?: ElementRef<HTMLElement>;

  puntoId = 0;
  cargando  = true;
  guardando = false;
  exitoso   = false;
  error     = '';

  form = {
    nombre:              '',
    descripcion:         '',
    tipo:                'edificio',
    nivelAcceso:         'abierto',
    permite_estudiantes: false,
    permite_empleados:   false,
    hora_entrada:        '',
    hora_salida:         '',
    comida_inicio:       '',
    comida_fin:          '',
  };

  tipos = [
    { value: 'edificio',    label: 'Edificio',    icon: '\uD83C\uDFDB', color: 'blue'    },
    { value: 'biblioteca',  label: 'Biblioteca',  icon: '\uD83D\uDCDA', color: 'blue2'   },
    { value: 'laboratorio', label: 'Laboratorio', icon: '\uD83D\uDD2C', color: 'red'     },
    { value: 'cafeteria',   label: 'Cafetería',   icon: '\u2615',       color: 'orange'  },
    { value: 'deportiva',   label: 'Deportiva',   icon: '\u26BD',       color: 'green'   },
    { value: 'otro',        label: 'Otro',        icon: '\uD83D\uDCCD', color: 'default' },
  ];

  horas12  = Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0'));
  minutos  = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));
  periodos = ['a. m.', 'p. m.'];

  pickerAbierto: string | null = null;
  dropdownPos: { top: number; left: number } = { top: 0, left: 0 };

  temp: Record<string, { h: string; m: string; p: string }> = {
    entrada:       { h: '07', m: '00', p: 'a. m.' },
    salida:        { h: '08', m: '00', p: 'p. m.' },
    comida_inicio: { h: '01', m: '00', p: 'p. m.' },
    comida_fin:    { h: '02', m: '00', p: 'p. m.' },
  };

  campoMap: Record<string, 'hora_entrada' | 'hora_salida' | 'comida_inicio' | 'comida_fin'> = {
    entrada:       'hora_entrada',
    salida:        'hora_salida',
    comida_inicio: 'comida_inicio',
    comida_fin:    'comida_fin',
  };

  constructor(
    private route:   ActivatedRoute,
    private router:  Router,
    private service: PuntosAccesoService,
    private cdr:     ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.puntoId = parseInt(this.route.snapshot.paramMap.get('id') ?? '0');
    this.cargarPunto();
  }

  private cargarPunto(): void {
    this.service.getById(this.puntoId).subscribe({
      next: (p) => {
        // Normaliza "HH:mm:ss" → "HH:mm" que devuelve Postgres para TIME
        const norm = (t: string | null | undefined) =>
          t ? t.substring(0, 5) : '';

        this.form = {
          nombre:              p.nombre,
          descripcion:         p.descripcion ?? '',
          tipo:                p.tipo,
          nivelAcceso:         p.nivel_acceso,
          permite_estudiantes: p.permite_estudiantes,
          permite_empleados:   p.permite_empleados,
          hora_entrada:        norm(p.hora_entrada),
          hora_salida:         norm(p.hora_salida),
          comida_inicio:       norm(p.comida_inicio),
          comida_fin:          norm(p.comida_fin),
        };
        this.cargando = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.error    = 'No se pudo cargar el punto de acceso.';
        this.cargando = false;
        this.cdr.detectChanges();
      }
    });
  }

  // ── Picker de hora ─────────────────────────────────────────────────────────
  private parse24(hora24: string): { h: string; m: string; p: string } {
    const [hh, mm] = hora24.split(':').map(Number);
    const periodo = hh >= 12 ? 'p. m.' : 'a. m.';
    const h12 = hh % 12 === 0 ? 12 : hh % 12;
    return { h: h12.toString().padStart(2, '0'), m: mm.toString().padStart(2, '0'), p: periodo };
  }

  private build24(h: string, m: string, p: string): string {
    let hh = parseInt(h, 10) % 12;
    if (p === 'p. m.') hh += 12;
    return `${hh.toString().padStart(2, '0')}:${m}`;
  }

  formatHora12(hora24: string): string {
    if (!hora24) return '';
    const { h, m, p } = this.parse24(hora24);
    return `${h}:${m} ${p}`;
  }

  togglePicker(campo: string, event: MouseEvent): void {
    event.stopPropagation();
    if (this.pickerAbierto === campo) { this.pickerAbierto = null; return; }

    const valorActual = this.form[this.campoMap[campo]];
    this.temp[campo] = valorActual ? this.parse24(valorActual) : this.temp[campo];

    const btn  = event.currentTarget as HTMLElement;
    const rect = btn.getBoundingClientRect();
    this.dropdownPos   = { top: rect.bottom + 6, left: rect.left };
    this.pickerAbierto = campo;
    this.cdr.detectChanges();

    setTimeout(() => {
      if (!this.dropdownRef) return;
      const alto        = this.dropdownRef.nativeElement.offsetHeight;
      const espacioAbajo = window.innerHeight - rect.bottom;
      const top = espacioAbajo >= alto + 10
        ? rect.bottom + 6
        : Math.max(10, rect.top - alto - 6);
      this.dropdownPos = { top, left: rect.left };
      this.cdr.detectChanges();
    }, 0);
  }

  setTempHora(campo: string, h: string): void    { this.temp[campo].h = h; }
  setTempMin(campo: string, m: string): void      { this.temp[campo].m = m; }
  setTempPeriodo(campo: string, p: string): void  { this.temp[campo].p = p; }

  confirmarHora(campo: string): void {
    const { h, m, p } = this.temp[campo];
    this.form[this.campoMap[campo]] = this.build24(h, m, p);
    this.pickerAbierto = null;
  }

  cerrarPickers(): void { this.pickerAbierto = null; }

  tipoActivo()           { return this.tipos.find(t => t.value === this.form.tipo) ?? this.tipos[0]; }
  iconoActivo(): string  { return this.tipoActivo().icon; }
  colorPreview(): string { return this.tipoActivo().color; }

  // ── Validación ─────────────────────────────────────────────────────────────
  errorHorario(): string {
    const { hora_entrada, hora_salida, comida_inicio, comida_fin } = this.form;
    if (!hora_entrada || !hora_salida) return 'Define hora de entrada y salida.';
    if (hora_entrada >= hora_salida)   return 'La entrada debe ser antes de la salida.';

    const hayInicio = !!comida_inicio;
    const hayFin    = !!comida_fin;
    if (hayInicio !== hayFin)
      return 'Completa inicio y fin de la hora de comida, o deja ambos vacíos.';
    if (hayInicio) {
      if (comida_inicio >= comida_fin)
        return 'El inicio de comida debe ser antes del fin.';
      if (comida_inicio < hora_entrada || comida_fin > hora_salida)
        return 'La hora de comida debe estar dentro del horario de entrada/salida.';
    }
    return '';
  }

  estadoPreview(): { texto: string; clase: string } {
    if (this.errorHorario()) return { texto: 'Horario incompleto', clase: 'estado-error' };
    const ahora = new Date().toLocaleTimeString('en-GB', {
      hour: '2-digit', minute: '2-digit', hour12: false
    });
    const { hora_entrada, hora_salida, comida_inicio, comida_fin } = this.form;
    if (ahora < hora_entrada || ahora >= hora_salida)
      return { texto: 'Cerrado (fuera de horario)', clase: 'estado-cerrado' };
    if (comida_inicio && comida_fin && ahora >= comida_inicio && ahora < comida_fin)
      return { texto: 'Cerrado (hora de comida)', clase: 'estado-comida' };
    return { texto: 'Abierto ahora', clase: 'estado-abierto' };
  }

  formularioValido(): boolean {
    return !!(
      this.form.nombre.trim() && this.form.tipo &&
      (this.form.permite_estudiantes || this.form.permite_empleados) &&
      !this.errorHorario()
    );
  }

  // ── Guardar ────────────────────────────────────────────────────────────────
  guardar(): void {
    if (!this.formularioValido() || this.guardando) return;
    this.guardando = true;
    this.error     = '';
    this.cdr.detectChanges();

    this.service.update(this.puntoId, {
      nombre:              this.form.nombre.trim(),
      descripcion:         this.form.descripcion.trim() || undefined,
      tipo:                this.form.tipo,
      nivel_acceso:        this.form.nivelAcceso,
      permite_estudiantes: this.form.permite_estudiantes,
      permite_empleados:   this.form.permite_empleados,
      horario_activo:      true,
      hora_entrada:        this.form.hora_entrada,
      hora_salida:         this.form.hora_salida,
      comida_inicio:       this.form.comida_inicio || undefined,
      comida_fin:          this.form.comida_fin    || undefined,
      activo:              true,
    }).subscribe({
      next: () => {
        this.guardando = false;
        this.exitoso   = true;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.error     = err?.error?.message ?? 'Error al guardar los cambios.';
        this.guardando = false;
        this.cdr.detectChanges();
      }
    });
  }

  volver(): void {
    this.router.navigate(['/admin/puntos-acceso', this.puntoId, 'historial']);
  }
}