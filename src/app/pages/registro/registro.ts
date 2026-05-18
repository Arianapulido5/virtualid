// src/app/pages/registro/registro.ts
import { Component, ChangeDetectorRef } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { NgIf, CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Auth } from '../../services/auth';

// Estructura que devuelve la API de Copomex
interface CopomexRespuesta {
  error:   boolean;
  codigo_postal: string;
  municipio:     string;
  ciudad:        string;
  estado:        string;
  asentamiento:  string;       // colonia principal (primer resultado)
  tipo_asentamiento: string;
  colonias?: string[];         // lista completa de colonias del CP
}

@Component({
  selector: 'app-registro',
  standalone: true,
  imports: [RouterLink, NgIf, CommonModule, FormsModule],
  templateUrl: './registro.html',
  styleUrl: './registro.scss'
})
export class Registro {
  showPassword   = false;
  showConfirm    = false;
  cargando       = false;
  cargandoCP     = false;
  aceptaTerminos = false;
  mostrarModal   = false;
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

  // Listas para los selects
  municipiosDisponibles: string[] = [];
  coloniasDisponibles:   string[] = [];

  // Mapa interno: municipio → colonias (para filtrar al cambiar municipio)
  private coloniasPorMunicipio: Map<string, string[]> = new Map();

  errorGeneral = '';

  readonly estadosMexico = [
    'Aguascalientes','Baja California','Baja California Sur','Campeche',
    'Chiapas','Chihuahua','Ciudad de México','Coahuila','Colima','Durango',
    'Estado de México','Guanajuato','Guerrero','Hidalgo','Jalisco',
    'Michoacán','Morelos','Nayarit','Nuevo León','Oaxaca','Puebla',
    'Querétaro','Quintana Roo','San Luis Potosí','Sinaloa','Sonora',
    'Tabasco','Tamaulipas','Tlaxcala','Veracruz','Yucatán','Zacatecas'
  ];

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

