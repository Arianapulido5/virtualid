import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-pull-to-refresh',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="ptr-spinner-only" [class.visible]="spinnerVisible">
      <div class="ptr-circle"></div>
    </div>

    <div class="ptr-overlay" [class.visible]="overlayVisible">
      <div class="ptr-orb ptr-orb--1"></div>
      <div class="ptr-orb ptr-orb--2"></div>
      <div class="ptr-orb ptr-orb--3"></div>
      <div class="ptr-spinner-wrap">
        <div class="ptr-circle-white"></div>
        <span class="ptr-label">Actualizando...</span>
      </div>
    </div>
  `,
  styles: [`
    .ptr-spinner-only {
      position: fixed;
      top: calc(env(safe-area-inset-top, 0px) + 100px);
      left: 50%;
      transform: translateX(-50%);
      z-index: 99997;
      opacity: 0;
      visibility: hidden;
      transition: opacity 0.2s ease, visibility 0.2s ease;
    }

    .ptr-spinner-only.visible {
      opacity: 1;
      visibility: visible;
    }

    .ptr-circle {
      width: 25px; height: 25px;
     border: 4px solid rgba(120, 120, 130, 0.2);
    border-top-color: #909099;
    border-right-color: #a0a0aa;
      border-radius: 50%;
      animation: ptrSpin 0.8s linear infinite;
    }

    .ptr-overlay {
      position: fixed;
      inset: 0;
      width: 100%;
      min-height: 100dvh;
      background: linear-gradient(145deg, #4D0F60 0%, #3a0b48 30%, #32488C 70%, #1e2d5c 100%);
      background-size: 300% 300%;
      display: flex;
      align-items: flex-end;
      justify-content: center;
      padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 60px);
      z-index: 99998;
      opacity: 0;
      visibility: hidden;
      transition: opacity 0.3s ease, visibility 0.3s ease;
      animation: ptrGradient 6s ease infinite;
    }

    .ptr-overlay.visible {
      opacity: 1;
      visibility: visible;
    }

    .ptr-orb {
      position: absolute;
      border-radius: 50%;
      pointer-events: none;
    }
    .ptr-orb--1 {
      width: 500px; height: 500px;
      background: radial-gradient(circle, rgba(107,32,128,0.35) 0%, transparent 70%);
      top: -160px; left: -120px;
    }
    .ptr-orb--2 {
      width: 400px; height: 400px;
      background: radial-gradient(circle, rgba(63,91,169,0.3) 0%, transparent 70%);
      bottom: -130px; right: -100px;
    }
    .ptr-orb--3 {
      width: 280px; height: 280px;
      background: radial-gradient(circle, rgba(156,39,176,0.2) 0%, transparent 70%);
      top: 50%; right: 15%;
      transform: translateY(-50%);
    }

    .ptr-spinner-wrap {
      position: relative;
      z-index: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
    }

    .ptr-circle-white {
      width: 36px; height: 36px;
      border: 3px solid rgba(255,255,255,0.2);
      border-top-color: #ffffff;
      border-radius: 50%;
      animation: ptrSpin 0.8s linear infinite;
    }

    .ptr-label {
      font-family: 'Montserrat', sans-serif;
      font-size: 13px;
      font-weight: 400;
      color: rgba(255,255,255,0.85);
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }

    @keyframes ptrSpin {
      to { transform: rotate(360deg); }
    }

    @keyframes ptrGradient {
      0%   { background-position: 0% 50%; }
      50%  { background-position: 100% 50%; }
      100% { background-position: 0% 50%; }
    }
  `]
})
export class PullToRefresh implements OnInit, OnDestroy {
  spinnerVisible = false;
  overlayVisible = false;

  private touchStartY = 0;
  private touchStartX = 0;
  private triggered   = false;
  private readonly THRESHOLD = 70;

  ngOnInit() {
    // ✅ passive: false permite llamar preventDefault() para bloquear el scroll nativo
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
    this.touchStartY    = e.touches[0].clientY;
    this.touchStartX    = e.touches[0].clientX;
    this.triggered      = false;
    this.spinnerVisible = false;
    this.overlayVisible = false;
  }

  private onTouchMove = (e: TouchEvent) => {
    if (this.triggered) return;

    const dy = e.touches[0].clientY - this.touchStartY;
    const dx = Math.abs(e.touches[0].clientX - this.touchStartX);

    if (dx > 40) return;
    if (this.getScrollTop() > 5) return;
    if (dy <= 0) return;

    // ✅ Bloquea el scroll nativo del navegador
    e.preventDefault();

    if (dy > 10) {
      this.spinnerVisible = true;
    }

    if (dy > this.THRESHOLD) {
      this.triggered = true;
    }
  }

  private onTouchEnd = () => {
    if (!this.triggered) {
      this.spinnerVisible = false;
      return;
    }

    setTimeout(() => {
      this.overlayVisible = true;
    }, 300);

    setTimeout(() => {
      location.reload();
    }, 1100);
  }

private getScrollTop(): number {
  // Busca el primer ancestro scrollable del elemento tocado
  const scrollable = document.querySelector('.main-content, .full-content') as HTMLElement | null;
  if (scrollable) return scrollable.scrollTop;
  return window.scrollY || document.documentElement.scrollTop;
}
}