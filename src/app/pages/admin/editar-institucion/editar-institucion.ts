// src/app/pages/admin/editar-institucion/editar-institucion.ts
import { Component, OnInit, OnDestroy, ChangeDetectorRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { SidebarAdminComponent } from '../../../shared/sidebar-admin/sidebar-admin';
import { MapaSelectorComponent } from '../../../shared/mapa-selector/mapa-selector';
import { environment } from '../../../../environments/environment';

const SEPOMEX_BASE = 'https://sepomex.nitrostudio.com.mx/api/20241009';
const MAPBOX_TOKEN = 'pk.eyJ1IjoiYXJpYW5hcHVsaWRvLTciLCJhIjoiY21td2YxdXM4MnB4cjJxcHk4aWsyc2ljcSJ9.rE19cHh6UFvEncYVjSULrg';

@Component({
  selector: 'app-editar-institucion',
  standalone: true,
  imports: [CommonModule, FormsModule, SidebarAdminComponent, RouterLink, MapaSelectorComponent],
  templateUrl: './editar-institucion.html',
  styleUrls: ['./editar-institucion.scss']
})
export class EditarInstitucion implements OnInit, OnDestroy {

  cargando      = false;
  cargandoDatos = true;
  errorMsg      = '';
  exitoso       = false;

  mapaLat: number | null = null;
  mapaLng: number | null = null;
  private _cpVinoDeMapa  = false;

  // ── Dirección institución ──────────────────────────────────────────────────
  codigo_postal    = '';
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
    ciudad:             '',
    estado:             '',
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
    'aguascalientes':      '01', 'baja california':      '02',
    'baja california sur': '03', 'campeche':             '04',
    'coahuila':            '05', 'colima':               '06',
    'chiapas':             '07', 'chihuahua':            '08',
    'ciudad de mexico':    '09', 'durango':              '10',
    'guanajuato':          '11', 'guerrero':             '12',
    'hidalgo':             '13', 'jalisco':              '14',
    'estado de mexico':    '15', 'michoacan':            '16',
    'morelos':             '17', 'nayarit':              '18',
    'nuevo leon':          '19', 'oaxaca':               '20',
    'puebla':              '21', 'queretaro':            '22',
    'quintana roo':        '23', 'san luis potosi':      '24',
    'sinaloa':             '25', 'sonora':               '26',
    'tabasco':             '27', 'tamaulipas':           '28',
    'tlaxcala':            '29', 'veracruz':             '30',
    'yucatan':             '31', 'zacatecas':            '32',
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
    private http: HttpClient,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.cargarDatos();
    const style = document.createElement('style');
    style.id = 'hide-scrollbar-editar';
    style.textContent = `::-webkit-scrollbar { display: none; } body { scrollbar-width: none; }`;
    document.head.appendChild(style);
  }

  ngOnDestroy(): void {
    document.getElementById('hide-scrollbar-editar')?.remove();
  }

  // ── Mapa ───────────────────────────────────────────────────────────────────

  onCoordsChange(coords: { lat: number; lng: number } | null): void {
    if (coords) {
      this.form.latitud  = coords.lat;
      this.form.longitud = coords.lng;
      this.mapaLat = coords.lat;
      this.mapaLng = coords.lng;
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

    const esModoManual = this.mapaSelector?.modo === 'manual';

    if (lugar.cp && lugar.cp.length === 5 && (lugar.cp !== this.codigo_postal || esModoManual)) {
      this._cpVinoDeMapa = !esModoManual;
      this.codigo_postal = lugar.cp;
      this._limpiarGeo();
      this.cargandoCP = true;
      this.cdr.detectChanges();
      this._buscarCP(lugar.cp);
      return;
    }

    if (!esModoManual) {
      if (lugar.cp && lugar.cp === this.codigo_postal) return;
      if (this.codigo_postal && this.codigo_postal.length === 5) return;
    }

    this._limpiarGeo();
    if (lugar.ciudad) this.form.ciudad = lugar.ciudad;
    if (lugar.estado) this.form.estado = lugar.estado;
    this.cdr.detectChanges();
  }

  // ── NUEVO: recibir dirección geocodificada del mapa ────────────────────────
  onDireccionChange(dir: string): void {
    if (dir) {
      this.direccion = dir;
      this.cdr.detectChanges();
    }
  }

  // ── CP ─────────────────────────────────────────────────────────────────────

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
      this._cpVinoDeMapa = false;
      this.cargandoCP = true;
      this._limpiarGeo();
      this.cdr.detectChanges();
      this._buscarCP(v);
    }
  }

  private async _buscarCP(cp: string) {
    try {
      const jsonCP = await this._fetchConRetry(`${SEPOMEX_BASE}/cp/${cp}.json`);
      const postcodes: any[] = jsonCP?.data?.postcodes ?? [];
      if (!postcodes.length) throw new Error('Sin registros para CP ' + cp);

      const primero           = postcodes[0];
      const estadoRaw         = (primero.d_estado ?? '').trim();
      const estadoNorm        = this._normalizarEstado(estadoRaw);
      const estadoId          = primero.c_estado ?? this._estadoToId(estadoNorm);
      const municipioNombreCP = (primero.d_mnpio ?? '').trim();
      const municipioIdCP     = (primero.c_mnpio  ?? '').trim();
      const ciudadCP          = (primero.d_ciudad ?? municipioNombreCP).trim() || municipioNombreCP;
      const coloniasCP        = [...new Set<string>(
        postcodes.map((p: any) => (p.d_asenta ?? '').trim()).filter(Boolean)
      )].sort();

      this._estadoId    = estadoId;
      this._municipioId = municipioIdCP;
      this.form.estado  = estadoNorm;
      this.form.ciudad  = ciudadCP;
      this.municipio    = municipioNombreCP;

      this.ciudadesDelEstado   = ciudadCP ? [ciudadCP] : [];
      this.municipiosDelCiudad = municipioNombreCP ? [municipioNombreCP] : [];
      this._mapaCiudadMunicipios.set(ciudadCP, [{ id: municipioIdCP, nombre: municipioNombreCP }]);
      this._mapaColonias.set(municipioIdCP, coloniasCP);
      this.coloniasDelMunicipio = coloniasCP;
      this.colonia = coloniasCP[0] ?? '';

      this.errores['codigo_postal'] = undefined;
      this.cargandoCP = false;
      this.cdr.detectChanges();

      if (!this._cpVinoDeMapa) {
        fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${cp}.json?country=MX&types=postcode&access_token=${MAPBOX_TOKEN}`)
          .then(r => r.json())
          .then(data => {
            const center = data?.features?.[0]?.center;
            if (center) {
              const lat = parseFloat(center[1].toFixed(7));
              const lng = parseFloat(center[0].toFixed(7));
              this.mapaLat = lat;
              this.mapaLng = lng;
              this.form.latitud  = lat;
              this.form.longitud = lng;
              if (this.mapaSelector) this.mapaSelector.moverA(lat, lng);
              this.cdr.detectChanges();
            }
            this._cpVinoDeMapa = false;
          })
          .catch(() => { this._cpVinoDeMapa = false; });
      } else {
        this._cpVinoDeMapa = false;
      }

    } catch {
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
    this._actualizarMunicipios(this.form.ciudad, '');
    this.municipio = this.municipiosDelCiudad[0] ?? '';
    if (this.municipio) await this._cargarColonias(this.municipio);
    this.cdr.detectChanges();
  }

  async onMunicipioChange() {
    this.colonia = ''; this.coloniasDelMunicipio = [];
    await this._cargarColonias(this.municipio);
    this.cdr.detectChanges();
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
      const url  = `${SEPOMEX_BASE}/estado/${this._estadoId}/municipio/${municipioId}.json`;
      const json = await this._fetchConRetry(url);
      const posts: any[] = json?.data?.postcodes ?? [];
      const colonias = [...new Set<string>(
        posts.map((p: any) => (p.d_asenta ?? '').trim()).filter(Boolean)
      )].sort();
      this._mapaColonias.set(municipioId, colonias);
      this.coloniasDelMunicipio = colonias;
      this.colonia = colonias[0] ?? '';
    } catch { this.coloniasDelMunicipio = []; }
    finally { this.cargandoCP = false; this.cdr.detectChanges(); }
  }

  private _limpiarGeo() {
    this.form.estado = ''; this.form.ciudad = ''; this.municipio = ''; this.colonia = '';
    this._estadoId = ''; this._municipioId = '';
    this.ciudadesDelEstado = []; this.municipiosDelCiudad = []; this.coloniasDelMunicipio = [];
    this._mapaCiudadMunicipios.clear(); this._mapaColonias.clear();
  }

  // ── Cargar datos existentes ────────────────────────────────────────────────

  cargarDatos(): void {
    const token   = localStorage.getItem('token') ?? '';
    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });

    this.http.get<any>(`${environment.apiUrl}/admin/mi-institucion`, { headers }).subscribe({
      next: async (data) => {
        this.form.nombre_institucion = data.nombre         ?? '';
        this.form.tipo               = data.tipo           ?? '';
        this.form.rfc                = data.rfc            ?? '';
        this.form.dominio            = data.dominio_correo ?? '';
        this.form.ciudad             = data.ciudad         ?? '';
        this.form.estado             = data.estado         ?? '';
        this.form.latitud            = data.latitud        ?? '';
        this.form.longitud           = data.longitud       ?? '';
        this.form.radio_metros       = data.radio_metros   ?? 200;
        this.mapaLat  = data.latitud  ? parseFloat(data.latitud)  : null;
        this.mapaLng  = data.longitud ? parseFloat(data.longitud) : null;
        this.direccion = data.direccion ?? '';

        const cpGuardado        = data.codigo_postal ?? '';
        const municipioGuardado = data.municipio     ?? '';
        const coloniaGuardada   = data.colonia       ?? '';

        if (cpGuardado && cpGuardado.length === 5) {
          this.codigo_postal = cpGuardado;
          this.cargandoCP    = true;
          this.cdr.detectChanges();
          await this._cargarCPPreservando(cpGuardado, municipioGuardado, coloniaGuardada);
        } else {
          this.municipio = municipioGuardado;
          this.colonia   = coloniaGuardada;
        }

        this.cargandoDatos = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.errorMsg      = 'No se pudieron cargar los datos.';
        this.cargandoDatos = false;
        this.cdr.detectChanges();
      }
    });
  }

  private async _cargarCPPreservando(cp: string, municipioGuardado: string, coloniaGuardada: string) {
    try {
      const jsonCP = await this._fetchConRetry(`${SEPOMEX_BASE}/cp/${cp}.json`);
      const postcodes: any[] = jsonCP?.data?.postcodes ?? [];
      if (!postcodes.length) throw new Error('Sin registros');

      const primero           = postcodes[0];
      const estadoRaw         = (primero.d_estado ?? '').trim();
      const estadoNorm        = this._normalizarEstado(estadoRaw);
      const estadoId          = primero.c_estado ?? this._estadoToId(estadoNorm);
      const municipioNombreCP = (primero.d_mnpio ?? '').trim();
      const municipioIdCP     = (primero.c_mnpio  ?? '').trim();
      const ciudadCP          = (primero.d_ciudad ?? municipioNombreCP).trim() || municipioNombreCP;
      const coloniasCP        = [...new Set<string>(
        postcodes.map((p: any) => (p.d_asenta ?? '').trim()).filter(Boolean)
      )].sort();

      this._estadoId = estadoId;
      this._municipioId = municipioIdCP;

      if (!this.form.estado) this.form.estado = estadoNorm;
      if (!this.form.ciudad) this.form.ciudad = ciudadCP;

      this.ciudadesDelEstado   = ciudadCP ? [ciudadCP] : [];
      this.municipiosDelCiudad = municipioNombreCP ? [municipioNombreCP] : [];
      this._mapaCiudadMunicipios.set(ciudadCP, [{ id: municipioIdCP, nombre: municipioNombreCP }]);
      this._mapaColonias.set(municipioIdCP, coloniasCP);
      this.coloniasDelMunicipio = coloniasCP;

      this.municipio = municipioGuardado || municipioNombreCP;
      this.colonia   = coloniaGuardada && coloniasCP.includes(coloniaGuardada)
                         ? coloniaGuardada
                         : (coloniasCP[0] ?? '');

    } catch {
      this.municipio = municipioGuardado;
      this.colonia   = coloniaGuardada;
    } finally {
      this.cargandoCP = false;
      this.cdr.detectChanges();
    }
  }

  // ── Utilidades ─────────────────────────────────────────────────────────────

  private async _fetchConRetry(url: string, intentos = 3): Promise<any> {
    for (let i = 0; i < intentos; i++) {
      const ctrl = new AbortController();
      const tid  = setTimeout(() => ctrl.abort(), 10000);
      try {
        const res = await fetch(url, { signal: ctrl.signal, cache: 'no-store' });
        clearTimeout(tid);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
      } catch (e) {
        clearTimeout(tid);
        if (i === intentos - 1) throw e;
        await new Promise(r => setTimeout(r, 600 * (i + 1)));
      }
    }
  }

  private _normalizarEstado(texto: string): string {
    if (!texto) return '';
    const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    const t = norm(texto);
    if (this.estadosNorm[t]) return this.estadosNorm[t];
    return this.estadosMexico.find(e => norm(e) === t || t.includes(norm(e)) || norm(e).includes(t)) ?? texto;
  }

  private _estadoToId(estadoNombre: string): string {
    const key = estadoNombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    return this.estadoIdMap[key] ?? '';
  }

  // ── Validaciones ───────────────────────────────────────────────────────────

  v = {
    nombre_institucion: () => {
      const val = this.form.nombre_institucion.trim();
      this.errores['nombre_institucion'] = (!val || val.length < 3) ? 'Mínimo 3 caracteres.' : undefined;
    },
    tipo: () => {
      this.errores['tipo'] = !this.form.tipo.trim() ? 'El tipo es obligatorio.' : undefined;
    },
    rfc: () => {
      const val = this.form.rfc.trim().toUpperCase();
      this.form.rfc = val;
      const re = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/;
      if (!val)               this.errores['rfc'] = 'El RFC es obligatorio.';
      else if (!re.test(val)) this.errores['rfc'] = 'RFC inválido (ej: UTE200101ABC).';
      else                    this.errores['rfc'] = undefined;
    },
    dominio: () => {
      const val = this.form.dominio.trim();
      if (!val)                      this.errores['dominio'] = 'El dominio es obligatorio.';
      else if (!val.startsWith('@')) this.errores['dominio'] = 'Debe comenzar con @ (ej: @utec.edu.mx).';
      else if (!val.includes('.'))   this.errores['dominio'] = 'Dominio inválido.';
      else                           this.errores['dominio'] = undefined;
    },
    ciudad: () => {
      this.errores['ciudad'] = !this.form.ciudad.trim() ? 'La ciudad es obligatoria.' : undefined;
    },
    estado: () => {
      this.errores['estado'] = !this.form.estado ? 'Selecciona un estado.' : undefined;
    },
  };

  private validarTodo(): boolean {
    Object.values(this.v).forEach(fn => fn());
    return Object.values(this.errores).every(e => e === undefined);
  }

  // ── Guardar ────────────────────────────────────────────────────────────────

  guardar(): void {
    this.errorMsg = '';
    if (!this.validarTodo()) return;

    this.cargando = true;
    this.cdr.detectChanges();

    const token   = localStorage.getItem('token') ?? '';
    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });

    const payload: any = {
      nombre:        this.form.nombre_institucion,
      tipo:          this.form.tipo,
      rfc:           this.form.rfc,
      dominio:       this.form.dominio,
      ciudad:        this.form.ciudad,
      estado:        this.form.estado,
      radio_metros:  this.form.radio_metros || 200,
      latitud:       (this.form.latitud  !== '' && this.form.latitud  !== null) ? this.form.latitud  : null,
      longitud:      (this.form.longitud !== '' && this.form.longitud !== null) ? this.form.longitud : null,
      codigo_postal: this.codigo_postal || null,
      municipio:     this.municipio     || null,
      colonia:       this.colonia       || null,
      direccion:     this.direccion     || null,
    };

    this.http.put<any>(`${environment.apiUrl}/admin/mi-institucion`, payload, { headers }).subscribe({
      next: () => { this.cargando = false; this.exitoso = true; this.cdr.detectChanges(); },
      error: (err) => {
        this.cargando = false;
        this.errorMsg = err.error?.message || 'Error al guardar los cambios.';
        this.cdr.detectChanges();
      }
    });
  }

  irAInstitucion(): void { this.router.navigate(['/admin/mi-institucion']); }
  cancelar(): void       { this.router.navigate(['/admin/mi-institucion']); }
}