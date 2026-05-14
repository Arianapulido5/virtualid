import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SoporteUsuario } from './soporte-usuario';

describe('SoporteUsuario', () => {
  let component: SoporteUsuario;
  let fixture: ComponentFixture<SoporteUsuario>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SoporteUsuario]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SoporteUsuario);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
