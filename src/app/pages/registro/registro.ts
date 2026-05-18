// src/app/pages/registro/registro.ts
import { Component, ChangeDetectorRef } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { NgIf, CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Auth } from '../../services/auth';

const SEPOMEX_BASE = 'https://sepomex.nitrostudio.com.mx/api/20241009';

@Component({
  selector: 'app-registro',
  standalone: true,
  imports: [RouterLink, NgIf, CommonModule, FormsModule],
  templateUrl: './registro.html',
  styleUrl: './registro.scss'
})
export class Registro {
  showPassword      = false;
  showConfirm       = false;
  cargando          = false;
  cargandoCP        = false;
  aceptaTerminos    = false;
  mostrarModal      = false;
  mostrarModalError = false;
  modalErrorTitulo  = '';
  modalErrorMensaje = '';

  nombre           = '';
  apellido_paterno = '';
  apellido_materno = '';
  correo           = '';
  numero_empleado  = '';
  tipo             = '';
  contrasena       = '';
  confirmar        = '';

  telefono         = '';
  direccion        = '';
  ciudad           = '';
  estado           = '';
  municipio        = '';
  colonia          = '';
  codigo_postal    = '';
  fecha_nacimiento = '';

  // IDs internos para navegar la API de nitrostudio
  private _estadoId    = '';   // c_estado  ej: "30"
  private _municipioId = '';   // c_mnpio   ej: "087"

  // Listas para los selects
  ciudadesDelEstado:    string[]                          = [];
  municipiosDelCiudad:  string[]                          = [];
  coloniasDelMunicipio: string[]                          = [];

  // Mapa ciudad → lista de municipios (obtenido al cargar el estado)
  private _mapaCiudadMunicipios: Map<string, { id: string; nombre: string }[]> = new Map();
  // Mapa municipioId → lista de colonias (se carga bajo demanda)
  private _mapaColonias: Map<string, string[]> = new Map();

  errorGeneral = '';

  readonly estadosMexico = [
    'Aguascalientes','Baja California','Baja California Sur','Campeche',
    'Chiapas','Chihuahua','Ciudad de México','Coahuila','Colima','Durango',
    'Estado de México','Guanajuato','Guerrero','Hidalgo','Jalisco',
    'Michoacán','Morelos','Nayarit','Nuevo León','Oaxaca','Puebla',
    'Querétaro','Quintana Roo','San Luis Potosí','Sinaloa','Sonora',
    'Tabasco','Tamaulipas','Tlaxcala','Veracruz','Yucatán','Zacatecas'
  ];

  // Mapa nombre normalizado → c_estado en la API de nitrostudio
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

  readonly hoy = new Date().toISOString().split('T')[0];

  errores: {
    nombre?: string; apellido_paterno?: string; apellido_materno?: string;
    correo?: string; numero_empleado?: string; tipo?: string;
    contrasena?: string; confirmar?: string; terminos?: string;
    telefono?: string; codigo_postal?: string; fecha_nacimiento?: string;
  } = {};

  get tieneUpperCase() { return /[A-Z]/.test(this.contrasena); }
  get tieneNumero()    { return /[0-9]/.test(this.contrasena); }
  get tieneEspecial()  { return /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(this.contrasena); }

  constructor(private authService: Auth, private router: Router, private cdr: ChangeDetectorRef) {}

  togglePassword() { this.showPassword = !this.showPassword; }
  toggleConfirm()  { this.showConfirm  = !this.showConfirm;  }

  cerrarModalError() { this.mostrarModalError = false; this.cdr.detectChanges(); }

  private mostrarError(titulo: string, mensaje: string) {
    this.cargando          = false;
    this.modalErrorTitulo  = titulo;
    this.modalErrorMensaje = mensaje;
    this.mostrarModalError = true;
    this.cdr.detectChanges();
  }

  private extraerMensaje(err: any): string {
    try {
      if (typeof err.error === 'string') {
        try { return JSON.parse(err.error).message ?? err.error; } catch { return err.error; }
      }
      if (err.error && typeof err.error === 'object')
        return err.error.message ?? err.error.error ?? JSON.stringify(err.error);
      return err.message ?? 'Ocurrió un error inesperado.';
    } catch { return 'Ocurrió un error inesperado.'; }
  }

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

