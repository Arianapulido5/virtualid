// src/app/pages/informacion-personal/informacion-personal.ts
import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, AbstractControl } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { Auth, InfoPersonalData } from '../../services/auth';

const SEPOMEX_BASE = 'https://sepomex.nitrostudio.com.mx/api/20241009';

@Component({
  selector: 'app-informacion-personal',
  standalone: true,
  imports: [RouterLink, ReactiveFormsModule, CommonModule, HttpClientModule],
  templateUrl: './informacion-personal.html',
  styleUrls: ['./informacion-personal.scss']
})
export class InformacionPersonal implements OnInit {

  form!: FormGroup;
  cargando     = true;
  guardando    = false;
  cargandoCP   = false;
  mostrarModal = false;
  errorApi     = '';
  readonly hoy = new Date().toISOString().split('T')[0];

  // Listas para cascada
  ciudadesDelEstado:    string[] = [];
  municipiosDelCiudad:  string[] = [];
  coloniasDelMunicipio: string[] = [];

  private _estadoId    = '';
  private _municipioId = '';
  private _mapaCiudadMunicipios: Map<string, { id: string; nombre: string }[]> = new Map();
  private _mapaColonias: Map<string, string[]> = new Map();

  readonly estadosMexico = [
    'Aguascalientes','Baja California','Baja California Sur','Campeche',
    'Chiapas','Chihuahua','Ciudad de México','Coahuila','Colima','Durango',
    'Estado de México','Guanajuato','Guerrero','Hidalgo','Jalisco',
    'Michoacán','Morelos','Nayarit','Nuevo León','Oaxaca','Puebla',
    'Querétaro','Quintana Roo','San Luis Potosí','Sinaloa','Sonora',
    'Tabasco','Tamaulipas','Tlaxcala','Veracruz','Yucatán','Zacatecas'
  ];

  private readonly estadoIdMap: Record<string, string> = {
    'aguascalientes':     '01', 'baja california':     '02',
    'baja california sur':'03', 'campeche':            '04',
    'coahuila':           '05', 'colima':              '06',
    'chiapas':            '07', 'chihuahua':           '08',
    'ciudad de mexico':   '09', 'durango':             '10',
    'guanajuato':         '11', 'guerrero':            '12',
    'hidalgo':            '13', 'jalisco':             '14',
    'estado de mexico':   '15', 'michoacan':           '16',
    'morelos':            '17', 'nayarit':             '18',
    'nuevo leon':         '19', 'oaxaca':              '20',
    'puebla':             '21', 'queretaro':           '22',
    'quintana roo':       '23', 'san luis potosi':     '24',
    'sinaloa':            '25', 'sonora':              '26',
    'tabasco':            '27', 'tamaulipas':          '28',
    'tlaxcala':           '29', 'veracruz':            '30',
    'yucatan':            '31', 'zacatecas':           '32',
  };

  private readonly estadosNorm: Record<string, string> = {
    'veracruz de ignacio de la llave': 'Veracruz',
    'veracruz-llave':                  'Veracruz',
    'michoacan de ocampo':             'Michoacán',
    'coahuila de zaragoza':            'Coahuila',
    'san luis potosi':                 'San Luis Potosí',
    'nuevo leon':                      'Nuevo León',
    'queretaro':                       'Querétaro',
    'yucatan':                         'Yucatán',
    'mexico':                          'Estado de México',
    'estado de mexico':                'Estado de México',
    'ciudad de mexico':                'Ciudad de México',
    'distrito federal':                'Ciudad de México',
  };

  constructor(
    private fb:      FormBuilder,
    private router:  Router,
    private authSvc: Auth,
    private cdr:     ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.construirFormulario();
    this.cargarDatos();
  }

