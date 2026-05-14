// src/app/shared/sidebar-admin/sidebar-admin.ts
import { Component, Input, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { AdminInfoService } from '../../services/admin-info.service';

@Component({
  selector: 'app-sidebar-admin',
  standalone: true,
  imports: [RouterLink, CommonModule],
  templateUrl: './sidebar-admin.html',
  styleUrls: ['./sidebar-admin.scss']
})
export class SidebarAdminComponent implements OnInit, OnDestroy {
  @Input() paginaActiva: string = '';
  isOpen         = false;
  adminNombre    = '';
  adminIniciales = '';

  private subs: Subscription[] = [];

  constructor(
    private router: Router,
    private adminInfo: AdminInfoService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.subs.push(
      this.adminInfo.nombre$.subscribe(v => {
        this.adminNombre = v || '';
        this.cdr.detectChanges();
      }),
      this.adminInfo.iniciales$.subscribe(v => {
        this.adminIniciales = v || '';
        this.cdr.detectChanges();
      })
    );
    this.adminInfo.cargar();
  }

  ngOnDestroy() {
    this.subs.forEach(s => s.unsubscribe());
  }

  toggleMenu() { this.isOpen = !this.isOpen; }
  closeMenu()  { this.isOpen = false; }

  cerrarSesion() {
    this.adminInfo.limpiar();
    localStorage.removeItem('token');
    localStorage.removeItem('rol');
    this.router.navigate(['/login']);
  }
}