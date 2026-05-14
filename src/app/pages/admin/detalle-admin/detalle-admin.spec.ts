import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DetalleAdmin } from './detalle-admin';

describe('DetalleAdmin', () => {
  let component: DetalleAdmin;
  let fixture: ComponentFixture<DetalleAdmin>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DetalleAdmin]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DetalleAdmin);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
