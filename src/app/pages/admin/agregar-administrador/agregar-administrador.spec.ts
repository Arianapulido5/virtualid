import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AgregarAdministrador } from './agregar-administrador';

describe('AgregarAdministrador', () => {
  let component: AgregarAdministrador;
  let fixture: ComponentFixture<AgregarAdministrador>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AgregarAdministrador]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AgregarAdministrador);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
