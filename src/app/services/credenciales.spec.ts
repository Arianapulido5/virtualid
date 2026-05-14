import { TestBed } from '@angular/core/testing';

import { Credenciales } from './credenciales';

describe('Credenciales', () => {
  let service: Credenciales;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Credenciales);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
