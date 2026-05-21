// src/app/pages/configuracion/configuracion.ts
import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { GeocodingService } from '../../services/geocoding';
import { environment } from '../../../environments/environment';
import { PushService } from '../../services/push.service';
import { BiometricaService } from '../../services/biometrica.service';

@Component({
  selector: 'app-configuracion',
  standalone: true,
  imports: [RouterLink, FormsModule, CommonModule],
  templateUrl: './configuracion.html',
  styleUrls: ['./configuracion.scss'],
})
export class Configuracion implements OnInit {

  biometrica     = false;
  notificaciones = true;
  showIdiomas    = false;
  idiomaActual   = 'Español';

  cargandoInstitucion = true;
  institucionNombre   = '';
  direccionGeo        = '';
  radioMetros: number | null = null;
  tieneUbicacion      = false;
  cargandoGeo         = false;

  // Biometría
  cargandoBiometrica    = true;   // mientras consulta el estado
  biometricaSoportada   = false;  // el dispositivo soporta WebAuthn
  procesandoBiometrica  = false;  // durante activación/desactivación

  idiomas = ['Español', 'English', 'Français', 'Deutsch', 'Português', 'Italiano'];

  private apiUrl = environment.apiUrl;

  constructor(
    private router:      Router,
    private http:        HttpClient,
    private geocoding:   GeocodingService,
    private cdr:         ChangeDetectorRef,
    private pushService: PushService,
    private bioService:  BiometricaService,
  ) {}

  ngOnInit(): void {
    this.cargarInstitucion();
    this.cargarPreferencias();
    this.cargarEstadoBiometrica();

    // Detectar soporte del dispositivo
    BiometricaService.soportado().then((ok) => {
      this.biometricaSoportada = ok;
      this.cdr.detectChanges();
    });
  }

  private get headers(): HttpHeaders {
    return new HttpHeaders({
      Authorization: `Bearer ${localStorage.getItem('token') ?? ''}`,
    });
  }

  // ── Estado biométrico ────────────────────────────────────────────────────

  private cargarEstadoBiometrica(): void {
    this.cargandoBiometrica = true;
    this.bioService.obtenerEstado().subscribe({
      next: (estado) => {
        this.biometrica        = estado.activa;
        this.cargandoBiometrica = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.cargandoBiometrica = false;
        this.cdr.detectChanges();
      },
    });
  }

  // ── Toggle biometría ─────────────────────────────────────────────────────

  toggleBiometrica(): void {
    if (this.procesandoBiometrica) return;

    if (this.biometrica) {
      // El toggle está ON → el usuario quiere ACTIVAR
      // Verificar soporte antes
      if (!this.biometricaSoportada) {
        this.biometrica = false;
        this.cdr.detectChanges();
        return;
      }
      // Redirigir a pantalla de registro biométrico
      this.router.navigate(['/biometrica']);
    } else {
      // El toggle está OFF → el usuario quiere DESACTIVAR
      this.procesandoBiometrica = true;
      this.cdr.detectChanges();

      this.bioService.desactivar().subscribe({
        next: () => {
          this.biometrica          = false;
          this.procesandoBiometrica = false;
          this.cdr.detectChanges();
        },
        error: () => {
          // Revertir si falló
          this.biometrica          = true;
          this.procesandoBiometrica = false;
          this.cdr.detectChanges();
        },
      });
    }
  }

  // ── Preferencias (notificaciones) ────────────────────────────────────────

  private cargarPreferencias(): void {
    this.http
      .get<any>(`${this.apiUrl}/usuario/preferencias`, { headers: this.headers })
      .subscribe({
        next: (prefs) => {
          this.notificaciones = prefs.notificaciones_push ?? true;
          this.cdr.detectChanges();
        },
        error: () => {},
      });
  }

  toggleNotificaciones(): void {
    if (this.notificaciones) {
      this.pushService.inicializar().then(() => {
        this.http
          .put(
            `${this.apiUrl}/usuario/preferencias`,
            { notificaciones_push: true },
            { headers: this.headers }
          )
          .subscribe({ error: () => {} });
      });
    } else {
      this.pushService.desactivar();
      this.http
        .put(
          `${this.apiUrl}/usuario/preferencias`,
          { notificaciones_push: false },
          { headers: this.headers }
        )
        .subscribe({
          error: () => {
            this.notificaciones = true;
            this.cdr.detectChanges();
          },
        });
    }
  }

  // ── Institución ──────────────────────────────────────────────────────────

  private cargarInstitucion(): void {
    this.cargandoInstitucion = true;

    this.http
      .get<any[]>(`${this.apiUrl}/credenciales?t=${Date.now()}`, { headers: this.headers })
      .subscribe({
        next: (creds) => {
          const activa = creds.find((c) => c.estado === 'activa') ?? creds[0];
          if (!activa) {
            this.cargandoInstitucion = false;
            this.cdr.detectChanges();
            return;
          }

          this.http
            .get<any>(`${this.apiUrl}/credenciales/${activa.id}?t=${Date.now()}`, {
              headers: this.headers,
            })
            .subscribe({
              next: (detalle) => {
                this.institucionNombre    = detalle.institucion_nombre ?? '';
                this.radioMetros          = detalle.inst_radio ?? null;
                const lat = detalle.inst_lat ?? null;
                const lng = detalle.inst_lng ?? null;
                this.tieneUbicacion       = !!(lat && lng);
                this.cargandoInstitucion  = false;
                this.cdr.detectChanges();

                if (lat && lng) {
                  this.cargandoGeo = true;
                  this.cdr.detectChanges();
                  this.geocoding.obtenerDireccion(lat, lng).subscribe((dir) => {
                    this.direccionGeo = dir;
                    this.cargandoGeo  = false;
                    this.cdr.detectChanges();
                  });
                }
              },
              error: () => {
                this.cargandoInstitucion = false;
                this.cdr.detectChanges();
              },
            });
        },
        error: () => {
          this.cargandoInstitucion = false;
          this.cdr.detectChanges();
        },
      });
  }

  // ── Idioma ───────────────────────────────────────────────────────────────

  toggleIdioma(): void { this.showIdiomas = !this.showIdiomas; }

  seleccionarIdioma(idioma: string): void {
    this.idiomaActual = idioma;
    this.showIdiomas  = false;
  }

}