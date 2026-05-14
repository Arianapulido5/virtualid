import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AutenticacionBiometrica } from './autenticacion-biometrica';

describe('AutenticacionBiometrica', () => {
  let component: AutenticacionBiometrica;
  let fixture: ComponentFixture<AutenticacionBiometrica>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AutenticacionBiometrica]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AutenticacionBiometrica);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
