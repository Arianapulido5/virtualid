import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpClient, HttpHeaders, HttpClientModule } from '@angular/common/http';
import { SidebarAdminComponent } from '../../../shared/sidebar-admin/sidebar-admin';
import { environment } from '../../../../environments/environment';

const SEPOMEX_BASE = 'https://sepomex.nitrostudio.com.mx/api/20241009';

@Component({
  selector: 'app-editar-administrador',
  standalone: true,
  imports: [CommonModule, FormsModule, SidebarAdminComponent, RouterLink, HttpClientModule],
  templateUrl: './editar-administrador.html',
  styleUrls: ['./editar-administrador.scss']
})
export class EditarAdministrador implements OnInit {

  cargandoDatos = true;
  cargando      = false;
  exitoso       = false;
  dominio       = '';
  miId          = 0;

  showActual  = false;
  showPass    = false;
  showConfirm = false;
  confirmar   = '';

  // ── Dirección ────────────────────────────────────────────────────────────
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

  // Valores originales del servidor, para no pisarlos al cargar listas SEPOMEX
  private _valorServidor = { estado: '', ciudad: '', municipio: '', colonia: '' };

  form = {
    nombre:            '',
    apellido_paterno:  '',
    apellido_materno:  '',
    correo:            '',
    contrasena_actual: '',
    contrasena:        ''
  };

  errores: { [k: string]: string | undefined } = {};
  errorMsg = '';

