// src/app/pages/ubicacion/ubicacion.ts
import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { GeocodingService } from '../../services/geocoding';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-ubicacion',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './ubicacion.html',
  styleUrls: ['./ubicacion.scss']
})
export class Ubicacion implements OnInit {

  cargando          = true;
  cargandoGeo       = false;
  institucionNombre = '';
  direccionGeo      = '';
  tieneUbicacion    = false;
  latitud:    number | null = null;
  longitud:   number | null = null;
  radioMetros: number | null = null;

  private apiUrl = environment.apiUrl;

  constructor(
    private router:    Router,
    private http:      HttpClient,
    private geocoding: GeocodingService,
    private cdr:       ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.cargarUbicacion();
  }

  private get headers(): HttpHeaders {
    return new HttpHeaders({
      Authorization: `Bearer ${localStorage.getItem('token') ?? ''}`
    });
  }

  private cargarUbicacion(): void {
    this.cargando = true;

    this.http.get<any[]>(
      `${this.apiUrl}/credenciales?t=${Date.now()}`,
      { headers: this.headers }
    ).subscribe({
      next: (creds) => {
        const activa = creds.find(c => c.estado === 'activa') ?? creds[0];
        if (!activa) {
          this.cargando = false;
          this.cdr.detectChanges();
          return;
        }

        this.http.get<any>(
          `${this.apiUrl}/credenciales/${activa.id}?t=${Date.now()}`,
          { headers: this.headers }
        ).subscribe({
          next: (detalle) => {
            this.institucionNombre = detalle.institucion_nombre ?? '';
            this.radioMetros         = detalle.inst_radio ?? null;
            const lat = detalle.inst_lat ?? null;
            const lng = detalle.inst_lng ?? null;
            this.latitud          = lat;
            this.longitud         = lng;
            this.tieneUbicacion   = !!(lat && lng);
            this.cargando         = false;
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
            this.cargando = false;
            this.cdr.detectChanges();
          }
        });
      },
      error: () => {
        this.cargando = false;
        this.cdr.detectChanges();
      }
    });
  }

irAConfiguracion(): void {
  this.router.navigate(['/configuracion'], { replaceUrl: true });
}
}