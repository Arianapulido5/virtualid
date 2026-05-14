// src/app/pages/configuracion/configuracion.ts
import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { GeocodingService } from '../../services/geocoding';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-configuracion',
  standalone: true,
  imports: [RouterLink, FormsModule, CommonModule],
  templateUrl: './configuracion.html',
  styleUrls: ['./configuracion.scss']
})
export class Configuracion implements OnInit {

  biometrica     = true;
  notificaciones = true;
  showIdiomas    = false;
  idiomaActual   = 'Español';

  // ── Ubicación de la institución ──────────────────────────────────────────
  cargandoInstitucion = true;
  institucionNombre   = '';
  direccionGeo        = '';
  radioMetros: number | null = null;
  tieneUbicacion      = false;
  cargandoGeo         = false;

  idiomas = ['Español', 'English', 'Français', 'Deutsch', 'Português', 'Italiano'];

  private apiUrl = environment.apiUrl;

  constructor(
    private router:    Router,
    private http:      HttpClient,
    private geocoding: GeocodingService,
    private cdr:       ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.cargarInstitucion();
  }

  private get headers(): HttpHeaders {
    return new HttpHeaders({
      Authorization: `Bearer ${localStorage.getItem('token') ?? ''}`
    });
  }

  /** Carga la institución a la que pertenece el usuario mediante sus credenciales */
  private cargarInstitucion(): void {
    this.cargandoInstitucion = true;

    this.http.get<any[]>(
      `${this.apiUrl}/credenciales?t=${Date.now()}`,
      { headers: this.headers }
    ).subscribe({
      next: (creds) => {
        // Tomamos la primera credencial activa para obtener la institución
        const activa = creds.find(c => c.estado === 'activa') ?? creds[0];
        if (!activa) {
          this.cargandoInstitucion = false;
          this.cdr.detectChanges();
          return;
        }

        // Obtenemos detalles de la institución a través del endpoint de credencial
        this.http.get<any>(
          `${this.apiUrl}/credenciales/${activa.id}?t=${Date.now()}`,
          { headers: this.headers }
        ).subscribe({
          next: (detalle) => {
            this.institucionNombre   = detalle.institucion_nombre ?? '';
            this.radioMetros         = detalle.inst_radio ?? null;
            const lat = detalle.inst_lat ?? null;
            const lng = detalle.inst_lng ?? null;
            this.tieneUbicacion      = !!(lat && lng);
            this.cargandoInstitucion = false;
            this.cdr.detectChanges();

            if (lat && lng) {
              this.cargandoGeo = true;
              this.cdr.detectChanges();
              this.geocoding.obtenerDireccion(lat, lng).subscribe(dir => {
                this.direccionGeo = dir;
                this.cargandoGeo  = false;
                this.cdr.detectChanges();
              });
            }
          },
          error: () => {
            this.cargandoInstitucion = false;
            this.cdr.detectChanges();
          }
        });
      },
      error: () => {
        this.cargandoInstitucion = false;
        this.cdr.detectChanges();
      }
    });
  }

  toggleIdioma() { this.showIdiomas = !this.showIdiomas; }

  seleccionarIdioma(idioma: string) {
    this.idiomaActual = idioma;
    this.showIdiomas  = false;
  }

  cerrarSesion() {
    this.router.navigate(['/login'], { replaceUrl: true });
  }
}