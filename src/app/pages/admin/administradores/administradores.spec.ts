import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Administradores } from './administradores';

describe('Administradores', () => {
  let component: Administradores;
  let fixture: ComponentFixture<Administradores>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Administradores]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Administradores);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
