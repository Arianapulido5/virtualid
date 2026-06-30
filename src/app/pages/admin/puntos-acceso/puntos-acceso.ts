import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';
import { SidebarAdminComponent } from '../../../shared/sidebar-admin/sidebar-admin';
import { PuntosAccesoService, PuntoAcceso } from '../../../services/puntos-acceso';

const TIPO_META: Record<string, { icon: string; colorClass: string }> = {
  edificio:    { icon: '🏛',  colorClass: 'card-blue'  },
  biblioteca:  { icon: '📚', colorClass: 'card-blue2' },
  laboratorio: { icon: '🔬', colorClass: 'card-red'   },
  cafeteria:   { icon: '☕', colorClass: 'card-blue'  },
  deportiva:   { icon: '⚽', colorClass: 'card-blue2' },
  otro:        { icon: '📍', colorClass: 'card-red'   },
};

const ESTADO_META: Record<string, { texto: string; clase: string }> = {
  abierto:          { texto: 'Abierto',         clase: 'activo'      },
  fuera_de_horario: { texto: 'Cerrado',          clase: 'inactivo'    },
  cerrado_comida:   { texto: 'Cerrado (comida)', clase: 'restringido' },
  desactivado:      { texto: 'Desactivado',      clase: 'inactivo'    },
};

interface PuntoUI extends PuntoAcceso {
  icon:        string;
  colorClass:  string;
  estadoTexto: string;
  estadoClase: string;
}

@Component({
  selector: 'app-puntos-acceso',
  standalone: true,
  imports: [CommonModule, RouterLink, HttpClientModule, SidebarAdminComponent],
  templateUrl: './puntos-acceso.html',
  styleUrls: ['./puntos-acceso.scss']
})
export class PuntosAcceso implements OnInit {

  puntos: PuntoUI[] = [];
  cargando = true;
  error    = '';

  constructor(
    private service: PuntosAccesoService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.service.getAll().subscribe({
      next: (data) => {
        this.puntos   = data.map(p => this.toUI(p));
        this.cargando = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.error    = err?.error?.message ?? 'Error al cargar los puntos de acceso.';
        this.cargando = false;
        this.cdr.detectChanges();
      }
    });
  }

  private toUI(p: PuntoAcceso): PuntoUI {
    const meta   = TIPO_META[p.tipo] ?? { icon: '📍', colorClass: 'card-blue' };
    const estado = ESTADO_META[p.estado_actual ?? 'desactivado']
                ?? { texto: p.estado_actual, clase: 'inactivo' };
    return {
      ...p,
      ...meta,
      estadoTexto: estado.texto,
      estadoClase: estado.clase,
    };
  }
}