import { ImmutableRef, merge } from "./ImmutableRef";
import { compactObject, freeze } from "./utils";

/**
 * Managed immutable cache for accessing "me" presence data as read-only.
 * XXX Update docs
 */
export class PatchableRef<
  T extends { [key: string]: unknown }
> extends ImmutableRef<T> {
  /** @internal */
  private _obj: Readonly<T>;

  constructor(initialValue: T) {
    super();
    this._obj = freeze(compactObject(initialValue));
  }

  /** @internal */
  _toImmutable(): Readonly<T> {
    return this._obj;
  }

  /**
   * Patches the current "me" instance.
   * XXX Update docs
   */
  patch(patch: Partial<T>): void {
    const oldObj = this._obj;
    const newObj = merge(oldObj, patch);
    if (oldObj !== newObj) {
      this._obj = freeze(newObj);
      this.invalidate();
    }
  }
}

export class ValueRef<T> extends ImmutableRef<T> {
  /** @internal */
  private _value: Readonly<T>;

  constructor(initialValue: T) {
    super();
    this._value = freeze(compactObject(initialValue));
  }

  /** @internal */
  _toImmutable(): Readonly<T> {
    return this._value;
  }

  set(newValue: T): void {
    if (this._value !== newValue) {
      this._value = freeze(newValue);
      this.invalidate();
    }
  }
}

// TODO: Generalize to arbitrary number of "input refs"
export class DerivedRef<T, V1, V2> extends ImmutableRef<T> {
  /** @internal */
  private _refs: readonly [ImmutableRef<V1>, ImmutableRef<V2>];
  /** @internal */
  private _transform: (v1: V1, v2: V2) => T;

  constructor(
    otherRefs: readonly [ImmutableRef<V1>, ImmutableRef<V2>],
    transformFn: (...args: [V1, V2]) => T
  ) {
    super();

    this._refs = otherRefs;
    this._refs.forEach((ref) => {
      // TODO: We should also _unsubscribe_ these at some point... how? Require an explicit .destroy() call?
      ref.didInvalidate.subscribe(() => this.invalidate());
    });

    this._transform = transformFn;
  }

  /** @internal */
  _toImmutable(): Readonly<T> {
    return this._transform(this._refs[0].current, this._refs[1].current);
  }
}

export class MappedRef<K extends string | number, V> extends ImmutableRef<{
  readonly [P in K]: V;
}> {
  /** @internal */
  private _map: Map<K, ImmutableRef<V>>;
  /** @internal */
  private _unsubs: Map<K, () => void>;

  constructor() {
    super();
    this._map = new Map();
    this._unsubs = new Map();
  }

  /** @internal */
  _toImmutable(): { readonly [P in K]: V } {
    const rv = {} as { [P in K]: V };
    this._map.forEach((value, key) => {
      rv[key] = value.current;
    });
    return rv;
  }

  getRef(key: K): ImmutableRef<V> | undefined {
    return this._map.get(key);
  }

  _deleteDontInvalidate(key: K): boolean {
    const deleted = this._map.delete(key);
    if (deleted) {
      const unsub = this._unsubs.get(key);
      if (unsub) {
        unsub();
      }
      this._unsubs.delete(key);
    }
    return deleted;
  }

  delete(key: K): void {
    if (this._deleteDontInvalidate(key)) {
      this.invalidate();
    }
  }

  set(key: K, ref: ImmutableRef<V>): void {
    this._deleteDontInvalidate(key);
    this._map.set(key, ref);
    this._unsubs.set(
      key,
      ref.didInvalidate.subscribe(() => this.invalidate())
    );
    this.invalidate();
  }

  clear(): void {
    this._unsubs.forEach((unsub) => unsub());
    this._unsubs.clear();
    this._map.clear();
    this.invalidate();
  }
}
