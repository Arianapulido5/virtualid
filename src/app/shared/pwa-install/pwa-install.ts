import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-pwa-install',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (mostrar) {
      <div class="pwa-banner">
        <div class="pwa-info">
          <span class="pwa-icon">📲</span>
          <div>
            <strong>Instala VirtualID</strong>
            <p>Accede rápido desde tu pantalla de inicio</p>
          </div>
        </div>
        <div class="pwa-actions">
          <button (click)="instalar()" class="btn-instalar">Instalar</button>
          <button (click)="cerrar()" class="btn-cerrar">✕</button>
        </div>
      </div>
    }
  `,
  styles: [`
    .pwa-banner {
      position: fixed; bottom: 0; left: 0; right: 0;
      background: #1a237e; color: white;
      padding: 14px 16px;
      display: flex; justify-content: space-between; align-items: center;
      z-index: 9999; gap: 12px;
      box-shadow: 0 -2px 12px rgba(0,0,0,0.3);
    }
    .pwa-info { display: flex; align-items: center; gap: 12px; }
    .pwa-icon { font-size: 24px; }
    .pwa-info strong { display: block; font-size: 14px; }
    .pwa-info p { margin: 0; font-size: 12px; opacity: 0.8; }
    .pwa-actions { display: flex; gap: 8px; flex-shrink: 0; }
    .btn-instalar {
      background: white; color: #1a237e;
      border: none; padding: 8px 16px;
      border-radius: 6px; cursor: pointer;
      font-weight: 700; font-size: 13px;
    }
    .btn-cerrar {
      background: transparent; color: white;
      border: 1px solid rgba(255,255,255,0.5);
      padding: 8px 10px; border-radius: 6px; cursor: pointer;
    }
  `]
})
export class PwaInstall implements OnInit {
  mostrar = false;
  private deferredPrompt: any;

  ngOnInit() {
    window.addEventListener('beforeinstallprompt', (e: any) => {
      e.preventDefault();
      this.deferredPrompt = e;
      this.mostrar = true;
    });
  }

  async instalar() {
    if (!this.deferredPrompt) return;
    this.deferredPrompt.prompt();
    const { outcome } = await this.deferredPrompt.userChoice;
    this.deferredPrompt = null;
    this.mostrar = false;
  }

  cerrar() {
    this.mostrar = false;
  }
}