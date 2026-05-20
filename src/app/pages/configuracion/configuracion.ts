// src/app/pages/configuracion/configuracion.ts
import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { GeocodingService } from '../../services/geocoding';
import { environment } from '../../../environments/environment';
import { PushService } from '../../services/push.service';

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

  cargandoInstitucion = true;
  institucionNombre   = '';
  direccionGeo        = '';
  radioMetros: number | null = null;
  tieneUbicacion      = false;
  cargandoGeo         = false;

  idiomas = ['Español', 'English', 'Français', 'Deutsch', 'Português', 'Italiano'];

  private apiUrl = environment.apiUrl;

  constructor(
    private router:      Router,
    private http:        HttpClient,
    private geocoding:   GeocodingService,
    private cdr:         ChangeDetectorRef,
    private pushService: PushService
  ) {}

  ngOnInit(): void {
    this.cargarInstitucion();
    this.cargarPreferencias();
  }

  private get headers(): HttpHeaders {
    return new HttpHeaders({
      Authorization: `Bearer ${localStorage.getItem('token') ?? ''}`
    });
  }

private cargarPreferencias(): void {
  this.http.get<any>(`${this.apiUrl}/usuario/preferencias`, { headers: this.headers })
    .subscribe({
      next: (prefs) => {
        console.log('PREFERENCIAS:', prefs);
        this.notificaciones = prefs.notificaciones_push ?? true;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.log('ERROR PREFERENCIAS:', err.status, err.error);
      }
    });
}

  private cargarInstitucion(): void {
    this.cargandoInstitucion = true;

    this.http.get<any[]>(
      `${this.apiUrl}/credenciales?t=${Date.now()}`,
      { headers: this.headers }
    ).subscribe({
      next: (creds) => {
        const activa = creds.find(c => c.estado === 'activa') ?? creds[0];
        if (!activa) {
          this.cargandoInstitucion = false;
          this.cdr.detectChanges();
          return;
        }

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

  toggleNotificaciones(): void {
  console.log('TOGGLE valor actual:', this.notificaciones);
  if (this.notificaciones) {
    this.pushService.inicializar().then(() => {
      this.http.put(
        `${this.apiUrl}/usuario/preferencias`,
        { notificaciones_push: true },
        { headers: this.headers }
      ).subscribe({
        next: (r) => console.log('PUT OK:', r),
        error: (e) => console.log('PUT ERROR:', e.status, e.error)
      });
    });
  } else {
    this.pushService.desactivar();
    this.http.put(
      `${this.apiUrl}/usuario/preferencias`,
      { notificaciones_push: false },
      { headers: this.headers }
    ).subscribe({
      next: (r) => console.log('PUT OK:', r),
      error: (e) => {
        console.log('PUT ERROR:', e.status, e.error);
        this.notificaciones = true;
        this.cdr.detectChanges();
      }
    });
  }
}

  toggleIdioma(): void { this.showIdiomas = !this.showIdiomas; }

  seleccionarIdioma(idioma: string): void {
    this.idiomaActual = idioma;
    this.showIdiomas  = false;
  }

  cerrarSesion(): void {
    this.router.navigate(['/login'], { replaceUrl: true });
  }
}