import { Component, ChangeDetectorRef, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { MapaSelectorComponent } from '../../../shared/mapa-selector/mapa-selector';
import { environment } from '../../../../environments/environment';

const SEPOMEX_BASE = 'https://sepomex.nitrostudio.com.mx/api/20241009';

@Component({
  selector: 'app-registro-institucion',
  standalone: true,
  imports: [CommonModule, FormsModule, MapaSelectorComponent],
  templateUrl: './registro-institucion.html',
  styleUrls: ['./registro-institucion.scss']
})
export class RegistroInstitucion implements OnDestroy {

  cargando     = false;
  mostrarModal = false;
  errorMsg     = '';
  confirmar    = '';
  showPassword = false;
  showConfirm  = false;

  mapaLat: number | null = null;
  mapaLng: number | null = null;

  private dominioTimer: any = null;
  verificandoDominio = false;

  codigo_postal    = '';
  estado           = '';
  ciudad           = '';
  municipio        = '';
  colonia          = '';
  direccion        = '';
  cargandoCP       = false;

  private _estadoId    = '';
  private _municipioId = '';
  ciudadesDelEstado:    string[] = [];
  municipiosDelCiudad:  string[] = [];
  coloniasDelMunicipio: string[] = [];
  private _mapaCiudadMunicipios: Map<string, { id: string; nombre: string }[]> = new Map();
  private _mapaColonias: Map<string, string[]> = new Map();

  @ViewChild(MapaSelectorComponent) mapaSelector?: MapaSelectorComponent;

  form = {
    nombre_institucion: '',
    tipo:               '',
    rfc:                '',
    dominio:            '',
    nombre:             '',
    apellido_paterno:   '',
    apellido_materno:   '',
    correo_admin:       '',
    contrasena:         '',
    latitud:            '' as string | number,
    longitud:           '' as string | number,
    radio_metros:       200
  };

  errores: { [key: string]: string | undefined } = {};

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

  get tieneUpperCase() { return /[A-Z]/.test(this.form.contrasena); }
  get tieneNumero()    { return /[0-9]/.test(this.form.contrasena); }
  get tieneEspecial()  { return /[!@#$%^&*()\-_=+\[\]{};':"\\|,.<>/?]/.test(this.form.contrasena); }

  constructor(
    private http: HttpClient,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnDestroy(): void {
    document.getElementById('hide-scrollbar-registro-inst')?.remove();
  }

  togglePassword() { this.showPassword = !this.showPassword; }
  toggleConfirm()  { this.showConfirm  = !this.showConfirm;  }

  // ── Mapa ──────────────────────────────────────────────────────────────────
  onCoordsChange(coords: { lat: number; lng: number } | null): void {
    if (coords) {
      this.form.latitud  = coords.lat;
      this.form.longitud = coords.lng;
      this.mapaLat = coords.lat;
      this.mapaLng = coords.lng;
      // No llamar _reverseGeocodeToAddress aquí porque mapa-selector
      // ya emite lugarChange con cp via reverseGeocode interno
    } else {
      this.form.latitud  = '';
      this.form.longitud = '';
      this.mapaLat = null;
      this.mapaLng = null;
    }
    this.cdr.detectChanges();
  }

  onLugarChange(lugar: { ciudad: string; estado: string; cp?: string } | null): void {
    if (!lugar) return;

    // Si viene CP desde el mapa, úsalo para llenar todo via SEPOMEX
    if (lugar.cp && lugar.cp.length === 5 && lugar.cp !== this.codigo_postal) {
      this.codigo_postal = lugar.cp;
      this._limpiarGeo();
      this.cargandoCP = true;
      this.cdr.detectChanges();
      this._buscarCP(lugar.cp);
      return;
    }

    // Si no hay CP, llenar ciudad y estado directo
    if (lugar.ciudad) this.ciudad = lugar.ciudad;
    if (lugar.estado) this.estado = lugar.estado;
    this.cdr.detectChanges();
  }

  // ── Código Postal ─────────────────────────────────────────────────────────
  validarCodigoPostal(): void {
    const v = this.codigo_postal.replace(/\D/g, '').slice(0, 5);
    this.codigo_postal = v;

    if (v && v.length !== 5) {
      this.errores['codigo_postal'] = 'Debe tener exactamente 5 dígitos.';
      this._limpiarGeo();
      return;
    }
    this.errores['codigo_postal'] = undefined;

    if (v.length === 5) {
      this.cargandoCP = true;
      this._limpiarGeo();
      this.cdr.detectChanges();
      this._buscarCP(v);
    }
  }

  private async _buscarCP(cp: string) {
    try {
      const resCP = await fetch(`${SEPOMEX_BASE}/cp/${cp}.json`, { headers: { Accept: 'application/json' } });
      if (!resCP.ok) throw new Error('CP no encontrado');
      const jsonCP = await resCP.json();
      const postcodes: any[] = jsonCP?.data?.postcodes ?? [];
      if (!postcodes.length) throw new Error('Sin registros para CP ' + cp);

      const primero        = postcodes[0];
      const estadoRaw      = (primero.d_estado ?? '').trim();
      const estadoNorm     = this.normalizarEstado(estadoRaw);
      const estadoId       = primero.c_estado ?? this.estadoToId(estadoNorm);
      const coloniasCP     = postcodes.map((p: any) => (p.d_asenta ?? '').trim()).filter(Boolean);
      const municipioNombreCP = (primero.d_mnpio ?? '').trim();
      const municipioIdCP     = (primero.c_mnpio  ?? '').trim();

      const resEstado = await fetch(`${SEPOMEX_BASE}/estado/${estadoId}.json`, { headers: { Accept: 'application/json' } });
      if (!resEstado.ok) throw new Error('Estado no encontrado');
      const jsonEstado = await resEstado.json();
      const municipios: any[]       = jsonEstado?.data?.municipios ?? [];
      const postcodesEstado: any[]  = jsonEstado?.data?.postcodes  ?? [];

      this._construirMapaCiudadMunicipios(postcodesEstado, municipios);

      const ciudadesSet = new Set<string>();
      postcodesEstado.forEach((p: any) => { const c = (p.d_ciudad ?? '').trim(); if (c) ciudadesSet.add(c); });
      municipios.forEach((m: any) => { if (!ciudadesSet.has(m.d_mnpio)) ciudadesSet.add(m.d_mnpio); });
      this.ciudadesDelEstado = [...ciudadesSet].sort();

      this._estadoId = estadoId;
      this.estado    = estadoNorm;

      let ciudadCP = '';
      for (const p of postcodesEstado) {
        if ((p.c_mnpio ?? '') === municipioIdCP && (p.d_ciudad ?? '').trim()) {
          ciudadCP = p.d_ciudad.trim();
          break;
        }
      }
      if (!ciudadCP) ciudadCP = municipioNombreCP;
      this.ciudad = ciudadCP;

      this._actualizarMunicipios(ciudadCP, municipioNombreCP);
      this.municipio    = municipioNombreCP;
      this._municipioId = municipioIdCP;

      this._mapaColonias.set(municipioIdCP, coloniasCP.sort());
      this.coloniasDelMunicipio = [...new Set(coloniasCP)].sort();
      this.colonia = this.coloniasDelMunicipio[0] ?? '';

      this.cargandoCP = false;
      this.cdr.detectChanges();

      // Mover el mapa a la ubicación del CP
      fetch(`https://nominatim.openstreetmap.org/search?postalcode=${cp}&country=MX&format=json&limit=1`)
        .then(r => r.json())
        .then(data => {
          if (data?.[0]) {
            const lat = parseFloat(parseFloat(data[0].lat).toFixed(7));
            const lng = parseFloat(parseFloat(data[0].lon).toFixed(7));
            this.mapaLat = lat;
            this.mapaLng = lng;
            this.form.latitud  = lat;
            this.form.longitud = lng;
            if (this.mapaSelector) this.mapaSelector.moverA(lat, lng);
            this.cdr.detectChanges();
          }
        })
        .catch(() => {});

    } catch (e) {
      this.errores['codigo_postal'] = 'No se encontró información para este CP.';
      this.cargandoCP = false;
      this._limpiarGeo();
      this.cdr.detectChanges();
    }
  }

  async onCiudadChange() {
    this.municipio = ''; this.colonia = '';
    this.municipiosDelCiudad = []; this.coloniasDelMunicipio = [];
    this._municipioId = '';
    this._actualizarMunicipios(this.ciudad, '');
    this.municipio = this.municipiosDelCiudad[0] ?? '';
    if (this.municipio) await this._cargarColonias(this.municipio);
    this.cdr.detectChanges();
  }

  async onMunicipioChange() {
    this.colonia = ''; this.coloniasDelMunicipio = [];
    await this._cargarColonias(this.municipio);
    this.cdr.detectChanges();
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
    if (!this.municipiosDelCiudad.length && ciudad) this.municipiosDelCiudad = [ciudad];
    this.municipio = (preseleccionar && this.municipiosDelCiudad.includes(preseleccionar))
      ? preseleccionar : (this.municipiosDelCiudad[0] ?? '');
  }

  private async _cargarColonias(municipioNombre: string) {
    let municipioId = '';
    for (const [, lista] of this._mapaCiudadMunicipios) {
      const found = lista.find(x => x.nombre === municipioNombre);
      if (found) { municipioId = found.id; break; }
    }
    if (!municipioId) { this.coloniasDelMunicipio = []; return; }
    this._municipioId = municipioId;
    if (this._mapaColonias.has(municipioId)) {
      this.coloniasDelMunicipio = this._mapaColonias.get(municipioId)!;
      this.colonia = this.coloniasDelMunicipio[0] ?? '';
      return;
    }
    try {
      this.cargandoCP = true; this.cdr.detectChanges();
      const url = `${SEPOMEX_BASE}/estado/${this._estadoId}/municipio/${municipioId}.json`;
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error();
      const json = await res.json();
      const posts: any[] = json?.data?.postcodes ?? [];
      const colonias = [...new Set<string>(posts.map((p: any) => (p.d_asenta ?? '').trim()).filter(Boolean))].sort();
      this._mapaColonias.set(municipioId, colonias);
      this.coloniasDelMunicipio = colonias;
      this.colonia = colonias[0] ?? '';
    } catch { this.coloniasDelMunicipio = []; }
    finally { this.cargandoCP = false; this.cdr.detectChanges(); }
  }

  private _limpiarGeo() {
    this.estado = ''; this.ciudad = ''; this.municipio = ''; this.colonia = '';
    this._estadoId = ''; this._municipioId = '';
    this.ciudadesDelEstado = []; this.municipiosDelCiudad = []; this.coloniasDelMunicipio = [];
    this._mapaCiudadMunicipios.clear(); this._mapaColonias.clear();
  }

  private normalizarEstado(texto: string): string {
    if (!texto) return '';
    const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    const t = norm(texto);
    if (this.estadosNorm[t]) return this.estadosNorm[t];
    return this.estadosMexico.find(e => norm(e) === t || t.includes(norm(e)) || norm(e).includes(t)) ?? texto;
  }

  private estadoToId(estadoNombre: string): string {
    const key = estadoNombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    return this.estadoIdMap[key] ?? '';
  }

  // ── Verificación dominio ──────────────────────────────────────────────────
  private verificarDominioDisponible(dominio: string): void {
    if (this.dominioTimer) clearTimeout(this.dominioTimer);
    this.dominioTimer = setTimeout(() => {
      this.verificandoDominio = true;
      this.cdr.detectChanges();
      this.http.get<{ disponible: boolean }>(
        `${environment.apiUrl}/admin/verificar-dominio?dominio=${encodeURIComponent(dominio)}`
      ).subscribe({
        next: (res) => {
          if (!res.disponible) this.errores['dominio'] = 'Este dominio ya está registrado por otra institución.';
          else if (this.errores['dominio'] === 'Este dominio ya está registrado por otra institución.') this.errores['dominio'] = undefined;
          this.verificandoDominio = false; this.cdr.detectChanges();
        },
        error: () => { this.verificandoDominio = false; this.cdr.detectChanges(); }
      });
    }, 600);
  }

  // ── Validaciones ──────────────────────────────────────────────────────────
  v = {
    nombre_institucion: () => {
      const val = String(this.form.nombre_institucion).trim();
      this.errores['nombre_institucion'] = (!val || val.length < 3) ? 'Mínimo 3 caracteres.' : undefined;
    },
    tipo: () => { this.errores['tipo'] = !String(this.form.tipo).trim() ? 'El tipo es obligatorio.' : undefined; },
    rfc: () => {
      const val = String(this.form.rfc).trim().toUpperCase();
      this.form.rfc = val;
      const re = /^[A-ZÑ&0-9]{12}$/;
      if (!val)               this.errores['rfc'] = 'El RFC es obligatorio.';
      else if (!re.test(val)) this.errores['rfc'] = 'El RFC debe tener exactamente 12 caracteres.';
      else                    this.errores['rfc'] = undefined;
    },
    dominio: () => {
      const val = String(this.form.dominio).trim();
      if (!val)                 { this.errores['dominio'] = 'El dominio es obligatorio.'; return; }
      if (!val.startsWith('@')) { this.errores['dominio'] = 'Debe comenzar con @ (ej: @utec.edu.mx).'; return; }
      if (!val.includes('.'))   { this.errores['dominio'] = 'Dominio inválido.'; return; }
      this.errores['dominio'] = undefined;
      this.verificarDominioDisponible(val);
    },
    nombre: () => {
      const val = String(this.form.nombre).trim();
      if (!val)                                this.errores['nombre'] = 'El nombre es obligatorio.';
      else if (!/^[a-zA-ZÀ-ÿ\s]+$/.test(val)) this.errores['nombre'] = 'Solo letras.';
      else if (val.length < 2)                 this.errores['nombre'] = 'Mínimo 2 caracteres.';
      else                                     this.errores['nombre'] = undefined;
    },
    apellido_paterno: () => {
      const val = String(this.form.apellido_paterno).trim();
      if (!val)                                this.errores['apellido_paterno'] = 'Obligatorio.';
      else if (!/^[a-zA-ZÀ-ÿ\s]+$/.test(val)) this.errores['apellido_paterno'] = 'Solo letras.';
      else                                     this.errores['apellido_paterno'] = undefined;
    },
    apellido_materno: () => {
      const val = String(this.form.apellido_materno).trim();
      if (!val)                                this.errores['apellido_materno'] = 'Obligatorio.';
      else if (!/^[a-zA-ZÀ-ÿ\s]+$/.test(val)) this.errores['apellido_materno'] = 'Solo letras.';
      else                                     this.errores['apellido_materno'] = undefined;
    },
    correo_admin: () => {
      const val = String(this.form.correo_admin).trim();
      const re  = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
      if (!val)               this.errores['correo_admin'] = 'El correo es obligatorio.';
      else if (!re.test(val)) this.errores['correo_admin'] = 'Correo inválido.';
      else                    this.errores['correo_admin'] = undefined;
    },
    contrasena: () => {
      const val = this.form.contrasena;
      if (!val)                      this.errores['contrasena'] = 'La contraseña es obligatoria.';
      else if (val.length < 8)       this.errores['contrasena'] = 'Mínimo 8 caracteres.';
      else if (!this.tieneUpperCase) this.errores['contrasena'] = 'Debe incluir al menos una mayúscula.';
      else if (!this.tieneNumero)    this.errores['contrasena'] = 'Debe incluir al menos un número.';
      else if (!this.tieneEspecial)  this.errores['contrasena'] = 'Debe incluir al menos un carácter especial.';
      else                           this.errores['contrasena'] = undefined;
      if (this.confirmar.length > 0) this.v.confirmar();
    },
    confirmar: () => {
      if (!this.confirmar)                              this.errores['confirmar'] = 'Confirma tu contraseña.';
      else if (this.form.contrasena !== this.confirmar) this.errores['confirmar'] = 'Las contraseñas no coinciden.';
      else                                              this.errores['confirmar'] = undefined;
    },
  };

  private validarTodo(): boolean {
    Object.values(this.v).forEach(fn => fn());
    return Object.values(this.errores).every(e => e === undefined);
  }

  registrar(): void {
    this.errorMsg = '';
    if (this.verificandoDominio) { this.errorMsg = 'Espera a que se verifique el dominio.'; return; }
    if (!this.validarTodo()) return;

    this.cargando = true;
    this.cdr.detectChanges();

    const payload: any = {
      nombre_institucion: this.form.nombre_institucion,
      tipo:               this.form.tipo,
      rfc:                this.form.rfc,
      dominio:            this.form.dominio,
      ciudad:             this.ciudad,
      estado:             this.estado,
      nombre:             this.form.nombre,
      apellido_paterno:   this.form.apellido_paterno,
      apellido_materno:   this.form.apellido_materno,
      correo_admin:       this.form.correo_admin,
      contrasena:         this.form.contrasena,
      radio_metros:       this.form.radio_metros || 200,
      codigo_postal:      this.codigo_postal || null,
      municipio:          this.municipio     || null,
      colonia:            this.colonia       || null,
      direccion:          this.direccion     || null,
    };

    if (this.form.latitud  !== '' && this.form.latitud  !== null) payload.latitud  = this.form.latitud;
    if (this.form.longitud !== '' && this.form.longitud !== null) payload.longitud = this.form.longitud;

    this.http.post<any>(`${environment.apiUrl}/admin/registro-institucion`, payload).subscribe({
      next: () => { this.cargando = false; this.mostrarModal = true; this.cdr.detectChanges(); },
      error: (err) => {
        this.cargando = false;
        this.errorMsg = err.error?.message || 'Error al registrar la institución.';
        if (this.errorMsg.includes('dominio')) this.errores['dominio'] = this.errorMsg;
        this.cdr.detectChanges();
      }
    });
  }

  irAlLogin(): void { this.router.navigate(['/admin/login']); }
  cancelar(): void  { this.router.navigate(['/admin/login']); }
}