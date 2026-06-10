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

  modo: Modo = 'ninguno';
  cargandoGeo = false;
  mapaListo   = false;
  inputLat    = '';
  inputLng    = '';

  private map:    any = null;
  private marker: any = null;
  private _pendingCenter: { lat: number; lng: number } | null = null;

  private readonly DEFAULT_LAT = 18.8868;
  private readonly DEFAULT_LNG = -97.0917;

  constructor(private cdr: ChangeDetectorRef, private ngZone: NgZone) {}

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes['lat'] || changes['lng']) && this.lat === null && this.lng === null) {
      this.inputLat = '';
      this.inputLng = '';
      if (this.marker) { this.marker.remove(); this.marker = null; }
    }
  }

  ngOnDestroy(): void { this.destruirMapa(); }

  // Llamado desde el tab "Seleccionar en mapa"
  abrirMapa(): void {
    this.setModo('mapa');
  }

  setModo(m: Modo): void {
  if (m !== 'mapa') { this.destruirMapa(); }
  this.modo = m;

  // Si cambia a manual y ya hay coords, pre-llenar los campos
  if (m === 'manual' && this.lat != null && this.lng != null) {
this.inputLat = this.lat.toFixed(6);
this.inputLng = this.lng.toFixed(6);
  }

  this.cdr.detectChanges();

  if (m !== 'mapa') return;

  if (this.lat != null && this.lng != null) {
    this.iniciarMapbox(this.lat, this.lng, null, null);
    return;
  }

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => this.ngZone.run(() =>
        this.iniciarMapbox(this.DEFAULT_LAT, this.DEFAULT_LNG, pos.coords.latitude, pos.coords.longitude)
      ),
      () => this.ngZone.run(() =>
        this.iniciarMapbox(this.DEFAULT_LAT, this.DEFAULT_LNG, null, null)
      ),
      { timeout: 4000 }
    );
  } else {
    this.iniciarMapbox(this.DEFAULT_LAT, this.DEFAULT_LNG, null, null);
  }
}

  moverA(lat: number, lng: number): void {
    this.lat = lat;
    this.lng = lng;
    if (this.map && this.mapaListo) {
      this.map.flyTo({ center: [lng, lat], zoom: 15 });
      this.ponerMarcador(lng, lat, true);
    } else {
      this._pendingCenter = { lat, lng };
    }
  }

  // markerLat/markerLng: donde poner marcador si ya hay coords
  // geoLat/geoLng: donde centrar la vista por geolocalización (null = no geoloc)
  private iniciarMapbox(
    markerLat: number, markerLng: number,
    geoLat: number | null, geoLng: number | null
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

      // Centro del mapa: geoloc si hay, si no el marcador/default
      const centerLng = geoLng ?? markerLng;
      const centerLat = geoLat ?? markerLat;

      this.map = new mapboxgl.Map({
        container: divId,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [centerLng, centerLat],
        zoom: 15
      });

      this.map.addControl(new mapboxgl.NavigationControl(), 'top-right');

      this.map.on('load', () => {
        this.ngZone.run(() => {
          this.mapaListo = true;
          this.cdr.detectChanges();
          setTimeout(() => this.map?.resize(), 50);
        });

        // Pendiente de moverA() llamado antes de que cargara
        if (this._pendingCenter) {
          const pc = this._pendingCenter;
          this._pendingCenter = null;
          this.map.setCenter([pc.lng, pc.lat]);
          this.ponerMarcador(pc.lng, pc.lat, true);
          return;
        }

        // Si hay coords ya definidas, poner marcador ahí (sin geocodificar ni emitir)
        if (this.lat != null && this.lng != null) {
          this.ponerMarcador(this.lng, this.lat, true);
          return;
        }

        // Sin coords: poner marquito azul de "tu ubicación" solo como referencia visual,
        // SIN emitir coordenadas ni hacer reverse geocode.
        if (geoLat != null && geoLng != null) {
  new mapboxgl.Marker({ color: '#4285F4', scale: 0.7 })
    .setLngLat([geoLng, geoLat])
    .setPopup(new mapboxgl.Popup().setText('Tu ubicación actual'))
    .addTo(this.map);

  // Emitir coords y geocodificar para llenar los campos del padre
  this.lat = parseFloat(geoLat.toFixed(7));
  this.lng = parseFloat(geoLng.toFixed(7));
  this.coordenadasChange.emit({ lat: this.lat, lng: this.lng });
  this.reverseGeocode(this.lng, this.lat);
  this.cdr.detectChanges();
}
      });

      // Clic en el mapa → poner/mover marcador morado y emitir
      this.map.on('click', (e: any) => {
        this.ngZone.run(() => {
          const lat = parseFloat(e.lngLat.lat.toFixed(7));
          const lng = parseFloat(e.lngLat.lng.toFixed(7));
          this.ponerMarcador(lng, lat, false);
        });
      });

      this.map.on('mousemove', () => {
        this.map.getCanvas().style.cursor = 'crosshair';
      });
    };

    setTimeout(() => tryInit(15), 50);
  }

  private ponerMarcador(lng: number, lat: number, skipGeocode = false): void {
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

    this.lat = lat;
    this.lng = lng;

    if (!skipGeocode) {
      this.coordenadasChange.emit({ lat, lng });
      this.reverseGeocode(lng, lat);
    }

    this.cdr.detectChanges();
  }

  private reverseGeocode(lng: number, lat: number): void {
    fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json` +
      `?access_token=${MAPBOX_TOKEN}&country=MX&types=postcode,locality,place&language=es`
    )
      .then(r => r.json())
      .then(data => {
        this.ngZone.run(() => {
          const features = data?.features ?? [];
          let cp = '', ciudad = '', estado = '';

          for (const f of features) {
            if (f.place_type?.includes('postcode') && !cp)
              cp = (f.text ?? '').replace(/\D/g, '').slice(0, 5);
            if ((f.place_type?.includes('locality') || f.place_type?.includes('place')) && !ciudad)
              ciudad = f.text ?? '';
            if (!estado) {
              const region = f.context?.find((c: any) => c.id?.startsWith('region'));
              if (region) estado = this.normalizarEstado(region.text ?? '');
            }
          }
          

          if (!estado) {
            for (const f of features) {
              const region = f.context?.find((c: any) => c.id?.startsWith('region'));
              if (region) { estado = this.normalizarEstado(region.text ?? ''); break; }
            }
          }

          this.lugarChange.emit({ ciudad, estado, cp: cp.length === 5 ? cp : undefined });
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
    const n = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    const t = n(texto);
    if (this.ALIASES[t]) return this.ALIASES[t];
    const exacto = this.ESTADOS.find(e => n(e) === t);
    if (exacto) return exacto;
    return this.ESTADOS.find(e => { const en = n(e); return t.includes(en) || en.includes(t); }) ?? texto;
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