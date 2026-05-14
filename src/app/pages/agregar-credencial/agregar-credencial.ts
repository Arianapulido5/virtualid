import { Component, OnInit, ChangeDetectorRef, NgZone } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../../environments/environment';

interface Institucion {
  id: number;
  nombre: string;
  tipo: string;
  ciudad: string;
  estado: string;
  dominio_correo: string;
}

interface PuntoAcceso {
  id: number;
  nombre: string;
  descripcion: string;
  tipo: string;
  nivel_acceso: string;
  permite_estudiantes: boolean;
  permite_empleados: boolean;
}

@Component({
  selector: 'app-agregar-credencial',
  standalone: true,
  imports: [RouterLink, FormsModule, CommonModule],
  templateUrl: './agregar-credencial.html',
  styleUrls: ['./agregar-credencial.scss']
})
export class AgregarCredencial implements OnInit {

  private apiBase = environment.apiUrl;

  institucionId  = '';
  tipoUsuario    = '';
  tipoElegido    = false;
  puntoAccesoId: number | null = null;
  numeroId = '';
  correo   = '';

  instituciones: Institucion[] = [];
  puntos: PuntoAcceso[]        = [];
  todosPuntos: PuntoAcceso[]   = [];

  cargandoInstituciones = true;
  cargandoPuntos        = false;
  enviando              = false;

  errorMsg    = '';
  errNumeroId = '';
  errCorreo   = '';

  mostrarModal          = false;
  mostrarModalDuplicado = false;

  modalVisible = false;
  modalTitulo  = '';
  modalMensaje = '';
  modalTipo: 'exito' | 'error' = 'exito';

  correoRegistrado  = '';
  numeroRegistrado  = '';