  // ── Validaciones ──────────────────────────────────────────────────────────

  validarNombre() {
    const v = this.nombre.trim();
    if (!v)                                this.errores.nombre = 'El nombre es obligatorio.';
    else if (!/^[a-zA-ZÀ-ÿ\s]+$/.test(v)) this.errores.nombre = 'Solo se permiten letras.';
    else if (v.length < 2)                 this.errores.nombre = 'Mínimo 2 caracteres.';
    else                                   this.errores.nombre = undefined;
  }

  validarApellidoPaterno() {
    const v = this.apellido_paterno.trim();
    if (!v)                                this.errores.apellido_paterno = 'El apellido paterno es obligatorio.';
    else if (!/^[a-zA-ZÀ-ÿ\s]+$/.test(v)) this.errores.apellido_paterno = 'Solo se permiten letras.';
    else if (v.length < 2)                 this.errores.apellido_paterno = 'Mínimo 2 caracteres.';
    else                                   this.errores.apellido_paterno = undefined;
  }

  validarApellidoMaterno() {
    const v = this.apellido_materno.trim();
    if (!v)                                this.errores.apellido_materno = 'El apellido materno es obligatorio.';
    else if (!/^[a-zA-ZÀ-ÿ\s]+$/.test(v)) this.errores.apellido_materno = 'Solo se permiten letras.';
    else if (v.length < 2)                 this.errores.apellido_materno = 'Mínimo 2 caracteres.';
    else                                   this.errores.apellido_materno = undefined;
  }

  validarCorreo() {
    const v  = this.correo.trim();
    const re = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
    if (!v)               this.errores.correo = 'El correo es obligatorio.';
    else if (!re.test(v)) this.errores.correo = 'Ingresa un correo válido.';
    else                  this.errores.correo = undefined;
  }

  validarNumeroEmpleado() {
    this.numero_empleado = this.numero_empleado.replace(/\D/g, '').slice(0, 10);
    const v = this.numero_empleado;
    if (!v)                   this.errores.numero_empleado = 'El número de empleado es obligatorio.';
    else if (v.length !== 10) this.errores.numero_empleado = `Debe tener exactamente 10 dígitos (${v.length}/10).`;
    else                      this.errores.numero_empleado = undefined;
  }

  validarTipo() {
    if (!this.tipo) this.errores.tipo = 'Selecciona si eres estudiante o empleado.';
    else            this.errores.tipo = undefined;
  }

  validarContrasena() {
    const v = this.contrasena;
    if (!v)                        this.errores.contrasena = 'La contraseña es obligatoria.';
    else if (v.length < 8)         this.errores.contrasena = 'Mínimo 8 caracteres.';
    else if (!this.tieneUpperCase) this.errores.contrasena = 'Debe incluir al menos una mayúscula.';
    else if (!this.tieneNumero)    this.errores.contrasena = 'Debe incluir al menos un número.';
    else if (!this.tieneEspecial)  this.errores.contrasena = 'Debe incluir al menos un carácter especial.';
    else                           this.errores.contrasena = undefined;
    if (this.confirmar.length > 0) this.validarConfirmar();
  }

  validarConfirmar() {
    if (!this.confirmar)                         this.errores.confirmar = 'Confirma tu contraseña.';
    else if (this.contrasena !== this.confirmar) this.errores.confirmar = 'Las contraseñas no coinciden.';
    else                                         this.errores.confirmar = undefined;
  }

  validarTerminos() {
    if (!this.aceptaTerminos) this.errores.terminos = 'Debes aceptar los términos y condiciones.';
    else                      this.errores.terminos = undefined;
  }

  validarTelefono() {
    const v = this.telefono.replace(/\D/g, '').slice(0, 10);
    this.telefono = v;
    if (v && v.length !== 10) this.errores.telefono = 'Debe tener exactamente 10 dígitos.';
    else                      this.errores.telefono = undefined;
  }

  validarFechaNacimiento() {
    if (!this.fecha_nacimiento) { this.errores.fecha_nacimiento = undefined; return; }
    const f = new Date(this.fecha_nacimiento);
    if (f >= new Date()) this.errores.fecha_nacimiento = 'La fecha debe ser anterior a hoy.';
    else                 this.errores.fecha_nacimiento = undefined;
  }

