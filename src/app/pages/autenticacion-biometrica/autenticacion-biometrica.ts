import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-autenticacion-biometrica',
  standalone: true,
  imports: [],
  templateUrl: './autenticacion-biometrica.html',
  styleUrl: './autenticacion-biometrica.scss'
})
export class AutenticacionBiometrica {
  constructor(private router: Router) {}
  go() { this.router.navigate(['/dashboard']); }
}