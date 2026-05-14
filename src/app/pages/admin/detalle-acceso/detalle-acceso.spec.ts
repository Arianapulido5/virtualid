import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DetalleAcceso } from './detalle-acceso';

describe('DetalleAcceso', () => {
  let component: DetalleAcceso;
  let fixture: ComponentFixture<DetalleAcceso>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DetalleAcceso]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DetalleAcceso);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
