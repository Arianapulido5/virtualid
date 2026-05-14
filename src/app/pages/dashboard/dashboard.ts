// src/app/pages/dashboard/dashboard.ts
import { Component, OnInit, OnDestroy, ChangeDetectorRef, NgZone } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Auth } from '../../services/auth';
import { QrService } from '../../services/qr';
import { environment } from '../../../environments/environment';

interface Credencial {
  id: number;
  tipo_usuario: string;
  numero_id: string;
  activa: boolean;
  estado: string;
  creado_en: string;
  institucion_nombre: string;
  institucion_tipo: string;
  ciudad: string;
  estado_inst: string;
  punto_nombre: string;
  punto_tipo: string;
  nivel_acceso: string;
}

// Agrega esta interfaz arriba junto a Credencial
interface Acceso {
  id:                 number;
  exitoso:            boolean;
  creado_en:          string;
  punto_nombre:       string;
  institucion_nombre: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.scss']
})
export class Dashboard implements OnInit, OnDestroy {

  private apiBase = environment.apiUrl;

  nombreUsuario  = '';
  cargandoNombre = true;
  credenciales: Credencial[] = [];
  cargandoCreds  = true;
  ultimosAccesos:   Acceso[] = [];
  cargandoHistorial = true;

  get credencialesActivas(): Credencial[] {
    return this.credenciales.filter(c => c.activa && c.estado === 'activa');
  }

  // QR
  credencialQR: Credencial | null = null;
  qrVisible      = false;
  qrDataUrl      = '';
  qrGenerando    = false;
  countdown      = 45;
  timerPercent   = 100;
  geoError       = '';
  geoSolicitando = false;

  // Carrusel horizontal
  activeCardIndex = 0;
  carouselOffset  = 0;   // px calculado para el track

  // Swipe tracking
  private touchStartX  = 0;
  private touchStartY  = 0;
  private mouseStartX  = 0;
  private isDragging   = false;
  private dragDeltaX   = 0;

  private countdownInterval: any;

  constructor(
    private auth:      Auth,
    private http:      HttpClient,
    private router:    Router,
    private cdr:       ChangeDetectorRef,
    private ngZone:    NgZone,
    private qrService: QrService
  ) {}

  private get headers(): HttpHeaders {
    const token = localStorage.getItem('token') ?? '';
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
  }

  ngOnInit(): void {
    const token = localStorage.getItem('token');
    if (!token) { this.router.navigate(['/login']); return; }

    this.auth.obtenerInformacion().subscribe({
      next: (info) => {
        this.ngZone.run(() => {
          this.nombreUsuario  = `${info.nombre} ${info.apellido_paterno}`;
          this.cargandoNombre = false;
          this.cdr.detectChanges();
        });
      },
      error: (err) => {
        this.ngZone.run(() => {
          this.cargandoNombre = false;
          if (err.status === 401 || err.status === 403) {
            localStorage.removeItem('token');
            this.router.navigate(['/login']);
          } else {
            this.nombreUsuario = 'Usuario';
          }
          this.cdr.detectChanges();
        });
      }
    });

    this.http.get<Credencial[]>(
      `${this.apiBase}/credenciales?t=${Date.now()}`,
      { headers: this.headers }
    ).subscribe({
      next: (data) => {
        this.ngZone.run(() => {
          this.credenciales    = data;
          this.cargandoCreds   = false;
          this.activeCardIndex = 0;
          this.updateCarouselOffset();
          this.cdr.detectChanges();
        });
      },
      error: (err) => {
        this.ngZone.run(() => {
          this.cargandoCreds = false;
          if (err.status === 401 || err.status === 403) {
            localStorage.removeItem('token');
            this.router.navigate(['/login']);
          }
          this.cdr.detectChanges();
        });
      }
    });


    this.http.get<Acceso[]>(
  `${this.apiBase}/historial?t=${Date.now()}`,
  { headers: this.headers }
).subscribe({
  next: (data) => {
    this.ngZone.run(() => {
      this.ultimosAccesos    = data.slice(0, 5);
      this.cargandoHistorial = false;
      this.cdr.detectChanges();
    });
  },
  error: () => {
    this.ngZone.run(() => {
      this.cargandoHistorial = false;
      this.cdr.detectChanges();
    });
  }
});
  }

  