  // ── Código Postal ─────────────────────────────────────────────────────────

  validarCodigoPostal() {
    const v = this.codigo_postal.replace(/\D/g, '').slice(0, 5);
    this.codigo_postal = v;

    if (v && v.length !== 5) {
      this.errores.codigo_postal = 'Debe tener exactamente 5 dígitos.';
      this._limpiarGeo();
      return;
    }
    this.errores.codigo_postal = undefined;

    if (v.length === 5) {
      this.cargandoCP = true;
      this._limpiarGeo();
      this.cdr.detectChanges();
      this._buscarCP(v);
    }
  }

  private async _buscarCP(cp: string) {
    try {
      // PASO 1 — Obtener info del CP (estado, municipio, colonias)
      const urlCP = `${SEPOMEX_BASE}/cp/${cp}.json`;
      const resCP = await fetch(urlCP, { headers: { Accept: 'application/json' } });
      if (!resCP.ok) throw new Error(`CP no encontrado (${resCP.status})`);

      const jsonCP = await resCP.json();
      console.log('[CP] Respuesta:', jsonCP);

      const postcodes: any[] = jsonCP?.data?.postcodes ?? [];
      if (!postcodes.length) throw new Error('Sin registros para CP ' + cp);

      const primero    = postcodes[0];
      const estadoRaw  = (primero.d_estado ?? '').trim();
      const estadoNorm = this.normalizarEstado(estadoRaw);
      const estadoId   = primero.c_estado ?? this.estadoToId(estadoNorm);

      // Colonias del CP (para preseleccionar más adelante)
      const coloniasCP = postcodes
        .map((p: any) => (p.d_asenta ?? '').trim())
        .filter(Boolean);

      // Municipio del CP
      const municipioNombreCP = (primero.d_mnpio ?? '').trim();
      const municipioIdCP     = (primero.c_mnpio  ?? '').trim();

      // PASO 2 — Cargar todos los municipios del estado
      const urlEstado = `${SEPOMEX_BASE}/estado/${estadoId}.json`;
      const resEstado = await fetch(urlEstado, { headers: { Accept: 'application/json' } });
      if (!resEstado.ok) throw new Error(`Estado no encontrado (${resEstado.status})`);

      const jsonEstado  = await resEstado.json();
      const municipios: any[] = jsonEstado?.data?.municipios ?? [];
      console.log('[Estado] Municipios:', municipios.length);

      // Construir mapa ciudad → municipios
      // En SEPOMEX la "ciudad" (d_ciudad) agrupa varios municipios.
      // Usaremos los postcodes del estado para hacer el mapa ciudad→municipios.
      const postcodesEstado: any[] = jsonEstado?.data?.postcodes ?? [];
      this._construirMapaCiudadMunicipios(postcodesEstado, municipios);

      // Ciudades únicas ordenadas del estado
      const ciudadesSet = new Set<string>();
      postcodesEstado.forEach((p: any) => {
        const c = (p.d_ciudad ?? '').trim();
        if (c) ciudadesSet.add(c);
      });
      // Agregar municipios como ciudades si d_ciudad está vacío
      municipios.forEach((m: any) => {
        if (!ciudadesSet.has(m.d_mnpio)) ciudadesSet.add(m.d_mnpio);
      });
      this.ciudadesDelEstado = [...ciudadesSet].sort();

      // PASO 3 — Asignar estado y detectar ciudad del CP
      this._estadoId = estadoId;
      this.estado    = estadoNorm;

      // Ciudad del CP: buscar en postcodesEstado la ciudad que contiene el municipio del CP
      let ciudadCP = '';
      for (const p of postcodesEstado) {
        if ((p.c_mnpio ?? '') === municipioIdCP && (p.d_ciudad ?? '').trim()) {
          ciudadCP = p.d_ciudad.trim();
          break;
        }
      }
      // Fallback: si no hay d_ciudad, usar el nombre del municipio
      if (!ciudadCP) ciudadCP = municipioNombreCP;

      this.ciudad = ciudadCP;

      // PASO 4 — Municipios de esa ciudad
      this._actualizarMunicipios(ciudadCP, municipioNombreCP);
      this.municipio   = municipioNombreCP;
      this._municipioId = municipioIdCP;

      // PASO 5 — Colonias del municipio del CP (ya las tenemos del paso 1)
      this._mapaColonias.set(municipioIdCP, coloniasCP.sort());
      this.coloniasDelMunicipio = [...new Set(coloniasCP)].sort();
      this.colonia = this.coloniasDelMunicipio[0] ?? '';

      this.cargandoCP = false;
      this.cdr.detectChanges();

    } catch (e: any) {
      console.error('[CP] Error:', e);
      this.errores.codigo_postal = 'No se encontró información para este CP.';
      this.cargandoCP = false;
      this._limpiarGeo();
      this.cdr.detectChanges();
    }
  }

