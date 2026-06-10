import {
  Component, Input, Output, EventEmitter,
  OnDestroy, OnChanges, SimpleChanges,
  ChangeDetectorRef, NgZone
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

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
  @Output() lugarChange = new EventEmitter<{ ciudad: string; estado: string; cp?: string } | null>();

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
            this.iniciarMapbox(
              this.lat ?? pos.coords.latitude,
              this.lng ?? pos.coords.longitude,
              pos.coords.latitude,
              pos.coords.longitude
            )),
          () => this.ngZone.run(() =>
            this.iniciarMapbox(this.lat ?? this.DEFAULT_LAT, this.lng ?? this.DEFAULT_LNG)),
          { timeout: 4000 }
        );
      } else {
        this.iniciarMapbox(this.lat ?? this.DEFAULT_LAT, this.lng ?? this.DEFAULT_LNG);
      }
    }
  }

  // Método público para que el padre mueva el mapa desde CP
  moverA(lat: number, lng: number): void {
    if (this.map && this.mapaListo) {
      this.map.flyTo({ center: [lng, lat], zoom: 15 });
      this.ponerMarcador(lng, lat);
    } else {
      this.lat = lat;
      this.lng = lng;
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
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [centerLng ?? markerLng, centerLat ?? markerLat],
        zoom: 15
      });

      this.map.addControl(new mapboxgl.NavigationControl(), 'top-right');

      this.map.on('load', () => {
        this.ngZone.run(() => {
          this.mapaListo = true;
          this.cdr.detectChanges();
          setTimeout(() => this.map?.resize(), 50);
        });

        // Si hay coords previas del padre, poner marcador
        if (this.lat !== null && this.lng !== null) {
          this.ponerMarcador(this.lng!, this.lat!);
        }

        // Punto azul de ubicación actual
        if (centerLat && centerLng) {
          new mapboxgl.Marker({ color: '#4285F4', scale: 0.7 })
            .setLngLat([centerLng, centerLat])
            .setPopup(new mapboxgl.Popup().setText('Tu ubicación actual'))
            .addTo(this.map);

          // Si no había marcador previo, emitir la ubicación actual y llenar campos
          if (this.lat === null || this.lng === null) {
            this.ngZone.run(() => {
              const lat = parseFloat(centerLat.toFixed(7));
              const lng = parseFloat(centerLng.toFixed(7));
              this.lat = lat;
              this.lng = lng;
              this.ponerMarcador(lng, lat);
              this.coordenadasChange.emit({ lat, lng });
              this.reverseGeocode(lng, lat);
              this.cdr.detectChanges();
            });
          }
        }
      });

      this.map.on('click', (e: any) => {
        this.ngZone.run(() => {
          const lat = parseFloat(e.lngLat.lat.toFixed(7));
          const lng = parseFloat(e.lngLat.lng.toFixed(7));
          this.ponerMarcador(lng, lat);
        });
      });

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
      this.marker = new mapboxgl.Marker({ color: '#4D0F60', draggable: true })
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

  // Cambiado: usa Nominatim con zoom=18 para CP exacto, y emite cp
  private reverseGeocode(lng: number, lat: number): void {
    fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=es&zoom=18&addressdetails=1`)
      .then(r => r.json())
      .then(data => {
        this.ngZone.run(() => {
          const a = data?.address;
          if (!a) return;

          const cp        = (a.postcode ?? '').replace(/\D/g, '').slice(0, 5);
          const ciudad    = a.city ?? a.town ?? a.village ?? a.municipality ?? a.county ?? '';
          const estadoRaw = a.state ?? '';
          const estado    = this.normalizarEstado(estadoRaw);

          this.lugarChange.emit({
            ciudad,
            estado,
            cp: cp.length === 5 ? cp : undefined
          });
          this.cdr.detectChanges();
        });
      })
      .catch(() => {});
  }

  private readonly ESTADOS = [
    'Aguascalientes','Baja California','Baja California Sur','Campeche',
    'Chiapas','Chihuahua','Ciudad de México','Coahuila','Colima','Durango',
    'Estado de México','Guanajuato','Guerrero','Hidalgo','Jalisco',
    'Michoacán','Morelos','Nayarit','Nuevo León','Oaxaca','Puebla',
    'Querétaro','Quintana Roo','San Luis Potosí','Sinaloa','Sonora',
    'Tabasco','Tamaulipas','Tlaxcala','Veracruz','Yucatán','Zacatecas'
  ];

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
    const normaliza = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    const textoNorm = normaliza(texto);
    if (this.ALIASES[textoNorm]) return this.ALIASES[textoNorm];
    const exacto = this.ESTADOS.find(e => normaliza(e) === textoNorm);
    if (exacto) return exacto;
    const parcial = this.ESTADOS.find(e => {
      const eNorm = normaliza(e);
      return textoNorm.includes(eNorm) || eNorm.includes(textoNorm);
    });
    return parcial ?? texto;
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
      this.reverseGeocode(this.lng, this.lat);
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
          this.reverseGeocode(this.lng!, this.lat!);
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