import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AgregarCredencial } from './agregar-credencial';

describe('AgregarCredencial', () => {
  let component: AgregarCredencial;
  let fixture: ComponentFixture<AgregarCredencial>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AgregarCredencial]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AgregarCredencial);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
