import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';

export const adminAuthGuard: CanActivateFn = () => {
  const router = inject(Router);
  const token  = localStorage.getItem('token');
  const rol    = localStorage.getItem('rol');

  if (!token || rol !== 'admin') {
    router.navigate(['/admin/login']);  // ← corregido
    return false;
  }
  return true;
};