  cerrarModalError() {
    this.mostrarModalError = false;
    this.cdr.detectChanges();
  }

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
        try {
          const parsed = JSON.parse(err.error);
          return parsed.message ?? parsed.error ?? err.error;
        } catch {
          return err.error;
        }
      }
      if (err.error && typeof err.error === 'object') {
        return err.error.message ?? err.error.error ?? JSON.stringify(err.error);
      }
      return err.message ?? 'Ocurrió un error inesperado. Intenta de nuevo.';
    } catch {
      return 'Ocurrió un error inesperado. Intenta de nuevo.';
    }
  }

  // ── Validaciones ────────────────────────────────────────────────────────────

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
    const v = this.correo.trim();
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
    else if (this.contrasena !== this.confirmar)  this.errores.confirmar = 'Las contraseñas no coinciden.';
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

  // ── Lógica de Código Postal con API Copomex ──────────────────────────────

  /**
   * Consulta la API gratuita de Copomex (datos postales de México).
   * Endpoint: https://api.copomex.com/query/info_cp/{CP}?type=simplified&token=pruebas
   *
   * NOTA: El token "pruebas" es público y funciona para desarrollo.
   * Para producción obtén tu token en https://copomex.com
   *
   * Respuesta esperada: array de asentamientos, cada uno con:
   *   { municipio, estado, ciudad, asentamiento }
   */
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

      fetch(`https://api.copomex.com/query/info_cp/${v}?type=simplified&token=pruebas`)
        .then(res => {
          if (!res.ok) throw new Error('No encontrado');
          return res.json();
        })
        .then((data: any[]) => {
          if (!Array.isArray(data) || data.length === 0) throw new Error('Sin datos');

          // Todos los items comparten municipio, estado y ciudad
          const primero = data[0];

          // ── Estado ──
          const estadoApi: string = (primero.estado ?? '').toLowerCase();
          const matchEstado = this.estadosMexico.find(e =>
            estadoApi.includes(e.toLowerCase()) || e.toLowerCase().includes(estadoApi)
          );
          this.estado = matchEstado ?? primero.estado ?? '';

          // ── Ciudad ──
          this.ciudad = primero.ciudad ?? primero.municipio ?? '';

          // ── Municipios únicos del CP ──
          const municipiosSet = new Set<string>(
            data.map((d: any) => d.municipio).filter(Boolean)
          );
          this.municipiosDisponibles = Array.from(municipiosSet).sort();

          // ── Mapa municipio → colonias ──
          this.coloniasPorMunicipio = new Map();
          data.forEach((d: any) => {
            if (!d.municipio || !d.asentamiento) return;
            if (!this.coloniasPorMunicipio.has(d.municipio)) {
              this.coloniasPorMunicipio.set(d.municipio, []);
            }
            this.coloniasPorMunicipio.get(d.municipio)!.push(d.asentamiento);
          });

          // ── Municipio por defecto (primer resultado) ──
          const municipioDefault = primero.municipio ?? '';
          this.municipio = this.municipiosDisponibles.includes(municipioDefault)
            ? municipioDefault
            : (this.municipiosDisponibles[0] ?? '');

          // ── Colonias del municipio seleccionado ──
          this._cargarColoniasDeMunicipio(this.municipio);

          // ── Colonia por defecto (primer asentamiento) ──
          this.colonia = primero.asentamiento ?? (this.coloniasDisponibles[0] ?? '');

          this.cargandoCP = false;
          this.cdr.detectChanges();
        })
        .catch(() => {
          this.cargandoCP = false;
          this._limpiarGeo();
          this.cdr.detectChanges();
        });
    }
  }

  /** Cuando el usuario cambia manualmente el municipio, recarga las colonias */
  onMunicipioChange() {
    this._cargarColoniasDeMunicipio(this.municipio);
    this.colonia = this.coloniasDisponibles[0] ?? '';
    this.cdr.detectChanges();
  }

  private _cargarColoniasDeMunicipio(municipio: string) {
    const lista = this.coloniasPorMunicipio.get(municipio) ?? [];
    // Ordenar alfabéticamente y eliminar duplicados
    this.coloniasDisponibles = [...new Set(lista)].sort();
  }

  private _limpiarGeo() {
    this.estado               = '';
    this.ciudad               = '';
    this.municipio            = '';
    this.colonia              = '';
    this.municipiosDisponibles = [];
    this.coloniasDisponibles   = [];
    this.coloniasPorMunicipio  = new Map();
  }

  // ── Envío ────────────────────────────────────────────────────────────────────

  private formularioValido(): boolean {
    this.validarNombre(); this.validarApellidoPaterno(); this.validarApellidoMaterno();
    this.validarCorreo(); this.validarNumeroEmpleado(); this.validarTipo();
    this.validarContrasena(); this.validarConfirmar(); this.validarTerminos();
    this.validarTelefono(); this.validarCodigoPostal(); this.validarFechaNacimiento();
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
    if (this.telefono)             datos.telefono         = this.telefono;
    if (this.direccion.trim())     datos.direccion        = this.direccion.trim();
    if (this.ciudad.trim())        datos.ciudad           = this.ciudad.trim();
    if (this.estado)               datos.estado           = this.estado;
    if (this.municipio)            datos.municipio        = this.municipio;
    if (this.colonia)              datos.colonia          = this.colonia;
    if (this.codigo_postal)        datos.codigo_postal    = this.codigo_postal;
    if (this.fecha_nacimiento)     datos.fecha_nacimiento = this.fecha_nacimiento;

    this.authService.registro(datos).subscribe({
      next: () => {
        this.cargando = false;
        this.mostrarModal = true;
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        const msg = this.extraerMensaje(err);
        const msgLower = msg.toLowerCase();
        const status = err.status ?? 0;

        if (status === 409) {
          if (msgLower.includes('correo') || msgLower.includes('email')) {
            this.mostrarError(
              '¡Correo ya registrado!',
              'Este correo electrónico ya tiene una cuenta. Prueba con otro correo o inicia sesión.'
            );
          } else if (msgLower.includes('empleado') || msgLower.includes('numero') || msgLower.includes('número')) {
            this.mostrarError(
              '¡Número ya registrado!',
              'Este número de empleado/estudiante ya tiene una cuenta. Verifica el número e intenta de nuevo.'
            );
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