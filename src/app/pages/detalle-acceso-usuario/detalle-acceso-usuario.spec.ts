import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DetalleAccesoUsuario } from './detalle-acceso-usuario';

describe('DetalleAccesoUsuario', () => {
  let component: DetalleAccesoUsuario;
  let fixture: ComponentFixture<DetalleAccesoUsuario>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DetalleAccesoUsuario]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DetalleAccesoUsuario);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
