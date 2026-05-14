import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GestionTarjetas } from './gestion-tarjetas';

describe('GestionTarjetas', () => {
  let component: GestionTarjetas;
  let fixture: ComponentFixture<GestionTarjetas>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GestionTarjetas]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GestionTarjetas);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