  private construirFormulario(): void {
    const soloLetras = /^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s'-]+$/;
    this.form = this.fb.group({
      nombre:           ['', [Validators.required, Validators.minLength(2), Validators.maxLength(80),  Validators.pattern(soloLetras)]],
      apellido_paterno: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(80),  Validators.pattern(soloLetras)]],
      apellido_materno: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(80),  Validators.pattern(soloLetras)]],
      correo:           ['', [Validators.required, Validators.email, Validators.maxLength(150)]],
      telefono:         ['', [Validators.pattern(/^\d{10}$/)]],
      fecha_nacimiento: ['', [this.validadorFechaAnterior]],
      codigo_postal:    ['', [Validators.pattern(/^\d{5}$/)]],
      estado:           [''],
      ciudad:           [''],
      municipio:        [''],
      colonia:          [''],
      direccion:        ['', [Validators.maxLength(255)]],
    });
  }

  private validadorFechaAnterior(control: AbstractControl) {
    if (!control.value) return null;
    const fecha = new Date(control.value);
    const hoy   = new Date();
    hoy.setHours(0, 0, 0, 0);
    return fecha < hoy ? null : { fechaFutura: true };
  }

  // ── Normalización ────────────────────────────────────────────────────────

  private normalizarEstado(raw: string): string {
    const lower = raw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    if (this.estadosNorm[lower]) return this.estadosNorm[lower];
    const match = this.estadosMexico.find(e => {
      const n = e.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return n === lower || lower.includes(n) || n.includes(lower);
    });
    return match ?? raw;
  }

  private estadoToId(estadoNombre: string): string {
    const key = estadoNombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    return this.estadoIdMap[key] ?? '';
  }

  // ── Carga de datos del usuario ───────────────────────────────────────────

  private cargarDatos(): void {
    this.cargando = true;
    this.errorApi = '';

    this.authSvc.obtenerInformacion().subscribe({
      next: async (info: InfoPersonalData) => {
        let fechaNac = '';
        if (info.fecha_nacimiento) {
          fechaNac = (info.fecha_nacimiento as string).includes('T')
            ? (info.fecha_nacimiento as string).split('T')[0]
            : (info.fecha_nacimiento as string);
        }

        // Parchar primero los campos simples
        this.form.patchValue({
          nombre:           info.nombre           ?? '',
          apellido_paterno: info.apellido_paterno  ?? '',
          apellido_materno: info.apellido_materno  ?? '',
          correo:           info.correo            ?? '',
          telefono:         info.telefono          ?? '',
          fecha_nacimiento: fechaNac,
          codigo_postal:    info.codigo_postal     ?? '',
          estado:           info.estado            ?? '',
          ciudad:           info.ciudad            ?? '',
          municipio:        info.municipio         ?? '',
          colonia:          info.colonia           ?? '',
          direccion:        info.direccion         ?? '',
        });

        // Si hay CP guardado, cargar listas de cascada sin sobreescribir valores
        if (info.codigo_postal && info.codigo_postal.length === 5) {
          await this._cargarCascadaDesdeCP(
            info.codigo_postal,
            info.ciudad    ?? '',
            info.municipio ?? '',
            info.colonia   ?? ''
          );
        }

        this.cargando = false;
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.cargando = false;
        this.cdr.detectChanges();
        if (err.status === 401 || err.status === 403) {
          localStorage.removeItem('token');
          this.router.navigate(['/login']);
        } else {
          this.errorApi = 'No se pudieron cargar tus datos. Intenta de nuevo.';
        }
      }
    });
  }

  // ── Código Postal — input del usuario ────────────────────────────────────

  onCodigoPostalInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    // Solo dígitos, máx 5
    let val = input.value.replace(/\D/g, '').slice(0, 5);
    input.value = val;
    this.form.get('codigo_postal')!.setValue(val, { emitEvent: false });

    if (val.length === 5) {
      this._limpiarGeo();
      this.cargandoCP = true;
      this.cdr.detectChanges();
      this._buscarCP(val, '', '', '');
    } else {
      this._limpiarGeo();
    }
  }

  // ── Cascada Ciudad → Municipio → Colonia ─────────────────────────────────

  async onCiudadChange(): Promise<void> {
    const ciudad = this.form.get('ciudad')!.value;
    this.form.patchValue({ municipio: '', colonia: '' });
    this.municipiosDelCiudad  = [];
    this.coloniasDelMunicipio = [];

    this._actualizarMunicipios(ciudad, '');
    const primerMunicipio = this.municipiosDelCiudad[0] ?? '';
    this.form.get('municipio')!.setValue(primerMunicipio);

    if (primerMunicipio) await this._cargarColonias(primerMunicipio);
    this.cdr.detectChanges();
  }

  async onMunicipioChange(): Promise<void> {
    const municipio = this.form.get('municipio')!.value;
    this.form.get('colonia')!.setValue('');
    this.coloniasDelMunicipio = [];
    await this._cargarColonias(municipio);
    this.cdr.detectChanges();
  }

  // ── SEPOMEX — carga al guardar/cargar datos existentes ───────────────────

  private async _cargarCascadaDesdeCP(
    cp: string,
    ciudadGuardada: string,
    municipioGuardado: string,
    coloniaGuardada: string
  ): Promise<void> {
    try {
      await this._buscarCP(cp, ciudadGuardada, municipioGuardado, coloniaGuardada);
    } catch (e) {
      console.warn('[IP] No se pudo cargar cascada del CP guardado:', e);
    }
  }

  private async _buscarCP(
    cp: string,
    ciudadPresel: string,
    municipioPresel: string,
    coloniaPresel: string
  ): Promise<void> {
    try {
      const resCP = await fetch(`${SEPOMEX_BASE}/cp/${cp}.json`, { headers: { Accept: 'application/json' } });
      if (!resCP.ok) throw new Error(`CP no encontrado (${resCP.status})`);

      const jsonCP      = await resCP.json();
      const postcodes: any[] = jsonCP?.data?.postcodes ?? [];
      if (!postcodes.length) throw new Error('Sin registros para CP ' + cp);

      const primero    = postcodes[0];
      const estadoRaw  = (primero.d_estado ?? '').trim();
      const estadoNorm = this.normalizarEstado(estadoRaw);
      const estadoId   = primero.c_estado ?? this.estadoToId(estadoNorm);

      const coloniasCP        = postcodes.map((p: any) => (p.d_asenta ?? '').trim()).filter(Boolean);
      const municipioNombreCP = (primero.d_mnpio ?? '').trim();
      const municipioIdCP     = (primero.c_mnpio  ?? '').trim();

      const resEstado = await fetch(`${SEPOMEX_BASE}/estado/${estadoId}.json`, { headers: { Accept: 'application/json' } });
      if (!resEstado.ok) throw new Error(`Estado no encontrado`);

      const jsonEstado             = await resEstado.json();
      const municipios: any[]      = jsonEstado?.data?.municipios ?? [];
      const postcodesEstado: any[] = jsonEstado?.data?.postcodes  ?? [];

      this._construirMapaCiudadMunicipios(postcodesEstado, municipios);

      // Ciudades del estado
      const ciudadesSet = new Set<string>();
      postcodesEstado.forEach((p: any) => { const c = (p.d_ciudad ?? '').trim(); if (c) ciudadesSet.add(c); });
      municipios.forEach((m: any) => { if (!ciudadesSet.has(m.d_mnpio)) ciudadesSet.add(m.d_mnpio); });
      this.ciudadesDelEstado = [...ciudadesSet].sort();

      this._estadoId = estadoId;

      // Ciudad del CP
      let ciudadCP = '';
      for (const p of postcodesEstado) {
        if ((p.c_mnpio ?? '') === municipioIdCP && (p.d_ciudad ?? '').trim()) {
          ciudadCP = p.d_ciudad.trim();
          break;
        }
      }
      if (!ciudadCP) ciudadCP = municipioNombreCP;

      // Usar valor guardado si existe, si no el del CP
      const ciudadFinal    = ciudadPresel    || ciudadCP;
      const municipioFinal = municipioPresel || municipioNombreCP;

      this._actualizarMunicipios(ciudadFinal, municipioFinal);

      // Colonias
      this._mapaColonias.set(municipioIdCP, coloniasCP.sort());
      this.coloniasDelMunicipio = [...new Set(coloniasCP)].sort();

      const coloniaFinal = coloniaPresel || (this.coloniasDelMunicipio[0] ?? '');

      // Parchamos solo los campos de cascada, sin tocar lo que ya estaba
      this.form.patchValue({
        estado:    this.form.get('estado')!.value || estadoNorm,
        ciudad:    ciudadFinal,
        municipio: municipioFinal,
        colonia:   coloniaFinal,
      });

      this.cargandoCP = false;
      this.cdr.detectChanges();

    } catch (e: any) {
      console.error('[CP] Error:', e);
      this.form.get('codigo_postal')!.setErrors({ cpInvalido: true });
      this.cargandoCP = false;
      this._limpiarGeo();
      this.cdr.detectChanges();
    }
  }

  private _construirMapaCiudadMunicipios(postcodes: any[], municipios: any[]) {
    this._mapaCiudadMunicipios.clear();
    const idToNombre = new Map<string, string>();
    municipios.forEach(m => idToNombre.set(m.c_mnpio, m.d_mnpio));

    postcodes.forEach((p: any) => {
      const ciudad = (p.d_ciudad ?? '').trim();
      const cMnpio = (p.c_mnpio  ?? '').trim();
      const dMnpio = (idToNombre.get(cMnpio) ?? p.d_mnpio ?? '').trim();
      if (!ciudad || !dMnpio) return;
      if (!this._mapaCiudadMunicipios.has(ciudad)) this._mapaCiudadMunicipios.set(ciudad, []);
      const lista = this._mapaCiudadMunicipios.get(ciudad)!;
      if (!lista.find(x => x.id === cMnpio)) lista.push({ id: cMnpio, nombre: dMnpio });
    });

    municipios.forEach(m => {
      if (!this._mapaCiudadMunicipios.has(m.d_mnpio))
        this._mapaCiudadMunicipios.set(m.d_mnpio, [{ id: m.c_mnpio, nombre: m.d_mnpio }]);
    });
  }

  private _actualizarMunicipios(ciudad: string, preseleccionar: string) {
    const lista = this._mapaCiudadMunicipios.get(ciudad) ?? [];
    this.municipiosDelCiudad = lista.map(x => x.nombre).sort();
    if (this.municipiosDelCiudad.length === 0 && ciudad) this.municipiosDelCiudad = [ciudad];
    if (preseleccionar && this.municipiosDelCiudad.includes(preseleccionar)) {
      this.form.get('municipio')!.setValue(preseleccionar, { emitEvent: false });
    } else {
      this.form.get('municipio')!.setValue(this.municipiosDelCiudad[0] ?? '', { emitEvent: false });
    }
  }

  private async _cargarColonias(municipioNombre: string): Promise<void> {
    let municipioId = '';
    for (const [, lista] of this._mapaCiudadMunicipios) {
      const found = lista.find(x => x.nombre === municipioNombre);
      if (found) { municipioId = found.id; break; }
    }
    if (!municipioId) { this.coloniasDelMunicipio = []; return; }

    this._municipioId = municipioId;

    if (this._mapaColonias.has(municipioId)) {
      this.coloniasDelMunicipio = this._mapaColonias.get(municipioId)!;
      this.form.get('colonia')!.setValue(this.coloniasDelMunicipio[0] ?? '');
      return;
    }

    try {
      this.cargandoCP = true;
      this.cdr.detectChanges();

      const url = `${SEPOMEX_BASE}/estado/${this._estadoId}/municipio/${municipioId}.json`;
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(`Municipio error ${res.status}`);

      const json     = await res.json();
      const posts: any[] = json?.data?.postcodes ?? [];
      const colonias = [...new Set<string>(posts.map((p: any) => (p.d_asenta ?? '').trim()).filter(Boolean))].sort();

      this._mapaColonias.set(municipioId, colonias);
      this.coloniasDelMunicipio = colonias;
      this.form.get('colonia')!.setValue(colonias[0] ?? '');

    } catch (e) {
      console.error('[Colonias] Error:', e);
      this.coloniasDelMunicipio = [];
    } finally {
      this.cargandoCP = false;
      this.cdr.detectChanges();
    }
  }

  private _limpiarGeo() {
    this.ciudadesDelEstado    = [];
    this.municipiosDelCiudad  = [];
    this.coloniasDelMunicipio = [];
    this._estadoId            = '';
    this._municipioId         = '';
    this._mapaCiudadMunicipios.clear();
    this._mapaColonias.clear();
    this.form.patchValue({ estado: '', ciudad: '', municipio: '', colonia: '' });
  }

  // ── Helpers del formulario ───────────────────────────────────────────────

  campo(nombre: string): AbstractControl { return this.form.get(nombre)!; }

  mostrarError(nombre: string): boolean {
    const c = this.campo(nombre);
    return c.invalid && (c.dirty || c.touched);
  }

  mensajeError(nombre: string): string {
    const c = this.campo(nombre);
    if (!c.errors) return '';
    if (c.errors['required'])    return 'Este campo es obligatorio.';
    if (c.errors['minlength'])   return `Mínimo ${c.errors['minlength'].requiredLength} caracteres.`;
    if (c.errors['maxlength'])   return `Máximo ${c.errors['maxlength'].requiredLength} caracteres.`;
    if (c.errors['email'])       return 'Ingresa un correo válido.';
    if (c.errors['cpInvalido'])  return 'No se encontró información para este CP.';
    if (c.errors['pattern']) {
      if (nombre === 'telefono')      return 'Debe tener exactamente 10 dígitos.';
      if (nombre === 'codigo_postal') return 'Debe tener exactamente 5 dígitos.';
      return 'Solo se permiten letras.';
    }
    if (c.errors['fechaFutura']) return 'La fecha debe ser anterior a hoy.';
    return '';
  }

  // ── Guardar ──────────────────────────────────────────────────────────────

  guardar(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    this.guardando = true;
    this.errorApi  = '';
    this.cdr.detectChanges();

    const v = this.form.value;
    const payload: InfoPersonalData = {
      nombre:           v.nombre.trim(),
      apellido_paterno: v.apellido_paterno.trim(),
      apellido_materno: v.apellido_materno.trim(),
      correo:           v.correo.trim().toLowerCase(),
    };
    if (v.telefono?.trim())      payload.telefono         = v.telefono.trim();
    if (v.direccion?.trim())     payload.direccion        = v.direccion.trim();
    if (v.ciudad?.trim())        payload.ciudad           = v.ciudad.trim();
    if (v.estado)                payload.estado           = v.estado;
    if (v.municipio?.trim())     payload.municipio        = v.municipio.trim();
    if (v.colonia?.trim())       payload.colonia          = v.colonia.trim();
    if (v.codigo_postal?.trim()) payload.codigo_postal    = v.codigo_postal.trim();
    if (v.fecha_nacimiento)      payload.fecha_nacimiento = v.fecha_nacimiento;

    this.authSvc.guardarInformacion(payload).subscribe({
      next: () => {
        this.guardando    = false;
        this.mostrarModal = true;
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.guardando = false;
        this.cdr.detectChanges();
        if (err.status === 401 || err.status === 403) {
          localStorage.removeItem('token');
          this.router.navigate(['/login']);
        } else if (err.status === 400 && err.error?.errores) {
          this.errorApi = err.error.errores.join(' ');
        } else if (err.status === 409) {
          this.errorApi = err.error?.message ?? 'Ese correo ya está en uso.';
        } else {
          this.errorApi = 'Error al guardar. Intenta de nuevo.';
        }
      }
    });
  }

irAConfiguracion(): void {
  this.router.navigate(['/configuracion'], { replaceUrl: true });
}
}