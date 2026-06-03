import { Component, OnInit, inject } from '@angular/core';
import { RouterModule, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { BreakpointObserver } from '@angular/cdk/layout';
import { HttpClient, HttpHeaders, HttpClientModule } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { SidebarState } from '../../services/sidebar-state';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterModule, CommonModule, HttpClientModule],
  templateUrl: './sidebar.html',
  styleUrls: ['./sidebar.scss']
})
export class SidebarComponent implements OnInit {
  noLeidos = 0;
  sidebarState = inject(SidebarState);

  private breakpoint = inject(BreakpointObserver);
  private router     = inject(Router);
  private http       = inject(HttpClient);

  menuItems = [
    { label: 'Inicio',           route: '/dashboard' },
    { label: 'Mis Credenciales', route: '/tarjetas' },
    { label: 'Historial',        route: '/historial' },
    { label: 'Notificaciones',   route: '/mensajes' },
    { label: 'Configuración',    route: '/configuracion' },
  ];

  constructor() {
    this.breakpoint.observe('(min-width: 769px)').subscribe(result => {
      if (result.matches) this.sidebarState.close();
    });
  }

  ngOnInit() { this.contarNoLeidos(); }

  contarNoLeidos() {
    const token = localStorage.getItem('token');
    if (!token) return;
    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
    this.http.get<any[]>(`${environment.apiUrl}/mensajes/mis-mensajes`, { headers }).subscribe({
      next: (msgs) => { this.noLeidos = msgs.filter(m => !m.leido).length; },
      error: () => {}
    });
  }

  closeOnMobile() {
    if (window.innerWidth <= 768) this.sidebarState.close();
  }

cerrarSesion() {
  localStorage.removeItem('token');
  localStorage.removeItem('rol');
  this.router.navigate(['/login'], { replaceUrl: true });
}
}