import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InformacionPersonal } from './informacion-personal';

describe('InformacionPersonal', () => {
  let component: InformacionPersonal;
  let fixture: ComponentFixture<InformacionPersonal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InformacionPersonal]
    })
    .compileComponents();

    fixture = TestBed.createComponent(InformacionPersonal);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