  constructor(
    private http: HttpClient,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {}

  private get headers(): HttpHeaders {
    const token = localStorage.getItem('token') ?? '';
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma':        'no-cache',
      'Expires':       '0'
    });
  }

  ngOnInit(): void {
    this.cargarInstitucion();
  }

  cargarInstitucion(): void {
    this.cargandoInstituciones = true;
    this.errorMsg = '';

    this.http
      .get<{ institucion: Institucion; puntos: PuntoAcceso[] }>(
        `${this.apiBase}/usuario/mi-institucion`,
        { headers: this.headers }
      )
      .subscribe({
        next: (data) => {
          this.ngZone.run(() => {
            this.instituciones         = [data.institucion];
            this.todosPuntos           = data.puntos ?? [];
            this.institucionId         = String(data.institucion.id);
            this.cargandoInstituciones = false;
            this.cdr.detectChanges();
          });
        },
        error: (err) => {
          this.ngZone.run(() => {
            this.cargandoInstituciones = false;
            if (err.status === 401 || err.status === 403) {
              this.router.navigate(['/login']);
              return;
            }
            if (err.status === 404) {
              this.instituciones = [];
              this.correoRegistrado = err.error?.correo ?? '';
            } else {
              this.errorMsg = err.error?.message ?? 'Error al verificar la institución.';
            }
            this.cdr.detectChanges();
          });
        }
      });

    this.http
      .get<any>(`${this.apiBase}/informacion`, { headers: this.headers })
      .subscribe({
        next: (p) => {
          this.ngZone.run(() => {
            this.correoRegistrado = p.correo ?? '';
            this.numeroRegistrado = p.numero_empleado ?? '';
            if (!this.numeroId) this.numeroId = this.numeroRegistrado;
            if (!this.correo)   this.correo   = this.correoRegistrado;
            this.cdr.detectChanges();
          });
        },
        error: () => {}
      });
  }

  onTipoChange(valor: string): void {
    this.tipoUsuario   = valor;
    this.tipoElegido   = true;
    this.puntoAccesoId = null;
    this.filtrarPuntos();
  }

  filtrarPuntos(): void {
    if (!this.tipoUsuario) { this.puntos = []; return; }

    this.cargandoPuntos = true;
    this.puntos = [];
    this.cdr.detectChanges();

    setTimeout(() => {
      this.ngZone.run(() => {
        if (this.tipoUsuario === 'estudiante') {
          this.puntos = this.todosPuntos.filter(p => p.permite_estudiantes !== false);
        } else {
          this.puntos = this.todosPuntos.filter(p => p.permite_empleados !== false);
        }
        this.cargandoPuntos = false;
        this.cdr.detectChanges();
      });
    }, 150);
  }

  seleccionarPunto(id: number): void {
  // Si toca el mismo, lo deselecciona para poder ver todos de nuevo
  if (this.puntoAccesoId === id) {
    this.puntoAccesoId = null;
  } else {
    this.puntoAccesoId = id;
  }
  this.cdr.detectChanges();
}

  validarNumeroId(): void {
    this.errNumeroId = '';
    if (!this.numeroId.trim()) {
      this.errNumeroId = 'El número de identificación es obligatorio.';
    } else if (this.numeroRegistrado && this.numeroId.trim() !== this.numeroRegistrado) {
      this.errNumeroId = 'Debe coincidir con tu número de registro.';
    }
  }

  validarCorreo(): void {
    this.errCorreo = '';
    if (!this.correo.trim()) {
      this.errCorreo = 'El correo es obligatorio.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.correo.trim())) {
      this.errCorreo = 'Ingresa un correo válido.';
    } else if (this.correoRegistrado &&
               this.correo.trim().toLowerCase() !== this.correoRegistrado.toLowerCase()) {
      this.errCorreo = 'Debe coincidir con el correo de tu registro.';
    }
  }

  get institucionSeleccionada(): Institucion | null {
    return this.instituciones.find(i => String(i.id) === this.institucionId) ?? null;
  }

  get puntoSeleccionado(): PuntoAcceso | null {
    return this.puntos.find(p => p.id === this.puntoAccesoId) ?? null;
  }

  get formularioValido(): boolean {
    return !!(
      this.institucionId &&
      this.tipoElegido &&
      this.puntoAccesoId &&
      this.numeroId.trim() &&
      this.correo.trim() &&
      !this.errNumeroId &&
      !this.errCorreo
    );
  }

  getTipoIcon(tipo: string): string {
    const map: Record<string, string> = {
      edificio:    '🏛️',
      biblioteca:  '📚',
      laboratorio: '🔬',
      cafeteria:   '☕',
      deportiva:   '⚽',
      otro:        '📍'
    };
    return map[tipo?.toLowerCase()] ?? '📍';
  }

  cerrarModal(): void {
    this.modalVisible = false;
    this.cdr.detectChanges();
  }

  cerrarModalDuplicado(): void {
    this.mostrarModalDuplicado = false;
    this.puntoAccesoId         = null;
    this.cdr.detectChanges();
  }

  irATarjetas(): void {
    this.router.navigate(['/tarjetas']);
  }

  private mostrarResultado(titulo: string, mensaje: string, tipo: 'exito' | 'error' = 'exito'): void {
    this.modalTitulo  = titulo;
    this.modalMensaje = mensaje;
    this.modalTipo    = tipo;
    this.modalVisible = true;
    this.cdr.detectChanges();
  }

  agregar(): void {
    this.validarNumeroId();
    this.validarCorreo();

    if (!this.formularioValido) {
      if (!this.institucionId)      this.errorMsg = 'No se encontró institución asociada.';
      else if (!this.tipoElegido)   this.errorMsg = 'Selecciona el tipo de usuario.';
      else if (!this.puntoAccesoId) this.errorMsg = 'Selecciona un punto de acceso.';
      this.cdr.detectChanges();
      return;
    }

    this.errorMsg = '';
    this.enviando = true;
    this.cdr.detectChanges();

    this.http
      .post(
        `${this.apiBase}/credenciales`,
        {
          punto_acceso_id: this.puntoAccesoId,
          tipo_usuario:    this.tipoUsuario
        },
        { headers: this.headers }
      )
      .subscribe({
        next: () => {
          this.ngZone.run(() => {
            this.enviando     = false;
            this.mostrarModal = true;
            this.cdr.detectChanges();
          });
        },
        error: (err) => {
          this.ngZone.run(() => {
            this.enviando = false;
            if (err.status === 409) {
              this.mostrarModalDuplicado = true;
            } else if (err.status === 403) {
              this.mostrarResultado(
                'Cuenta bloqueada',
                'Tu cuenta está bloqueada. No puedes crear credenciales. Contacta a soporte.',
                'error'
              );
            } else {
              this.mostrarResultado(
                'Error al crear credencial',
                err?.error?.message ?? `Error ${err.status}: No se pudo crear la credencial.`,
                'error'
              );
            }
            this.cdr.detectChanges();
          });
        }
      });
  }
}