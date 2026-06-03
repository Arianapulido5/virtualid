import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { Location } from '@angular/common';

export const replaceHistoryGuard: CanActivateFn = (
  route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
) => {
  const router = inject(Router);
  const location = inject(Location);

  // Reemplaza la entrada actual del historial del navegador
  // para que el botón "atrás" no pueda regresar a la página anterior de esta sección
  location.replaceState(state.url);

  return true;
};