  ngOnDestroy(): void {
    clearInterval(this.countdownInterval);
  }

  // ── Carrusel ──────────────────────────────────────────────────────────────

  /** Ancho de cada tarjeta + gap (en px, debe coincidir con CSS) */
  readonly CARD_WIDTH = 32;
  readonly CARD_GAP   = 16;

  /** Desplazamiento del track para centrar la tarjeta activa */
// dashboard.ts — CORRECCIÓN
updateCarouselOffset(): void {
  const viewport = document.querySelector('.carousel-viewport') as HTMLElement;
  const cardWidth = viewport ? viewport.offsetWidth : 0;
  this.carouselOffset = -(this.activeCardIndex * (cardWidth + this.CARD_GAP));
}

  setActiveCard(index: number): void {
    this.activeCardIndex = index;
    this.updateCarouselOffset();
    this.cdr.detectChanges();
  }

  prevCard(): void {
    if (this.activeCardIndex > 0) {
      this.setActiveCard(this.activeCardIndex - 1);
    }
  }

  nextCard(): void {
    if (this.activeCardIndex < this.credencialesActivas.length - 1) {
      this.setActiveCard(this.activeCardIndex + 1);
    }
  }

  // ── Touch / Mouse drag ────────────────────────────────────────────────────

  onTouchStart(e: TouchEvent): void {
    this.touchStartX = e.touches[0].clientX;
    this.touchStartY = e.touches[0].clientY;
  }

  onTouchEnd(e: TouchEvent): void {
    const deltaX = this.touchStartX - e.changedTouches[0].clientX;
    const deltaY = this.touchStartY - e.changedTouches[0].clientY;
    // Solo procesar si el swipe es más horizontal que vertical
    if (Math.abs(deltaX) < 40 || Math.abs(deltaX) < Math.abs(deltaY)) return;
    if (deltaX > 0) {
      this.nextCard();
    } else {
      this.prevCard();
    }
  }

  onMouseDown(e: MouseEvent): void {
    this.mouseStartX = e.clientX;
    this.isDragging  = true;
    this.dragDeltaX  = 0;
  }

  onMouseMove(e: MouseEvent): void {
    if (!this.isDragging) return;
    this.dragDeltaX = this.mouseStartX - e.clientX;
  }

  onMouseUp(e: MouseEvent): void {
    if (!this.isDragging) return;
    this.isDragging = false;
    const delta = this.mouseStartX - e.clientX;
    if (Math.abs(delta) < 40) return;
    if (delta > 0) {
      this.nextCard();
    } else {
      this.prevCard();
    }
    this.dragDeltaX = 0;
  }

  onMouseLeave(): void {
    if (this.isDragging) {
      this.isDragging = false;
      this.dragDeltaX = 0;
    }
  }

  /** Transform final del track (offset + drag en tiempo real) */
  get trackTransform(): string {
    const base = this.carouselOffset;
    const drag = this.isDragging ? -this.dragDeltaX * 0.35 : 0;
    return `translateX(${base + drag}px)`;
  }

  getCardClass(index: number): string {
    const diff = index - this.activeCardIndex;
    if (diff === 0)  return 'is-active';
    if (diff === -1 || diff === 1) return 'is-adjacent';
    return 'is-far';
  }

  // ── Nav ───────────────────────────────────────────────────────────────────

  verDetalle(id: number): void {
    this.router.navigate(['/credencial', id]);
  }

  irAHistorial(): void {
    this.router.navigate(['/historial']);
  }

  verDetalleAcceso(id: number): void {
  this.router.navigate(['/detalle-acceso', id]);
}

  // ── Geo helpers ───────────────────────────────────────────────────────────

  cancelarGeo(): void {
    this.geoSolicitando = false;
    this.credencialQR   = null;
    this.cdr.detectChanges();
  }

  cerrarGeoError(): void {
    this.geoError = '';
    this.cdr.detectChanges();
  }

  reintentarQR(): void {
    if (this.credencialQR) {
      this.geoError = '';
      this.mostrarQR(this.credencialQR);
    }
  }