  // ── Cascada Ciudad → Municipio → Colonia ─────────────────────────────────

  async onCiudadChange() {
    this.municipio            = '';
    this.colonia              = '';
    this.municipiosDelCiudad  = [];
    this.coloniasDelMunicipio = [];
    this._municipioId         = '';

    this._actualizarMunicipios(this.ciudad, '');
    this.municipio = this.municipiosDelCiudad[0] ?? '';

    if (this.municipio) {
      await this._cargarColonias(this.municipio);
    }
    this.cdr.detectChanges();
  }

  async onMunicipioChange() {
    this.colonia              = '';
    this.coloniasDelMunicipio = [];
    await this._cargarColonias(this.municipio);
    this.cdr.detectChanges();
  }

  private _construirMapaCiudadMunicipios(
    postcodes: any[],
    municipios: any[]
  ) {
    this._mapaCiudadMunicipios.clear();

    // Mapa c_mnpio → d_mnpio
    const idToNombre = new Map<string, string>();
    municipios.forEach(m => idToNombre.set(m.c_mnpio, m.d_mnpio));

    // Recorrer postcodesEstado para enlazar ciudad → municipios
    postcodes.forEach((p: any) => {
      const ciudad   = (p.d_ciudad ?? '').trim();
      const cMnpio   = (p.c_mnpio  ?? '').trim();
      const dMnpio   = (idToNombre.get(cMnpio) ?? p.d_mnpio ?? '').trim();
      if (!ciudad || !dMnpio) return;

      if (!this._mapaCiudadMunicipios.has(ciudad)) {
        this._mapaCiudadMunicipios.set(ciudad, []);
      }
      const lista = this._mapaCiudadMunicipios.get(ciudad)!;
      if (!lista.find(x => x.id === cMnpio)) {
        lista.push({ id: cMnpio, nombre: dMnpio });
      }
    });

    // Municipios sin ciudad: mapeados a sí mismos como ciudad
    municipios.forEach(m => {
      const nombre = m.d_mnpio;
      if (!this._mapaCiudadMunicipios.has(nombre)) {
        this._mapaCiudadMunicipios.set(nombre, [{ id: m.c_mnpio, nombre }]);
      }
    });
  }

  private _actualizarMunicipios(ciudad: string, preseleccionar: string) {
    const lista = this._mapaCiudadMunicipios.get(ciudad) ?? [];
    this.municipiosDelCiudad = lista.map(x => x.nombre).sort();

    // Si no hay municipios en el mapa para esa ciudad, al menos mostrar la ciudad misma
    if (this.municipiosDelCiudad.length === 0 && ciudad) {
      this.municipiosDelCiudad = [ciudad];
    }

    if (preseleccionar && this.municipiosDelCiudad.includes(preseleccionar)) {
      this.municipio = preseleccionar;
    } else {
      this.municipio = this.municipiosDelCiudad[0] ?? '';
    }
  }

