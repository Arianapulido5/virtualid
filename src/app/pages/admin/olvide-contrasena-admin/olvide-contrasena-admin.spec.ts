import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OlvideContrasenaAdmin } from './olvide-contrasena-admin';

describe('OlvideContrasenaAdmin', () => {
  let component: OlvideContrasenaAdmin;
  let fixture: ComponentFixture<OlvideContrasenaAdmin>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OlvideContrasenaAdmin]
    })
    .compileComponents();

    fixture = TestBed.createComponent(OlvideContrasenaAdmin);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
