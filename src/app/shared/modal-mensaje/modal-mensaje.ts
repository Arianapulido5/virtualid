// src/app/shared/modal-mensaje/modal-mensaje.ts
import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface UsuarioMensaje { nombre: string; correo: string; tipo: string; }

@Component({
  selector: 'app-modal-mensaje',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './modal-mensaje.html',
  styleUrls: ['./modal-mensaje.scss']
})
export class ModalMensajeComponent {
  @Input() usuario: UsuarioMensaje = { nombre: '', correo: '', tipo: '' };
  @Output() cerrado = new EventEmitter<void>();
  @Output() enviado = new EventEmitter<any>();

  tipoSeleccionado = 'notificacion';
  asunto  = '';
  mensaje = '';

  seleccionarTipo(tipo: string) { this.tipoSeleccionado = tipo; }

  contarCaracteres() {
    if (this.mensaje.length > 500) this.mensaje = this.mensaje.substring(0, 500);
  }

  enviar() {
    if (!this.asunto.trim() || !this.mensaje.trim()) return;
    this.enviado.emit({ tipo: this.tipoSeleccionado, asunto: this.asunto, mensaje: this.mensaje });
    this.cerrar();
  }

  cerrar() { this.cerrado.emit(); }
}