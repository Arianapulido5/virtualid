import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

  bootstrapApplication(App, appConfig).then(() => {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/custom-sw.js', { scope: '/' })
      .then(r => console.log('✅ SW registrado:', r.scope))
      .catch(e => console.error('❌ SW error:', e));
  }
});