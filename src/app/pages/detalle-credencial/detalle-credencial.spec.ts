import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DetalleCredencial } from './detalle-credencial';

describe('DetalleCredencial', () => {
  let component: DetalleCredencial;
  let fixture: ComponentFixture<DetalleCredencial>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DetalleCredencial]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DetalleCredencial);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
