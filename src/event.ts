import { IDisposable } from './utils'

export interface Event<T> {
  (listener: (e: T) => any, thisArgs?: any, disposables?: IDisposable[]): IDisposable;
}

export namespace Event {
  export const None: Event<any> = () => Object.freeze<IDisposable>({ dispose() { } });
}

export class Listener<T> {
  constructor(
    readonly callback: (e: T) => void,
    readonly callbackThis: any | undefined,
  ) { }

  invoke(e: T) {
    this.callback.call(this.callbackThis, e);
  }
}

export class Emitter<T> {
  private _disposed: boolean = false;
  private _event?: Event<T>;
  private _listeners?: Listener<T>[] = [];

  dispose() {
    if (!this._disposed) {
      this._disposed = true;
      if (this._listeners) {
        this._listeners.length = 0;
      }
    }
  }

  get event(): Event<T> {
    if (!this._event) {
      this._event = (callback: (e: T) => any, thisArgs?: any, disposables?: IDisposable[]) => {
        if (!this._listeners) {
          this._listeners = [];
        }

        const listener = new Listener(callback, thisArgs);
        this._listeners.push(listener);

        let result: IDisposable;
        result = {
          dispose: () => {
            if (this._listeners) {
              const idx = this._listeners.indexOf(listener);
              if (idx >= 0) {
                this._listeners.splice(idx, 1);
              }
            }
          }
        }

        if (Array.isArray(disposables)) {
          disposables.push(result);
        }

        return result;
      };
    }
    return this._event;
  }

  fire(event: T): void {
    if (this._listeners) {
      this._listeners.forEach(listener => listener.invoke(event));
    }
  }
}
