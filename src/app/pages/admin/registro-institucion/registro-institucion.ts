// src/app/pages/admin/registro-institucion/registro-institucion.ts
import { Component, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { MapaSelectorComponent } from '../../../shared/mapa-selector/mapa-selector';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-registro-institucion',
  standalone: true,
  imports: [CommonModule, FormsModule, MapaSelectorComponent],
  templateUrl: './registro-institucion.html',
  styleUrls: ['./registro-institucion.scss']
})
export class RegistroInstitucion {

  cargando     = false;
  mostrarModal = false;
  errorMsg     = '';
  confirmar    = '';
  showPassword = false;
  showConfirm  = false;

  // Props para sincronizar con el mapa
  mapaLat: number | null = null;
  mapaLng: number | null = null;

  // ✅ Control para la verificación asíncrona del dominio
  private dominioTimer: any = null;
  verificandoDominio = false;

  form = {
    nombre_institucion: '',
    tipo:               '',
    rfc:                '',
    dominio:            '',
    correo_contacto:    '',
    ciudad:             '',
    estado:             '',
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

  get tieneUpperCase() { return /[A-Z]/.test(this.form.contrasena); }
  get tieneNumero()    { return /[0-9]/.test(this.form.contrasena); }
  get tieneEspecial()  { return /[!@#$%^&*()\-_=+\[\]{};':"\\|,.<>/?]/.test(this.form.contrasena); }

  constructor(
    private http: HttpClient,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  togglePassword() { this.showPassword = !this.showPassword; }
  toggleConfirm()  { this.showConfirm  = !this.showConfirm;  }

  // ── Callback del mapa ───────────────────────────────────────────────────────
  onCoordsChange(coords: { lat: number; lng: number } | null): void {
    if (coords) {
      this.form.latitud  = coords.lat;
      this.form.longitud = coords.lng;
      this.mapaLat       = coords.lat;
      this.mapaLng       = coords.lng;
    } else {
      this.form.latitud  = '';
      this.form.longitud = '';
      this.mapaLat       = null;
      this.mapaLng       = null;
    }
    this.cdr.detectChanges();
  }

  onLugarChange(lugar: { ciudad: string; estado: string } | null): void {
    if (!lugar) return;
    if (lugar.ciudad) this.form.ciudad = lugar.ciudad;
    if (lugar.estado) this.form.estado = lugar.estado;
    this.cdr.detectChanges();
  }

  // ── Geolocalización del navegador ───────────────────────────────────────────
  usarUbicacionActual(): void {
    if (!navigator.geolocation) {
      alert('Tu navegador no soporta geolocalización.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = parseFloat(pos.coords.latitude.toFixed(7));
        const lng = parseFloat(pos.coords.longitude.toFixed(7));
        this.form.latitud  = lat;
        this.form.longitud = lng;
        this.mapaLat       = lat;
        this.mapaLng       = lng;
        this.cdr.detectChanges();
      },
      (err) => {
        console.warn('No se pudo obtener la ubicación:', err.message);
        alert('No se pudo obtener tu ubicación. Selecciónala en el mapa.');
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  }

  // ── Verificación asíncrona del dominio contra la API ────────────────────────
  private verificarDominioDisponible(dominio: string): void {
    if (this.dominioTimer) clearTimeout(this.dominioTimer);

    this.dominioTimer = setTimeout(() => {
      this.verificandoDominio = true;
      this.cdr.detectChanges();

      this.http.get<{ disponible: boolean }>(
        `${environment.apiUrl}/admin/verificar-dominio?dominio=${encodeURIComponent(dominio)}`
      ).subscribe({
        next: (res) => {
          if (!res.disponible) {
            this.errores['dominio'] = 'Este dominio ya está registrado por otra institución.';
          } else {
            if (this.errores['dominio'] === 'Este dominio ya está registrado por otra institución.') {
              this.errores['dominio'] = undefined;
            }
          }
          this.verificandoDominio = false;
          this.cdr.detectChanges();
        },
        error: () => {
          this.verificandoDominio = false;
          this.cdr.detectChanges();
        }
      });
    }, 600);
  }

  v = {
    nombre_institucion: () => {
      const val = String(this.form.nombre_institucion).trim();
      this.errores['nombre_institucion'] = (!val || val.length < 3) ? 'Mínimo 3 caracteres.' : undefined;
    },
    tipo: () => {
      this.errores['tipo'] = !String(this.form.tipo).trim() ? 'El tipo es obligatorio.' : undefined;
    },
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
      if (!val) {
        this.errores['dominio'] = 'El dominio es obligatorio.';
        return;
      }
      if (!val.startsWith('@')) {
        this.errores['dominio'] = 'Debe comenzar con @ (ej: @utec.edu.mx).';
        return;
      }
      if (!val.includes('.')) {
        this.errores['dominio'] = 'Dominio inválido.';
        return;
      }
      this.errores['dominio'] = undefined;
      this.verificarDominioDisponible(val);
    },
    correo_contacto: () => {
      const val = String(this.form.correo_contacto).trim();
      const re  = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
      if (!val)               this.errores['correo_contacto'] = 'El correo es obligatorio.';
      else if (!re.test(val)) this.errores['correo_contacto'] = 'Ingresa un correo válido.';
      else                    this.errores['correo_contacto'] = undefined;
    },
    ciudad: () => {
      this.errores['ciudad'] = !String(this.form.ciudad).trim() ? 'La ciudad es obligatoria.' : undefined;
    },
    estado: () => {
      this.errores['estado'] = !this.form.estado ? 'Selecciona un estado.' : undefined;
    },
    nombre: () => {
      const val = String(this.form.nombre).trim();
      if (!val)                                this.errores['nombre'] = 'El nombre es obligatorio.';
      else if (!/^[a-zA-ZÀ-ÿ\s]+$/.test(val)) this.errores['nombre'] = 'Solo se permiten letras.';
      else if (val.length < 2)                 this.errores['nombre'] = 'Mínimo 2 caracteres.';
      else                                     this.errores['nombre'] = undefined;
    },
    apellido_paterno: () => {
      const val = String(this.form.apellido_paterno).trim();
      if (!val)                                this.errores['apellido_paterno'] = 'El apellido paterno es obligatorio.';
      else if (!/^[a-zA-ZÀ-ÿ\s]+$/.test(val)) this.errores['apellido_paterno'] = 'Solo se permiten letras.';
      else if (val.length < 2)                 this.errores['apellido_paterno'] = 'Mínimo 2 caracteres.';
      else                                     this.errores['apellido_paterno'] = undefined;
    },
    apellido_materno: () => {
      const val = String(this.form.apellido_materno).trim();
      if (!val)                                this.errores['apellido_materno'] = 'El apellido materno es obligatorio.';
      else if (!/^[a-zA-ZÀ-ÿ\s]+$/.test(val)) this.errores['apellido_materno'] = 'Solo se permiten letras.';
      else if (val.length < 2)                 this.errores['apellido_materno'] = 'Mínimo 2 caracteres.';
      else                                     this.errores['apellido_materno'] = undefined;
    },
    correo_admin: () => {
      const val = String(this.form.correo_admin).trim();
      const re  = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
      if (!val)               this.errores['correo_admin'] = 'El correo del administrador es obligatorio.';
      else if (!re.test(val)) this.errores['correo_admin'] = 'Ingresa un correo válido.';
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
      if (!this.confirmar)                               this.errores['confirmar'] = 'Confirma tu contraseña.';
      else if (this.form.contrasena !== this.confirmar)  this.errores['confirmar'] = 'Las contraseñas no coinciden.';
      else                                               this.errores['confirmar'] = undefined;
    },
  };

  private validarTodo(): boolean {
    Object.values(this.v).forEach(fn => fn());
    return Object.values(this.errores).every(e => e === undefined);
  }

  registrar(): void {
    this.errorMsg = '';

    if (this.verificandoDominio) {
      this.errorMsg = 'Espera a que se verifique el dominio.';
      return;
    }

    if (!this.validarTodo()) return;

    this.cargando = true;
    this.cdr.detectChanges();

    const payload: any = {
      nombre_institucion: this.form.nombre_institucion,
      tipo:               this.form.tipo,
      rfc:                this.form.rfc,
      dominio:            this.form.dominio,
      correo_contacto:    this.form.correo_contacto,
      ciudad:             this.form.ciudad,
      estado:             this.form.estado,
      nombre:             this.form.nombre,
      apellido_paterno:   this.form.apellido_paterno,
      apellido_materno:   this.form.apellido_materno,
      correo_admin:       this.form.correo_admin,
      contrasena:         this.form.contrasena,
      radio_metros:       this.form.radio_metros || 200
    };

    if (this.form.latitud  !== '' && this.form.latitud  !== null) payload.latitud  = this.form.latitud;
    if (this.form.longitud !== '' && this.form.longitud !== null) payload.longitud = this.form.longitud;

    this.http.post<any>(`${environment.apiUrl}/admin/registro-institucion`, payload).subscribe({
      next: () => {
        this.cargando     = false;
        this.mostrarModal = true;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.cargando = false;
        this.errorMsg = err.error?.message || 'Error al registrar la institución.';
        if (this.errorMsg.includes('dominio')) {
          this.errores['dominio'] = this.errorMsg;
        }
        this.cdr.detectChanges();
      }
    });
  }

  irAlLogin(): void { this.router.navigate(['/login']); }
  cancelar(): void  { this.router.navigate(['/login']); }
}