  private apiBase = environment.apiUrl;

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
    private http:   HttpClient,
    private router: Router,
    private cdr:    ChangeDetectorRef
  ) {}

  private get headers(): HttpHeaders {
    const token = localStorage.getItem('token') ?? '';
    return new HttpHeaders({ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' });
  }

  get tieneUpperCase() { return /[A-Z]/.test(this.form.contrasena); }
  get tieneLowerCase() { return /[a-z]/.test(this.form.contrasena); }
  get tieneNumero()    { return /[0-9]/.test(this.form.contrasena); }
  get tieneEspecial()  { return /[!@#$%^&*()\-_=+\[\]{};':"\\|,.<>/?]/.test(this.form.contrasena); }

  ngOnInit(): void {
    try {
      const payload = JSON.parse(atob((localStorage.getItem('token') ?? '').split('.')[1]));
      this.miId = payload.id ?? 0;
    } catch { this.miId = 0; }
    this.cargarDatos();
  }

  cargarDatos(): void {
    this.http.get<any>(`${this.apiBase}/admin/mi-cuenta`, { headers: this.headers }).subscribe({
      next: (data) => {
        this.form.nombre           = data.nombre           ?? '';
        this.form.apellido_paterno = data.apellido_paterno ?? '';
        this.form.apellido_materno = data.apellido_materno ?? '';
        this.form.correo           = data.correo           ?? '';

        // Guardar valores del servidor tal cual — estos son los que se van a mostrar y guardar
        this.estado    = data.estado    ?? '';
        this.ciudad    = data.ciudad    ?? '';
        this.municipio = data.municipio ?? '';
        this.colonia   = data.colonia   ?? '';
        this.direccion = data.direccion ?? '';
        this.codigo_postal = data.codigo_postal ?? '';

        // Guardar copia para no pisar al cargar listas SEPOMEX
        this._valorServidor = {
          estado:    this.estado,
          ciudad:    this.ciudad,
          municipio: this.municipio,
          colonia:   this.colonia,
        };

        // Si hay CP, cargar solo las listas de selects sin tocar los valores
        if (this.codigo_postal.length === 5) {
          this.cargandoCP = true;
          this.cdr.detectChanges();
          this._cargarListasSoloCP(this.codigo_postal);
        }

        this.http.get<any>(`${this.apiBase}/admin/mi-institucion`, { headers: this.headers }).subscribe({
          next: (inst) => {
            this.dominio       = inst.dominio_correo ?? '';
            this.cargandoDatos = false;
            this.cdr.detectChanges();
          },
          error: () => { this.cargandoDatos = false; this.cdr.detectChanges(); }
        });
      },
      error: () => { this.cargandoDatos = false; this.cdr.detectChanges(); }
    });
  }

  // Carga solo las listas de selects sin modificar estado/ciudad/municipio/colonia
  private async _cargarListasSoloCP(cp: string): Promise<void> {
    try {
      const jsonCP = await this._fetchConRetry(`${SEPOMEX_BASE}/cp/${cp}.json`);
      const postcodes: any[] = jsonCP?.data?.postcodes ?? [];
      if (!postcodes.length) throw new Error('Sin registros');

      const primero         = postcodes[0];
      const estadoNorm      = this._normalizarEstado((primero.d_estado ?? '').trim());
      const estadoId        = primero.c_estado ?? this._estadoToId(estadoNorm);
      const municipioNombre = (primero.d_mnpio ?? '').trim();
      const municipioId     = (primero.c_mnpio  ?? '').trim();
      const ciudadCP        = (primero.d_ciudad ?? municipioNombre).trim() || municipioNombre;
      const coloniasCP      = [...new Set<string>(
        postcodes.map((p: any) => (p.d_asenta ?? '').trim()).filter(Boolean)
      )].sort();

      this._estadoId    = estadoId;
      this._municipioId = municipioId;

      this.ciudadesDelEstado   = ciudadCP ? [ciudadCP] : [];
      this.municipiosDelCiudad = municipioNombre ? [municipioNombre] : [];
      this.coloniasDelMunicipio = coloniasCP;
      this._mapaCiudadMunicipios.set(ciudadCP, [{ id: municipioId, nombre: municipioNombre }]);
      this._mapaColonias.set(municipioId, coloniasCP);

      // Restaurar los valores del servidor (SEPOMEX no los pisa)
      this.estado    = this._valorServidor.estado    || estadoNorm;
      this.ciudad    = this._valorServidor.ciudad    || ciudadCP;
      this.municipio = this._valorServidor.municipio || municipioNombre;
      this.colonia   = this._valorServidor.colonia   || (coloniasCP[0] ?? '');

      this.errores['codigo_postal'] = undefined;
    } catch {
      this.errores['codigo_postal'] = 'No se encontró información para este CP.';
    } finally {
      this.cargandoCP = false;
      this.cdr.detectChanges();
    }
  }

  // ── CP (cuando el usuario escribe uno nuevo) ──────────────────────────────

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
      this._buscarCPNuevo(v);
    }
  }

  // Cuando el usuario escribe un CP nuevo: sí reemplaza todo
  private async _buscarCPNuevo(cp: string): Promise<void> {
    try {
      const jsonCP = await this._fetchConRetry(`${SEPOMEX_BASE}/cp/${cp}.json`);
      const postcodes: any[] = jsonCP?.data?.postcodes ?? [];
      if (!postcodes.length) throw new Error('Sin registros para CP ' + cp);

      const primero         = postcodes[0];
      const estadoNorm      = this._normalizarEstado((primero.d_estado ?? '').trim());
      const estadoId        = primero.c_estado ?? this._estadoToId(estadoNorm);
      const municipioNombre = (primero.d_mnpio ?? '').trim();
      const municipioId     = (primero.c_mnpio  ?? '').trim();
      const ciudadCP        = (primero.d_ciudad ?? municipioNombre).trim() || municipioNombre;
      const coloniasCP      = [...new Set<string>(
        postcodes.map((p: any) => (p.d_asenta ?? '').trim()).filter(Boolean)
      )].sort();

      this._estadoId    = estadoId;
      this._municipioId = municipioId;
      this.estado    = estadoNorm;
      this.ciudad    = ciudadCP;
      this.municipio = municipioNombre;
      this.colonia   = coloniasCP[0] ?? '';

      this.ciudadesDelEstado    = ciudadCP ? [ciudadCP] : [];
      this.municipiosDelCiudad  = municipioNombre ? [municipioNombre] : [];
      this.coloniasDelMunicipio = coloniasCP;
      this._mapaCiudadMunicipios.set(ciudadCP, [{ id: municipioId, nombre: municipioNombre }]);
      this._mapaColonias.set(municipioId, coloniasCP);

      this.errores['codigo_postal'] = undefined;
    } catch {
      this.errores['codigo_postal'] = 'No se encontró información para este CP.';
      this._limpiarGeo();
    } finally {
      this.cargandoCP = false;
      this.cdr.detectChanges();
    }
  }

  async onCiudadChange(): Promise<void> {
    this.municipio = ''; this.colonia = '';
    this.municipiosDelCiudad = []; this.coloniasDelMunicipio = [];
    this._municipioId = '';
    this._actualizarMunicipios(this.ciudad, '');
    this.municipio = this.municipiosDelCiudad[0] ?? '';
    if (this.municipio) await this._cargarColonias(this.municipio);
    this.cdr.detectChanges();
  }

  async onMunicipioChange(): Promise<void> {
    this.colonia = ''; this.coloniasDelMunicipio = [];
    await this._cargarColonias(this.municipio);
    this.cdr.detectChanges();
  }

  private _actualizarMunicipios(ciudad: string, preseleccionar: string): void {
    const lista = this._mapaCiudadMunicipios.get(ciudad) ?? [];
    this.municipiosDelCiudad = lista.map(x => x.nombre).sort();
    if (!this.municipiosDelCiudad.length && ciudad) this.municipiosDelCiudad = [ciudad];
    this.municipio = (preseleccionar && this.municipiosDelCiudad.includes(preseleccionar))
      ? preseleccionar : (this.municipiosDelCiudad[0] ?? '');
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
      this.colonia = this.coloniasDelMunicipio[0] ?? '';
      return;
    }
    try {
      this.cargandoCP = true; this.cdr.detectChanges();
      const url  = `${SEPOMEX_BASE}/estado/${this._estadoId}/municipio/${municipioId}.json`;
      const json = await this._fetchConRetry(url);
      const posts: any[] = json?.data?.postcodes ?? [];
      const colonias = [...new Set<string>(posts.map((p: any) => (p.d_asenta ?? '').trim()).filter(Boolean))].sort();
      this._mapaColonias.set(municipioId, colonias);
      this.coloniasDelMunicipio = colonias;
      this.colonia = colonias[0] ?? '';
    } catch { this.coloniasDelMunicipio = []; }
    finally { this.cargandoCP = false; this.cdr.detectChanges(); }
  }

  private _limpiarGeo(): void {
    this.estado = ''; this.ciudad = ''; this.municipio = ''; this.colonia = '';
    this._estadoId = ''; this._municipioId = '';
    this.ciudadesDelEstado = []; this.municipiosDelCiudad = []; this.coloniasDelMunicipio = [];
    this._mapaCiudadMunicipios.clear(); this._mapaColonias.clear();
  }

  // ── Utilidades ────────────────────────────────────────────────────────────

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

  // ── Validaciones ──────────────────────────────────────────────────────────

  v = {
    nombre: () => {
      const val = this.form.nombre.trim();
      if (!val)                                this.errores['nombre'] = 'El nombre es obligatorio.';
      else if (!/^[a-zA-ZÀ-ÿ\s]+$/.test(val)) this.errores['nombre'] = 'Solo se permiten letras.';
      else if (val.length < 2)                 this.errores['nombre'] = 'Mínimo 2 caracteres.';
      else                                     this.errores['nombre'] = undefined;
    },
    apellido_paterno: () => {
      const val = this.form.apellido_paterno.trim();
      if (!val)                                this.errores['apellido_paterno'] = 'El apellido paterno es obligatorio.';
      else if (!/^[a-zA-ZÀ-ÿ\s]+$/.test(val)) this.errores['apellido_paterno'] = 'Solo se permiten letras.';
      else if (val.length < 2)                 this.errores['apellido_paterno'] = 'Mínimo 2 caracteres.';
      else                                     this.errores['apellido_paterno'] = undefined;
    },
    apellido_materno: () => {
      const val = this.form.apellido_materno.trim();
      if (!val)                                this.errores['apellido_materno'] = 'El apellido materno es obligatorio.';
      else if (!/^[a-zA-ZÀ-ÿ\s]+$/.test(val)) this.errores['apellido_materno'] = 'Solo se permiten letras.';
      else if (val.length < 2)                 this.errores['apellido_materno'] = 'Mínimo 2 caracteres.';
      else                                     this.errores['apellido_materno'] = undefined;
    },
    correo: () => {
      const val = this.form.correo.trim();
      const re  = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
      if (!val)               this.errores['correo'] = 'El correo es obligatorio.';
      else if (!re.test(val)) this.errores['correo'] = 'Ingresa un correo válido.';
      else if (this.dominio && !val.endsWith(this.dominio))
        this.errores['correo'] = `Debe pertenecer al dominio ${this.dominio}.`;
      else                    this.errores['correo'] = undefined;
    },
    contrasena_actual: () => {
      if (!this.form.contrasena) { this.errores['contrasena_actual'] = undefined; return; }
      this.errores['contrasena_actual'] = !this.form.contrasena_actual
        ? 'Ingresa tu contraseña actual para poder cambiarla.' : undefined;
    },
    contrasena: () => {
      const val = this.form.contrasena;
      if (!val) {
        this.errores['contrasena'] = this.errores['contrasena_actual'] = this.errores['confirmar'] = undefined;
        return;
      }
      if (val.length < 8)            this.errores['contrasena'] = 'Mínimo 8 caracteres.';
      else if (!this.tieneUpperCase) this.errores['contrasena'] = 'Debe incluir al menos una mayúscula.';
      else if (!this.tieneLowerCase) this.errores['contrasena'] = 'Debe incluir al menos una minúscula.';
      else if (!this.tieneNumero)    this.errores['contrasena'] = 'Debe incluir al menos un número.';
      else if (!this.tieneEspecial)  this.errores['contrasena'] = 'Debe incluir al menos un carácter especial.';
      else                           this.errores['contrasena'] = undefined;
      this.v.contrasena_actual();
      if (this.confirmar.length > 0) this.v.confirmar();
    },
    confirmar: () => {
      if (!this.form.contrasena) { this.errores['confirmar'] = undefined; return; }
      if (!this.confirmar)
        this.errores['confirmar'] = 'Confirma tu nueva contraseña.';
      else if (this.form.contrasena !== this.confirmar)
        this.errores['confirmar'] = 'Las contraseñas no coinciden.';
      else
        this.errores['confirmar'] = undefined;
    }
  };

  private validarTodo(): boolean {
    Object.values(this.v).forEach(fn => fn());
    return Object.values(this.errores).every(e => e === undefined);
  }

  guardar(): void {
    this.errorMsg = '';
    if (!this.validarTodo()) return;

    this.cargando = true;
    this.cdr.detectChanges();

    const payload: any = {
      nombre:           this.form.nombre.trim(),
      apellido_paterno: this.form.apellido_paterno.trim(),
      apellido_materno: this.form.apellido_materno.trim(),
      correo:           this.form.correo.trim().toLowerCase(),
      codigo_postal:    this.codigo_postal  || null,
      estado:           this.estado         || null,
      ciudad:           this.ciudad         || null,
      municipio:        this.municipio      || null,
      colonia:          this.colonia        || null,
      direccion:        this.direccion      || null,
    };

    if (this.form.contrasena) {
      payload.contrasena_actual = this.form.contrasena_actual;
      payload.contrasena        = this.form.contrasena;
    }

    this.http.put<any>(`${this.apiBase}/admin/mi-cuenta`, payload, { headers: this.headers }).subscribe({
      next: () => { this.cargando = false; this.exitoso = true; this.cdr.detectChanges(); },
      error: (err) => {
        this.cargando = false;
        this.errorMsg = err?.error?.message ?? 'No se pudo actualizar la información.';
        this.cdr.detectChanges();
      }
    });
  }

  irADetalle(): void { this.router.navigate(['/admin/administradores', this.miId]); }
  cancelar(): void   { this.router.navigate(['/admin/administradores', this.miId]); }
}