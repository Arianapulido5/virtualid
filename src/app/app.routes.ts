import { Routes } from '@angular/router';
import { adminAuthGuard } from './guards/admin-auth-guard';
import { authGuard } from './guards/auth-guard';
import { replaceHistoryGuard } from './guards/replace-history.guard';
import { DetalleCredencial } from './pages/detalle-credencial/detalle-credencial';
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

@Component({ selector: 'app-root-redirect', template: '', standalone: true })
export class RootRedirect implements OnInit {
  constructor(private router: Router) {}
  ngOnInit() {
    const isLocal = window.location.hostname !== 'localhost';
    this.router.navigate([isLocal ? '/login' : '/admin/login'], { replaceUrl: true });
  }
}

export const routes: Routes = [

  { path: '', component: RootRedirect },

  // ── USUARIO ────────────────────────────────────────────────────────────────
  { path: 'login',        loadComponent: () => import('./pages/login/login').then(m => m.Login) },
  { path: 'registro',     loadComponent: () => import('./pages/registro/registro').then(m => m.Registro) },
  { path: 'biometrica',   loadComponent: () => import('./pages/autenticacion-biometrica/autenticacion-biometrica').then(m => m.AutenticacionBiometrica) },

  // Raíces de sección — replaceHistoryGuard corta el historial al entrar
  { path: 'dashboard',    canActivate: [authGuard, replaceHistoryGuard], loadComponent: () => import('./pages/dashboard/dashboard').then(m => m.Dashboard) },
  { path: 'tarjetas',     canActivate: [authGuard, replaceHistoryGuard], loadComponent: () => import('./pages/gestion-tarjetas/gestion-tarjetas').then(m => m.GestionTarjetas) },
  { path: 'historial',    canActivate: [authGuard, replaceHistoryGuard], loadComponent: () => import('./pages/historial-accesos/historial-accesos').then(m => m.HistorialAccesos) },
  { path: 'mensajes',     canActivate: [authGuard, replaceHistoryGuard], loadComponent: () => import('./pages/mensajes/mensajes').then(m => m.Mensajes) },
  { path: 'configuracion', canActivate: [authGuard, replaceHistoryGuard], loadComponent: () => import('./pages/configuracion/configuracion').then(m => m.Configuracion) },
  { path: 'soporte',      canActivate: [authGuard, replaceHistoryGuard], loadComponent: () => import('./pages/soporte-usuario/soporte-usuario').then(m => m.SoporteUsuario) },
  { path: 'ubicacion',    canActivate: [authGuard, replaceHistoryGuard], loadComponent: () => import('./pages/ubicacion/ubicacion').then(m => m.Ubicacion) },

  // Sub-páginas — navegan normal (se apilan sobre la raíz, botón atrás regresa a la raíz)
  { path: 'detalle-acceso/:id',   canActivate: [authGuard], loadComponent: () => import('./pages/detalle-acceso-usuario/detalle-acceso-usuario').then(m => m.DetalleAccesoUsuario) },
  { path: 'agregar-credencial',   canActivate: [authGuard], loadComponent: () => import('./pages/agregar-credencial/agregar-credencial').then(m => m.AgregarCredencial) },
  { path: 'informacion-personal', canActivate: [authGuard], loadComponent: () => import('./pages/informacion-personal/informacion-personal').then(m => m.InformacionPersonal) },
  { path: 'cambiar-contrasena',   canActivate: [authGuard], loadComponent: () => import('./pages/cambiar-contrasena/cambiar-contrasena').then(m => m.CambiarContrasena) },
  { path: 'olvide-contrasena',    loadComponent: () => import('./pages/olvide-contrasena/olvide-contrasena').then(m => m.OlvideContrasena) },
  { path: 'credencial/:id',       canActivate: [authGuard], component: DetalleCredencial },

  // ── PÚBLICO ────────────────────────────────────────────────────────────────
  { path: 'registro-institucion', loadComponent: () => import('./pages/admin/registro-institucion/registro-institucion').then(m => m.RegistroInstitucion) },
  { path: 'acceso/:id',           loadComponent: () => import('./pages/acceso-punto/acceso-punto').then(m => m.AccesoPunto) },

  // ── ADMIN LOGIN ────────────────────────────────────────────────────────────
  { path: 'admin/login', loadComponent: () => import('./pages/admin/login-admin/login-admin').then(m => m.Login) },

  // ── ADMIN (protegido) ──────────────────────────────────────────────────────
  {
    path: 'admin',
    canActivate: [adminAuthGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard',             canActivate: [replaceHistoryGuard], loadComponent: () => import('./pages/admin/dashboard-admin/dashboard-admin').then(m => m.DashboardAdmin) },
      { path: 'usuarios',              canActivate: [replaceHistoryGuard], loadComponent: () => import('./pages/admin/usuarios/usuarios').then(m => m.Usuarios) },
      { path: 'mi-institucion',        canActivate: [replaceHistoryGuard], loadComponent: () => import('./pages/admin/mi-institucion/mi-institucion').then(m => m.MiInstitucion) },
      { path: 'administradores',       canActivate: [replaceHistoryGuard], loadComponent: () => import('./pages/admin/administradores/administradores').then(m => m.Administradores) },
      { path: 'credenciales',          canActivate: [replaceHistoryGuard], loadComponent: () => import('./pages/admin/credenciales/credenciales').then(m => m.Credenciales) },
      { path: 'puntos-acceso',         canActivate: [replaceHistoryGuard], loadComponent: () => import('./pages/admin/puntos-acceso/puntos-acceso').then(m => m.PuntosAcceso) },
      { path: 'historial-global',      canActivate: [replaceHistoryGuard], loadComponent: () => import('./pages/admin/historial-global/historial-global').then(m => m.HistorialGlobal) },
      { path: 'reportes',              canActivate: [replaceHistoryGuard], loadComponent: () => import('./pages/admin/reportes/reportes').then(m => m.Reportes) },
      { path: 'soporte',               canActivate: [replaceHistoryGuard], loadComponent: () => import('./pages/admin/soporte/soporte').then(m => m.Soporte) },

      // Sub-páginas admin — se apilan normalmente
      { path: 'usuarios/:id',          loadComponent: () => import('./pages/admin/detalle-usuario/detalle-usuario').then(m => m.DetalleUsuario) },
      { path: 'editar-institucion',    loadComponent: () => import('./pages/admin/editar-institucion/editar-institucion').then(m => m.EditarInstitucion) },
      { path: 'administradores/:id',   loadComponent: () => import('./pages/admin/detalle-admin/detalle-admin').then(m => m.DetalleAdmin) },
      { path: 'agregar-administrador', loadComponent: () => import('./pages/admin/agregar-administrador/agregar-administrador').then(m => m.AgregarAdministrador) },
      { path: 'editar-administrador',  loadComponent: () => import('./pages/admin/editar-administrador/editar-administrador').then(m => m.EditarAdministrador) },
      { path: 'credenciales/:id/validar', loadComponent: () => import('./pages/admin/validar-credencial/validar-credencial').then(m => m.ValidarCredencial) },
      { path: 'puntos-acceso/nuevo',   loadComponent: () => import('./pages/admin/agregar-punto-acceso/agregar-punto-acceso').then(m => m.AgregarPuntoAcceso) },
      { path: 'puntos-acceso/:id/historial', loadComponent: () => import('./pages/admin/historial-accesos/historial-accesos').then(m => m.HistorialAccesos) },
      { path: 'historial-global',      loadComponent: () => import('./pages/admin/historial-global/historial-global').then(m => m.HistorialGlobal) },
      { path: 'acceso/:id',            loadComponent: () => import('./pages/admin/detalle-acceso/detalle-acceso').then(m => m.DetalleAcceso) },
    ]
  },

  { path: '**', redirectTo: '' }
];