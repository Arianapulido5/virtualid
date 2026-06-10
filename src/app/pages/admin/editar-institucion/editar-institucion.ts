import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { SidebarAdminComponent } from '../../../shared/sidebar-admin/sidebar-admin';
import { MapaSelectorComponent } from '../../../shared/mapa-selector/mapa-selector';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-editar-institucion',
  standalone: true,
  imports: [CommonModule, FormsModule, SidebarAdminComponent, RouterLink, MapaSelectorComponent],
  templateUrl: './editar-institucion.html',
  styleUrls: ['./editar-institucion.scss']
})
export class EditarInstitucion implements OnInit {

  cargando      = false;
  cargandoDatos = true;
  errorMsg      = '';
  exitoso       = false;

  mapaLat: number | null = null;
  mapaLng: number | null = null;

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

  onLugarChange(lugar: { ciudad: string; estado: string } | null): void {
    if (!lugar) return;
    if (lugar.ciudad) this.form.ciudad = lugar.ciudad;
    if (lugar.estado) this.form.estado = lugar.estado;
    this.cdr.detectChanges();
  }

  cargarDatos(): void {
    const token   = localStorage.getItem('token') ?? '';
    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });

    this.http.get<any>(`${environment.apiUrl}/admin/mi-institucion`, { headers }).subscribe({
      next: (data) => {
        this.form.nombre_institucion = data.nombre          ?? '';
        this.form.tipo               = data.tipo            ?? '';
        this.form.rfc                = data.rfc             ?? '';
        this.form.dominio            = data.dominio_correo  ?? '';
        this.form.ciudad             = data.ciudad          ?? '';
        this.form.estado             = data.estado          ?? '';
        this.form.latitud            = data.latitud         ?? '';
        this.form.longitud           = data.longitud        ?? '';
        this.form.radio_metros       = data.radio_metros    ?? 200;
        this.mapaLat = data.latitud  ?? null;
        this.mapaLng = data.longitud ?? null;
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

  guardar(): void {
    this.errorMsg = '';
    if (!this.validarTodo()) return;

    this.cargando = true;
    this.cdr.detectChanges();

    const token   = localStorage.getItem('token') ?? '';
    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });

    const payload: any = {
      nombre:          this.form.nombre_institucion,
      tipo:            this.form.tipo,
      rfc:             this.form.rfc,
      dominio:         this.form.dominio,
      ciudad:          this.form.ciudad,
      estado:          this.form.estado,
      radio_metros:    this.form.radio_metros || 200,
      latitud:  (this.form.latitud  !== '' && this.form.latitud  !== null) ? this.form.latitud  : null,
      longitud: (this.form.longitud !== '' && this.form.longitud !== null) ? this.form.longitud : null,
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