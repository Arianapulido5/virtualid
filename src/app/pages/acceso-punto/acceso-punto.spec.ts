import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AccesoPunto } from './acceso-punto';

describe('AccesoPunto', () => {
  let component: AccesoPunto;
  let fixture: ComponentFixture<AccesoPunto>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AccesoPunto]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AccesoPunto);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