  private async _cargarColonias(municipioNombre: string) {
    // Buscar el ID del municipio en el mapa
    let municipioId = '';
    for (const [, lista] of this._mapaCiudadMunicipios) {
      const found = lista.find(x => x.nombre === municipioNombre);
      if (found) { municipioId = found.id; break; }
    }

    if (!municipioId) {
      this.coloniasDelMunicipio = [];
      return;
    }

    this._municipioId = municipioId;

    // Si ya están en caché, usar directamente
    if (this._mapaColonias.has(municipioId)) {
      this.coloniasDelMunicipio = this._mapaColonias.get(municipioId)!;
      this.colonia = this.coloniasDelMunicipio[0] ?? '';
      return;
    }

    // Cargar desde la API
    try {
      this.cargandoCP = true;
      this.cdr.detectChanges();

      const url = `${SEPOMEX_BASE}/estado/${this._estadoId}/municipio/${municipioId}.json`;
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(`Municipio error ${res.status}`);

      const json      = await res.json();
      const posts: any[] = json?.data?.postcodes ?? [];

      const colonias = [...new Set<string>(
        posts.map((p: any) => (p.d_asenta ?? '').trim()).filter(Boolean)
      )].sort();

      this._mapaColonias.set(municipioId, colonias);
      this.coloniasDelMunicipio = colonias;
      this.colonia = colonias[0] ?? '';

    } catch (e) {
      console.error('[Colonias] Error:', e);
      this.coloniasDelMunicipio = [];
    } finally {
      this.cargandoCP = false;
      this.cdr.detectChanges();
    }
  }

  private _limpiarGeo() {
    this.estado               = '';
    this.ciudad               = '';
    this.municipio            = '';
    this.colonia              = '';
    this._estadoId            = '';
    this._municipioId         = '';
    this.ciudadesDelEstado    = [];
    this.municipiosDelCiudad  = [];
    this.coloniasDelMunicipio = [];
    this._mapaCiudadMunicipios.clear();
    this._mapaColonias.clear();
  }

  // ── Envío ─────────────────────────────────────────────────────────────────

  private formularioValido(): boolean {
    this.validarNombre();
    this.validarApellidoPaterno();
    this.validarApellidoMaterno();
    this.validarCorreo();
    this.validarNumeroEmpleado();
    this.validarTipo();
    this.validarContrasena();
    this.validarConfirmar();
    this.validarTerminos();
    this.validarTelefono();
    this.validarCodigoPostal();
    this.validarFechaNacimiento();
    return Object.values(this.errores).every(v => v === undefined);
  }

  crearCuenta() {
    if (this.cargando) return;
    this.errorGeneral = '';
    if (!this.formularioValido()) return;
    this.cargando = true;

    const datos: any = {
      nombre:           this.nombre.trim(),
      apellido_paterno: this.apellido_paterno.trim(),
      apellido_materno: this.apellido_materno.trim(),
      correo:           this.correo.trim().toLowerCase(),
      numero_empleado:  this.numero_empleado,
      contrasena:       this.contrasena,
      tipo:             this.tipo,
    };
    if (this.telefono)         datos.telefono         = this.telefono;
    if (this.direccion.trim()) datos.direccion        = this.direccion.trim();
    if (this.ciudad.trim())    datos.ciudad           = this.ciudad.trim();
    if (this.estado)           datos.estado           = this.estado;
    if (this.municipio)        datos.municipio        = this.municipio;
    if (this.colonia)          datos.colonia          = this.colonia;
    if (this.codigo_postal)    datos.codigo_postal    = this.codigo_postal;
    if (this.fecha_nacimiento) datos.fecha_nacimiento = this.fecha_nacimiento;

    this.authService.registro(datos).subscribe({
      next: () => {
        this.cargando     = false;
        this.mostrarModal = true;
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        const msg    = this.extraerMensaje(err);
        const msgLow = msg.toLowerCase();
        const status = err.status ?? 0;

        if (status === 409) {
          if (msgLow.includes('correo') || msgLow.includes('email')) {
            this.mostrarError('¡Correo ya registrado!', 'Este correo ya tiene una cuenta. Prueba con otro o inicia sesión.');
          } else if (msgLow.includes('empleado') || msgLow.includes('numero') || msgLow.includes('número')) {
            this.mostrarError('¡Número ya registrado!', 'Este número ya tiene una cuenta. Verifica e intenta de nuevo.');
          } else {
            this.mostrarError('¡Usuario ya existe!', msg);
          }
        } else {
          this.mostrarError('Error al crear la cuenta', msg);
        }
      }
    });
  }

  irAlLogin() { this.router.navigate(['/login']); }
}