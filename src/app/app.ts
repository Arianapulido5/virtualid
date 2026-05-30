import { Component, inject, OnInit, OnDestroy, HostListener } from '@angular/core';
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
export class App implements OnInit, OnDestroy {
  private router       = inject(Router);
  private sidebarState = inject(SidebarState);

  showSidebar      = false;
  isAdmin          = false;
  menuOpen         = false;
  isDarkHamburger  = false;

  // Pull-to-refresh
  isPulling        = false;
  isRefreshing     = false;
  pullIndicatorTop = '20px';

  private touchStartY   = 0;
  private touchStartX   = 0;
  private pullThreshold = 80;   // px que hay que jalar para activar
  private maxPull       = 120;  // máx que baja el indicador

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
  }

  ngOnInit() {
    document.addEventListener('touchstart', this.onTouchStart, { passive: true });
    document.addEventListener('touchmove',  this.onTouchMove,  { passive: false });
    document.addEventListener('touchend',   this.onTouchEnd,   { passive: true });
  }

  ngOnDestroy() {
    document.removeEventListener('touchstart', this.onTouchStart);
    document.removeEventListener('touchmove',  this.onTouchMove);
    document.removeEventListener('touchend',   this.onTouchEnd);
  }

  private onTouchStart = (e: TouchEvent) => {
    this.touchStartY = e.touches[0].clientY;
    this.touchStartX = e.touches[0].clientX;
  };

  private onTouchMove = (e: TouchEvent) => {
    if (this.isRefreshing || this.menuOpen) return;

    const deltaY = e.touches[0].clientY - this.touchStartY;
    const deltaX = e.touches[0].clientX - this.touchStartX;

    // Solo activar si el gesto es más vertical que horizontal
    if (Math.abs(deltaX) > Math.abs(deltaY)) return;

    // Solo si la página está en el tope
    const scrollTop = document.documentElement.scrollTop || document.body.scrollTop;
    if (scrollTop > 0 || deltaY <= 0) return;

    // Prevenir scroll nativo solo cuando estamos jalando
    e.preventDefault();

    const pull = Math.min(deltaY, this.maxPull);
    const progress = pull / this.pullThreshold; // 0 → 1

    this.isPulling = pull > 10;
    // El indicador baja con el dedo, con un poco de resistencia
    const topOffset = Math.round(pull * 0.6) + 60;
    this.pullIndicatorTop = `${topOffset}px`;

    // Rotar el spinner según cuánto se ha jalado
    const spinnerEl = document.querySelector('.pull-spinner') as HTMLElement;
    if (spinnerEl && !this.isRefreshing) {
      spinnerEl.style.transform = `rotate(${Math.round(progress * 360)}deg)`;
    }
  };

  private onTouchEnd = (e: TouchEvent) => {
  if (this.isRefreshing) return;

  const deltaY = e.changedTouches[0].clientY - this.touchStartY;
  const scrollTop = document.documentElement.scrollTop || document.body.scrollTop;

  if (deltaY >= this.pullThreshold && scrollTop === 0) {
    // Activa el spinner girando ANTES de llamar triggerRefresh
    this.isRefreshing = true;
    this.isPulling = true;
    this.pullIndicatorTop = '64px';

    const spinnerEl = document.querySelector('.pull-spinner') as HTMLElement;
    if (spinnerEl) {
      spinnerEl.style.transform = '';
      spinnerEl.classList.add('spinning');
    }

    setTimeout(() => this.triggerRefresh(), 700);
  } else {
    this.resetPull();
  }
};

private triggerRefresh() {
  const splash = document.createElement('div');
  splash.id = 'pull-splash';
  splash.innerHTML = `
    <div class="splash-orb splash-orb--1"></div>
    <div class="splash-orb splash-orb--2"></div>
    <div class="splash-orb splash-orb--3"></div>
    <div class="splash-content">
      <h1 class="splash-title">Virtualid</h1>
      <div class="splash-spinner"></div>
    </div>
  `;
  splash.style.cssText = `
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    width: 100%; height: 100%;
    min-height: 100vh;
    min-height: -webkit-fill-available;
    background: linear-gradient(145deg, #4D0F60 0%, #3a0b48 30%, #32488C 70%, #1e2d5c 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    gap: 16px;
    z-index: 999999;
    margin: 0;
    padding: 0;
    padding-bottom: env(safe-area-inset-bottom, 0px);
    box-sizing: border-box;
  `;
  document.documentElement.style.background = '#4D0F60';
  document.body.style.background = '#4D0F60';
  document.body.appendChild(splash);

  setTimeout(() => {
    window.location.reload();
  }, 600);
}

  private resetPull() {
  this.isPulling = false;
  this.isRefreshing = false;
  this.pullIndicatorTop = '60px';
}

  toggleMenu() { this.sidebarState.toggle(); }
}