  // ── Generar QR ────────────────────────────────────────────────────────────

  mostrarQR(cred: Credencial): void {
    if (this.qrGenerando) return;

    this.credencialQR   = cred;
    this.geoError       = '';
    this.geoSolicitando = true;
    this.cdr.detectChanges();

    if (!navigator.geolocation) {
      this.geoSolicitando = false;
      this.iniciarQR(undefined, undefined);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.ngZone.run(() => {
          this.geoSolicitando = false;
          this.iniciarQR(pos.coords.latitude, pos.coords.longitude);
        });
      },
      (error) => {
        this.ngZone.run(() => {
          this.geoSolicitando = false;
          console.warn('Geolocalización no disponible:', error.message);
          this.iniciarQR(undefined, undefined);
        });
      },
      { timeout: 10000, maximumAge: 30000, enableHighAccuracy: true }
    );
  }

  private iniciarQR(latitud?: number, longitud?: number): void {
    this.qrVisible   = true;
    this.qrDataUrl   = '';
    this.qrGenerando = true;
    this.geoError    = '';
    this.cdr.detectChanges();
    this.generarQR(latitud, longitud);
    this.iniciarCountdown();
  }

  ocultarQR(): void {
    this.qrVisible      = false;
    this.qrDataUrl      = '';
    this.qrGenerando    = false;
    this.geoError       = '';
    this.geoSolicitando = false;
    this.credencialQR   = null;
    clearInterval(this.countdownInterval);
    this.countdown    = 45;
    this.timerPercent = 100;
    this.cdr.detectChanges();
  }

  private generarQR(latitud?: number, longitud?: number): void {
    if (!this.credencialQR) return;

    this.qrService.generarToken(this.credencialQR.id, latitud, longitud).subscribe({
      next: (data) => {
        this.ngZone.run(() => {
          const encoded    = encodeURIComponent(data.token);
          this.qrDataUrl   = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encoded}&bgcolor=ffffff&color=4D0F60&margin=10`;
          this.qrGenerando = false;
          this.cdr.detectChanges();
        });
      },
      error: (err) => {
        this.ngZone.run(() => {
          this.qrGenerando  = false;
          this.qrVisible    = false;
          clearInterval(this.countdownInterval);
          this.countdown    = 45;
          this.timerPercent = 100;
          this.geoError     = err.error?.message ?? 'No se pudo generar el código QR.';
          this.cdr.detectChanges();
        });
      }
    });
  }

  private iniciarCountdown(): void {
    clearInterval(this.countdownInterval);
    this.countdown    = 45;
    this.timerPercent = 100;

    this.countdownInterval = setInterval(() => {
      this.ngZone.run(() => {
        this.countdown--;
        this.timerPercent = (this.countdown / 45) * 100;

        if (this.countdown <= 0) {
          clearInterval(this.countdownInterval);
          this.qrDataUrl = '';
          if (!navigator.geolocation) {
            this.generarQR(undefined, undefined);
            this.iniciarCountdown();
            return;
          }
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              this.ngZone.run(() => {
                this.generarQR(pos.coords.latitude, pos.coords.longitude);
                this.iniciarCountdown();
              });
            },
            () => {
              this.ngZone.run(() => {
                this.generarQR(undefined, undefined);
                this.iniciarCountdown();
              });
            },
            { timeout: 8000, maximumAge: 60000, enableHighAccuracy: false }
          );
        }
        this.cdr.detectChanges();
      });
    }, 1000);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  getIniciales(n: string): string {
    return n.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
  }

  getTipoIcon(tipo: string): string {
    const map: Record<string, string> = {
      edificio: '🏛', biblioteca: '📚', laboratorio: '🔬',
      cafeteria: '☕', deportiva: '⚽', otro: '📍'
    };
    return map[tipo] ?? '📍';
  }

  getNivelColor(nivel: string): string {
    return ({
      abierto: '#2e7d32', restringido: '#e65100', exclusivo: '#A93845'
    } as any)[nivel] ?? '#fff';
  }

  formatFechaCorta(fecha: string): string {
    return new Date(fecha).toLocaleDateString('es-MX', {
      month: '2-digit', year: '2-digit'
    });
  }
}