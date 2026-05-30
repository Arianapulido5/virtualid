import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

bootstrapApplication(App, appConfig).then(() => {
  if (!('serviceWorker' in navigator)) return;

  navigator.serviceWorker.register('/custom-sw.js', { scope: '/' })
    .then((registration) => {
      console.log('✅ SW registrado:', registration.scope);

      // Si ya había un SW nuevo esperando al abrir la app, actívalo de una
      if (registration.waiting) {
        registration.waiting.postMessage('SKIP_WAITING');
      }

      // Cuando se encuentra una nueva versión en segundo plano
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          // Cuando el nuevo SW está listo e instalado
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            newWorker.postMessage('SKIP_WAITING');
          }
        });
      });

      // Cuando el nuevo SW toma el control, recarga la app
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
          refreshing = true;
          window.location.reload();
        }
      });
    })
    .catch((e) => console.error('❌ SW error:', e));
});