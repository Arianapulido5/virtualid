import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EditarAdministrador } from './editar-administrador';

describe('EditarAdministrador', () => {
  let component: EditarAdministrador;
  let fixture: ComponentFixture<EditarAdministrador>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EditarAdministrador]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EditarAdministrador);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
