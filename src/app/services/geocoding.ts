// src/app/services/geocoding.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class GeocodingService {

  constructor(private http: HttpClient) {}

  /**
   * Convierte coordenadas en una dirección legible en español.
   * Usa Nominatim (OpenStreetMap) — gratuito, sin API key.
   * Retorna string vacío si falla.
   */
  obtenerDireccion(lat: number, lng: number): Observable<string> {
    return this.http.get<any>(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=es`
    ).pipe(
      map((res) => {
        if (!res?.address) return res?.display_name ?? '';
        const a = res.address;
        const partes: string[] = [];

        if (a.road) {
          partes.push(a.house_number ? `${a.road} ${a.house_number}` : a.road);
        }
        const colonia = a.suburb ?? a.neighbourhood ?? a.city_district;
        if (colonia) partes.push(colonia);
        const ciudad = a.city ?? a.town ?? a.village;
        if (ciudad) partes.push(ciudad);
        if (a.state) partes.push(a.state);

        return partes.filter(Boolean).join(', ') || res.display_name || '';
      }),
      catchError(() => of(''))
    );
  }
}