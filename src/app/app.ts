import { Component, inject } from '@angular/core';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { SidebarComponent } from './shared/sidebar/sidebar';
import { filter } from 'rxjs/operators';
import { PwaInstall } from './shared/pwa-install/pwa-install';
import { SidebarState } from './services/sidebar-state';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CommonModule, SidebarComponent, PwaInstall],
  templateUrl: './app.html',
  styleUrls: ['./app.scss']
})
export class App {
  private router       = inject(Router);
  private sidebarState = inject(SidebarState);

  showSidebar     = false;
  isAdmin         = false;
  menuOpen        = false;
  isDarkHamburger = false;

  private sinSidebar = [
    '/login', '/registro', '/biometrica',
    '/olvide-contrasena', '/registro-institucion', '/acceso'
  ];

  private fondoClaro = [
    '/tarjetas', '/historial', '/mensajes', '/configuracion', '/credencial',
    '/detalle-acceso', '/informacion-personal', '/cambiar', '/ubicacion',
    '/soporte', '/agregar-credencial'
  ];

  constructor() {
    this.router.events
      .pipe(filter(e => e instanceof NavigationEnd))
      .subscribe((e: any) => {
        const url: string = e.urlAfterRedirects;
        this.isAdmin         = url.startsWith('/admin');
        this.showSidebar     = !this.sinSidebar.some(r => url.startsWith(r));
        this.isDarkHamburger = this.fondoClaro.some(r => url.startsWith(r));
        this.sidebarState.close();
      });

    this.sidebarState.isOpen$.subscribe((v: boolean) => this.menuOpen = v);

    // Registrar service worker para notificaciones push
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw-push.js').catch(err => {
        console.error('Error registrando SW:', err);
      });
    }
  }

  toggleMenu() { this.sidebarState.toggle(); }
}