// src/app/pages/admin/mi-institucion/mi-institucion.ts
import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { SidebarAdminComponent } from '../../../shared/sidebar-admin/sidebar-admin';
import { environment } from '../../../../environments/environment';

interface InstitucionData {
  id:              number;
  nombre:          string;
  tipo:            string;
  rfc:             string;
  dominio_correo:  string;
  ciudad:          string;
  estado:          string;
  creado_en:       string;
  latitud:         number | null;
  longitud:        number | null;
  radio_metros:    number | null;
  codigo_postal:   string | null;
  municipio:       string | null;
  colonia:         string | null;
  direccion:       string | null;
  stats: {
    usuarios_registrados: number;
    credenciales_activas: number;
    puntos_acceso:        number;
    administradores:      number;
  };
}

@Component({
  selector: 'app-mi-institucion',
  standalone: true,
  imports: [CommonModule, RouterLink, SidebarAdminComponent],
  templateUrl: './mi-institucion.html',
  styleUrls: ['./mi-institucion.scss']
})
export class MiInstitucion implements OnInit {

  cargando    = true;
  errorMsg    = '';

  institucion:  InstitucionData | null = null;
  iniciales     = '';

  // Dirección que se muestra en la fila — puede venir del campo `direccion`
  // de la BD o, si está vacío, del reverse geocode de las coordenadas
  direccionMostrar  = '';
  cargandoDireccion = false;

  resumen: { label: string; valor: string; ruta: string }[] = [
    { label: 'Usuarios registrados', valor: '—', ruta: '/admin/usuarios' },
    { label: 'Credenciales activas', valor: '—', ruta: '/admin/credenciales' },
    { label: 'Puntos de acceso',     valor: '—', ruta: '/admin/puntos-acceso' },
    { label: 'Administradores',      valor: '—', ruta: '/admin/administradores' },
  ];

  constructor(
    private http:   HttpClient,
    private cdr:    ChangeDetectorRef,
    private router: Router
  ) {}

  ngOnInit(): void { this.cargar(); }

  irA(ruta: string): void { this.router.navigate([ruta]); }

  cargar(): void {
    this.cargando         = true;
    this.errorMsg         = '';
    this.institucion      = null;
    this.direccionMostrar = '';

    const token   = localStorage.getItem('token') ?? '';
    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });

    this.http
      .get<InstitucionData>(`${environment.apiUrl}/admin/mi-institucion`, { headers })
      .subscribe({
        next: (data) => {
          this.institucion = data;

          const palabras = data.nombre.trim().split(/\s+/);
          this.iniciales = palabras.length >= 2
            ? (palabras[0][0] + palabras[1][0]).toUpperCase()
            : palabras[0].substring(0, 2).toUpperCase();

          this.resumen = [
            { label: 'Usuarios registrados', valor: String(data.stats.usuarios_registrados), ruta: '/admin/usuarios' },
            { label: 'Credenciales activas', valor: String(data.stats.credenciales_activas), ruta: '/admin/credenciales' },
            { label: 'Puntos de acceso',     valor: String(data.stats.puntos_acceso),        ruta: '/admin/puntos-acceso' },
            { label: 'Administradores',      valor: String(data.stats.administradores ?? 1), ruta: '/admin/administradores' },
          ];

          this.cargando = false;
          this.cdr.detectChanges();

          // Si hay dirección guardada en BD, mostrarla directamente
          if (data.direccion && data.direccion.trim()) {
            this.direccionMostrar = data.direccion.trim();
            this.cdr.detectChanges();
          } else if (data.latitud && data.longitud) {
            // Sin dirección guardada pero con coordenadas: hacer reverse geocode
            this.geocodificarDireccion(data.latitud, data.longitud);
          }
        },
        error: (err) => {
          console.error('Error cargando institución:', err);
          this.errorMsg = 'No se pudo cargar la información de la institución.';
          this.cargando = false;
          this.cdr.detectChanges();
        },
      });
  }

  private geocodificarDireccion(lat: number, lng: number): void {
    this.cargandoDireccion = true;
    this.cdr.detectChanges();

    this.http.get<any>(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=es`,
      { headers: { 'Accept-Language': 'es' } }
    ).subscribe({
      next: (res) => {
        if (res?.display_name) {
          const a = res.address ?? {};
          const partes: string[] = [];
          if (a.road)         partes.push(a.road);
          if (a.house_number) partes[0] = (partes[0] ?? '') + ' ' + a.house_number;
          if (a.suburb || a.neighbourhood || a.city_district)
            partes.push(a.suburb ?? a.neighbourhood ?? a.city_district);
          if (a.city || a.town || a.village)
            partes.push(a.city ?? a.town ?? a.village);
          if (a.state) partes.push(a.state);
          this.direccionMostrar = partes.filter(Boolean).join(', ') || res.display_name;
        }
        this.cargandoDireccion = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.cargandoDireccion = false;
        this.cdr.detectChanges();
      }
    });
  }
}