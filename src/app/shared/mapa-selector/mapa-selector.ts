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

  @Input() latInicial: number | null = null;
@Input() lngInicial: number | null = null;

  @Output() coordenadasChange = new EventEmitter<{ lat: number; lng: number } | null>();
  @Output() lugarChange = new EventEmitter<{ ciudad: string; estado: string; cp?: string } | null>();

  modo: Modo  = 'ninguno';
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
      this.inputLat = ''; this.inputLng = '';
      if (this.marker) { this.marker.remove(); this.marker = null; }
    }
  }

  abrirMapa(): void {
  const lat = this.latInicial ?? this.lat;
  const lng = this.lngInicial ?? this.lng;
  this.setModo('mapa', lat ?? undefined, lng ?? undefined);
}

  ngOnDestroy(): void { this.destruirMapa(); }

    setModo(m: Modo, lat?: number, lng?: number): void {
  if (m !== 'mapa') { this.destruirMapa(); }
  this.modo = m;
  this.cdr.detectChanges();

  if (m === 'mapa') {
    if (lat != null && lng != null) {
      this.lat = lat;
      this.lng = lng;
      this.iniciarMapbox(lat, lng);
      return;
    }
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => this.ngZone.run(() =>
          this.iniciarMapbox(
            pos.coords.latitude,
            pos.coords.longitude,
            pos.coords.latitude,
            pos.coords.longitude
          )),
        () => this.ngZone.run(() =>
          this.iniciarMapbox(this.DEFAULT_LAT, this.DEFAULT_LNG)),
        { timeout: 4000 }
      );
    } else {
      this.iniciarMapbox(this.DEFAULT_LAT, this.DEFAULT_LNG);
    }
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

        if (this._pendingCenter) {
          const pc = this._pendingCenter;
          this.map.setCenter([pc.lng, pc.lat]);
          this.ponerMarcador(pc.lng, pc.lat, true);
          this._pendingCenter = null;
        }

        if (this.lat !== null && this.lng !== null) {
          this.ponerMarcador(this.lng!, this.lat!, true);
        }

        if (centerLat && centerLng) {
          new mapboxgl.Marker({ color: '#4285F4', scale: 0.7 })
            .setLngLat([centerLng, centerLat])
            .setPopup(new mapboxgl.Popup().setText('Tu ubicación actual'))
            .addTo(this.map);

          this.ngZone.run(() => {
            const lat = parseFloat(centerLat.toFixed(7));
            const lng = parseFloat(centerLng.toFixed(7));
            if (this.lat === null || this.lng === null) {
              this.lat = lat;
              this.lng = lng;
              this.ponerMarcador(lng, lat, false);
              this.coordenadasChange.emit({ lat, lng });
            }
            this.cdr.detectChanges();
          });
        }
      });

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

    this.lat = lat; this.lng = lng;
    this.coordenadasChange.emit({ lat, lng });
    if (!skipGeocode) this.reverseGeocode(lng, lat);
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

          let cp      = '';
          let ciudad  = '';
          let estado  = '';

          for (const f of features) {
            if (f.place_type?.includes('postcode') && !cp) {
              cp = (f.text ?? '').replace(/\D/g, '').slice(0, 5);
            }
            if ((f.place_type?.includes('locality') || f.place_type?.includes('place')) && !ciudad) {
              ciudad = f.text ?? '';
            }
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

          console.log('Mapbox CP:', cp, 'ciudad:', ciudad, 'estado:', estado);

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

  private _buscarCPporColonia(colonia: string, municipio: string, estado: string): Promise<string> {
    const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    const colNorm    = norm(colonia);
    const estadoNorm = norm(estado);
    const munNorm    = norm(municipio);

    const estadoIdMap: Record<string, string> = {
      'aguascalientes':'01','baja california':'02','baja california sur':'03',
      'campeche':'04','coahuila':'05','colima':'06','chiapas':'07','chihuahua':'08',
      'ciudad de mexico':'09','durango':'10','guanajuato':'11','guerrero':'12',
      'hidalgo':'13','jalisco':'14','estado de mexico':'15','michoacan':'16',
      'morelos':'17','nayarit':'18','nuevo leon':'19','oaxaca':'20','puebla':'21',
      'queretaro':'22','quintana roo':'23','san luis potosi':'24','sinaloa':'25',
      'sonora':'26','tabasco':'27','tamaulipas':'28','tlaxcala':'29',
      'veracruz':'30','yucatan':'31','zacatecas':'32'
    };

    const estadoId = estadoIdMap[estadoNorm] ?? '';
    if (!estadoId) return Promise.resolve('');

    return fetch(
      `https://sepomex.nitrostudio.com.mx/api/20241009/estado/${estadoId}.json`,
      { headers: { Accept: 'application/json' } }
    )
      .then(r => r.json())
      .then(json => {
        const postcodes: any[] = json?.data?.postcodes ?? [];
        if (!postcodes.length) return '';

        const exacto = postcodes.find(p => {
          const pCol = norm(p.d_asenta ?? '');
          const pMun = norm(p.d_mnpio  ?? '');
          return pCol === colNorm && (!munNorm || pMun.includes(munNorm) || munNorm.includes(pMun));
        });
        if (exacto?.d_codigo) return String(exacto.d_codigo).padStart(5, '0');

        const parcial = postcodes.find(p => {
          const pCol = norm(p.d_asenta ?? '');
          const pMun = norm(p.d_mnpio  ?? '');
          return (pCol.includes(colNorm) || colNorm.includes(pCol)) &&
                 (!munNorm || pMun.includes(munNorm) || munNorm.includes(pMun));
        });
        if (parcial?.d_codigo) return String(parcial.d_codigo).padStart(5, '0');

        return '';
      })
      .catch(() => '');
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