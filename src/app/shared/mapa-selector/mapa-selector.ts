// src/app/shared/mapa-selector/mapa-selector.ts
import {
  Component, Input, Output, EventEmitter,
  OnDestroy, OnChanges, SimpleChanges,
  ChangeDetectorRef, NgZone
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

// ⚠️ REEMPLAZA ESTO con tu token de Mapbox (gratis en mapbox.com)
const MAPBOX_TOKEN = 'pk.eyJ1IjoiYXJpYW5hcHVsaWRvLTciLCJhIjoiY21td2YxdXM4MnB4cjJxcHk4aWsyc2ljcSJ9.rE19cHh6UFvEncYVjSULrg';

declare const mapboxgl: any;
type Modo = 'ninguno' | 'mapa' | 'actual' | 'manual';

@Component({
  selector: 'app-mapa-selector',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './mapa-selector.html',
  styleUrls: ['./mapa-selector.scss']
})
export class MapaSelectorComponent implements OnDestroy, OnChanges {

  @Input() lat: number | null = null;
  @Input() lng: number | null = null;
  @Input() mapId: string = 'mapa';

  @Output() coordenadasChange = new EventEmitter<{ lat: number; lng: number } | null>();
  @Output() lugarChange = new EventEmitter<{ ciudad: string; estado: string } | null>();

  modo: Modo  = 'ninguno';
  cargandoGeo = false;
  mapaListo   = false;
  inputLat    = '';
  inputLng    = '';

  private map:    any = null;
  private marker: any = null;

  private readonly DEFAULT_LAT = 18.8868;
  private readonly DEFAULT_LNG = -97.0917;

  constructor(private cdr: ChangeDetectorRef, private ngZone: NgZone) {}

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes['lat'] || changes['lng']) && this.lat === null && this.lng === null) {
      this.inputLat = ''; this.inputLng = '';
      if (this.marker) { this.marker.remove(); this.marker = null; }
    }
  }

  ngOnDestroy(): void { this.destruirMapa(); }

  setModo(m: Modo): void {
    if (m !== 'mapa') { this.destruirMapa(); }
    this.modo = m;
    this.cdr.detectChanges();

    if (m === 'mapa') {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => this.ngZone.run(() =>
            this.iniciarMapbox(this.lat ?? pos.coords.latitude, this.lng ?? pos.coords.longitude,
                               pos.coords.latitude, pos.coords.longitude)),
          () => this.ngZone.run(() =>
            this.iniciarMapbox(this.lat ?? this.DEFAULT_LAT, this.lng ?? this.DEFAULT_LNG)),
          { timeout: 4000 }
        );
      } else {
        this.iniciarMapbox(this.lat ?? this.DEFAULT_LAT, this.lng ?? this.DEFAULT_LNG);
      }
    }
  }

  private iniciarMapbox(
    markerLat: number, markerLng: number,
    centerLat?: number, centerLng?: number
  ): void {
    const divId = `mapbox-${this.mapId}`;

    const tryInit = (tries: number) => {
      const el = document.getElementById(divId);
      if (!el) {
        if (tries > 0) setTimeout(() => tryInit(tries - 1), 100);
        return;
      }

      if (this.map) { this.map.remove(); this.map = null; this.marker = null; }

      mapboxgl.accessToken = MAPBOX_TOKEN;

      this.map = new mapboxgl.Map({
        container: divId,
        style: 'mapbox://styles/mapbox/streets-v12',   // estilo Streets (similar a Google Maps)
        center: [centerLng ?? markerLng, centerLat ?? markerLat],
        zoom: 15
      });

      // Controles de zoom y orientación
      this.map.addControl(new mapboxgl.NavigationControl(), 'top-right');

      this.map.on('load', () => {
        this.ngZone.run(() => {
          this.mapaListo = true;
          this.cdr.detectChanges();
          // Forzar recálculo de tamaño después de que Angular quite la clase mapa-cargando-div
          setTimeout(() => this.map?.resize(), 50);
        });

        // Si hay coords previas, colocar marcador
        if (this.lat !== null && this.lng !== null) {
          this.ponerMarcador(this.lng!, this.lat!);
        }

        // Punto azul de posición actual (si es diferente al marcador)
        if (centerLat && centerLng) {
          new mapboxgl.Marker({ color: '#4285F4', scale: 0.7 })
            .setLngLat([centerLng, centerLat])
            .setPopup(new mapboxgl.Popup().setText('Tu ubicación actual'))
            .addTo(this.map);
        }
      });

      // Clic para seleccionar
      this.map.on('click', (e: any) => {
        this.ngZone.run(() => {
          const lat = parseFloat(e.lngLat.lat.toFixed(7));
          const lng = parseFloat(e.lngLat.lng.toFixed(7));
          this.ponerMarcador(lng, lat);
        });
      });

      // Cursor crosshair al pasar
      this.map.on('mousemove', () => {
        this.map.getCanvas().style.cursor = 'crosshair';
      });
    };

    setTimeout(() => tryInit(15), 50);
  }

  private ponerMarcador(lng: number, lat: number): void {
    if (!this.map) return;

    if (this.marker) {
      this.marker.setLngLat([lng, lat]);
    } else {
      this.marker = new mapboxgl.Marker({
        color: '#4D0F60',
        draggable: true
      })
        .setLngLat([lng, lat])
        .setPopup(new mapboxgl.Popup().setHTML('<b>📍 Institución</b><br><small>Arrastra para ajustar</small>'))
        .addTo(this.map);

      this.marker.on('dragend', () => {
        this.ngZone.run(() => {
          const pos = this.marker.getLngLat();
          this.lat = parseFloat(pos.lat.toFixed(7));
          this.lng = parseFloat(pos.lng.toFixed(7));
          this.coordenadasChange.emit({ lat: this.lat, lng: this.lng });
          this.reverseGeocode(this.lng, this.lat);
          this.cdr.detectChanges();
        });
      });
    }

    this.lat = lat; this.lng = lng;
    this.coordenadasChange.emit({ lat, lng });
    this.reverseGeocode(lng, lat);
    this.cdr.detectChanges();
  }

  private reverseGeocode(lng: number, lat: number): void {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?types=place,region&language=es&access_token=${MAPBOX_TOKEN}`;
    fetch(url)
      .then(r => r.json())
      .then(data => {
        this.ngZone.run(() => {
          const features = data.features ?? [];
          let ciudad = '';
          let estado  = '';

          for (const f of features) {
            const tipos = f.place_type ?? [];
            if (tipos.includes('place')  && !ciudad) ciudad = f.text ?? '';
            if (tipos.includes('region') && !estado) {
              // Mapbox devuelve el estado en español si se pide language=es
              const texto = f.text ?? '';
              // Normalizar al nombre exacto del array estadosMexico
              estado = this.normalizarEstado(texto);
            }
          }

          if (ciudad || estado) {
            this.lugarChange.emit({ ciudad, estado });
          }
          this.cdr.detectChanges();
        });
      })
      .catch(() => {}); // silencioso si falla
  }

  private readonly ESTADOS = [
    'Aguascalientes','Baja California','Baja California Sur','Campeche',
    'Chiapas','Chihuahua','Ciudad de México','Coahuila','Colima','Durango',
    'Estado de México','Guanajuato','Guerrero','Hidalgo','Jalisco',
    'Michoacán','Morelos','Nayarit','Nuevo León','Oaxaca','Puebla',
    'Querétaro','Quintana Roo','San Luis Potosí','Sinaloa','Sonora',
    'Tabasco','Tamaulipas','Tlaxcala','Veracruz','Yucatán','Zacatecas'
  ];

  // Aliases para nombres que Mapbox devuelve diferente
  private readonly ALIASES: Record<string, string> = {
    'veracruz de ignacio de la llave': 'Veracruz',
    'michoacan de ocampo':             'Michoacán',
    'michoacán de ocampo':             'Michoacán',
    'coahuila de zaragoza':            'Coahuila',
    'guerrero':                        'Guerrero',
    'mexico':                          'Estado de México',
    'méxico':                          'Estado de México',
    'estado de mexico':                'Estado de México',
    'ciudad de mexico':                'Ciudad de México',
    'distrito federal':                'Ciudad de México',
    'queretaro':                       'Querétaro',
    'nuevo leon':                      'Nuevo León',
    'yucatan':                         'Yucatán',
    'san luis potosi':                 'San Luis Potosí',
    'quintana roo':                    'Quintana Roo',
  };

  private normalizarEstado(texto: string): string {
    if (!texto) return '';
    const normaliza = (s: string) => s.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    const textoNorm = normaliza(texto);

    // 1. Buscar en aliases primero
    if (this.ALIASES[textoNorm]) return this.ALIASES[textoNorm];

    // 2. Coincidencia exacta normalizada
    const exacto = this.ESTADOS.find(e => normaliza(e) === textoNorm);
    if (exacto) return exacto;

    // 3. Coincidencia parcial — si el texto contiene el nombre del estado o viceversa
    const parcial = this.ESTADOS.find(e => {
      const eNorm = normaliza(e);
      return textoNorm.includes(eNorm) || eNorm.includes(textoNorm);
    });
    if (parcial) return parcial;

    return texto;
  }

  private destruirMapa(): void {
    if (this.marker) { this.marker.remove(); this.marker = null; }
    if (this.map)    { this.map.remove();    this.map    = null; }
    this.mapaListo = false;
  }

  onManualChange(): void {
    const lat = parseFloat(this.inputLat);
    const lng = parseFloat(this.inputLng);
    if (this.inputLat !== '' && this.inputLng !== '' && !isNaN(lat) && !isNaN(lng)) {
      this.lat = parseFloat(lat.toFixed(7));
      this.lng = parseFloat(lng.toFixed(7));
      this.coordenadasChange.emit({ lat: this.lat, lng: this.lng });
    } else {
      this.lat = null; this.lng = null;
      this.coordenadasChange.emit(null);
    }
    this.cdr.detectChanges();
  }

  usarUbicacionActual(): void {
    this.modo = 'actual';
    this.cargandoGeo = true;
    this.destruirMapa();
    this.cdr.detectChanges();

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.ngZone.run(() => {
          this.lat = parseFloat(pos.coords.latitude.toFixed(7));
          this.lng = parseFloat(pos.coords.longitude.toFixed(7));
          this.cargandoGeo = false;
          this.coordenadasChange.emit({ lat: this.lat!, lng: this.lng! });
          this.cdr.detectChanges();
        });
      },
      () => {
        this.ngZone.run(() => {
          alert('No se pudo obtener tu ubicación.');
          this.modo = 'ninguno'; this.cargandoGeo = false;
          this.cdr.detectChanges();
        });
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  }

  limpiar(): void {
    if (this.marker) { this.marker.remove(); this.marker = null; }
    this.lat = null; this.lng = null;
    this.inputLat = ''; this.inputLng = '';
    this.coordenadasChange.emit(null);
    this.cdr.detectChanges();
  }
}