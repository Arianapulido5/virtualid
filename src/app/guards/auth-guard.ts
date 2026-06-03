import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

export const authGuard: CanActivateFn = () => {
  const router = inject(Router);
  const token = localStorage.getItem('token');

  if (!token) {
    router.navigate(['/login'], { replaceUrl: true });
    return false;
  }

  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const ahora = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < ahora) {
      localStorage.removeItem('token');
      router.navigate(['/login'], { replaceUrl: true });
      return false;
    }
  } catch {
    localStorage.removeItem('token');
    router.navigate(['/login'], { replaceUrl: true });
    return false;
  }

  return true;
};