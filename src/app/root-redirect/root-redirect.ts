import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

@Component({ selector: 'app-root-redirect', template: '', standalone: true })
export class RootRedirect implements OnInit {
  constructor(private router: Router) {}
  ngOnInit() {
    const isLocal = window.location.hostname === 'localhost';
    this.router.navigate([isLocal ? '/login' : '/admin/login'], { replaceUrl: true });
  }
}