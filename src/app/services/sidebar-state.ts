import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class SidebarState {
  private _isOpen = new BehaviorSubject<boolean>(false);
  isOpen$ = this._isOpen.asObservable();

  toggle() { this._isOpen.next(!this._isOpen.value); }
  close()  { this._isOpen.next(false); }
  get isOpen() { return this._isOpen.value; }
}