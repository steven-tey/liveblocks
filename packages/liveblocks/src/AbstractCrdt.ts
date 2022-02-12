import { Op, OpType, SerializedCrdt } from "./live";
import { StorageUpdate } from "./types";

export type ApplyResult =
  | { reverse: Op[]; modified: StorageUpdate }
  | { modified: false };

export interface Doc {
  generateId: () => string;
  generateOpId: () => string;
  addItem: (id: string, item: AbstractCrdt) => void;
  deleteItem: (id: string) => void;
  dispatch: (
    ops: Op[],
    reverseOps: Op[],
    storageUpdates: Map<string, StorageUpdate>
  ) => void;
}

export abstract class AbstractCrdt {
  #parent?: AbstractCrdt;
  #doc?: Doc;
  #id?: string;
  #parentKey?: string;

  /**
   * INTERNAL
   */
  protected get _doc() {
    return this.#doc;
  }

  /**
   * INTERNAL
   */
  get _id() {
    return this.#id;
  }

  /**
   * INTERNAL
   */
  get _parent() {
    return this.#parent;
  }

  /**
   * INTERNAL
   */
  get _parentKey() {
    return this.#parentKey;
  }

  /**
   * INTERNAL
   */
  _apply(op: Op, isLocal: boolean): ApplyResult {
    switch (op.type) {
      case OpType.DeleteCrdt: {
        if (this._parent != null && this._parentKey != null) {
          return this._parent._detachChild(this);
        }

        return { modified: false };
      }
    }

    return { modified: false };
  }

  /**
   * INTERNAL
   */
  _setParentLink(parent: AbstractCrdt, key: string) {
    if (this.#parent != null && this.#parent !== parent) {
      throw new Error("Cannot attach parent if it already exist");
    }

    this.#parentKey = key;
    this.#parent = parent;
  }

  /**
   * INTERNAL
   */
  _attach(id: string, doc: Doc) {
    if (this.#id || this.#doc) {
      throw new Error("Cannot attach if CRDT is already attached");
    }

    doc.addItem(id, this);

    this.#id = id;
    this.#doc = doc;
  }

  /**
   * INTERNAL
   */
  abstract _attachChild(
    id: string,
    key: string,
    crdt: AbstractCrdt,
    isLocal: boolean
  ): ApplyResult;

  /**
   * INTERNAL
   */
  _detach() {
    if (this.#doc && this.#id) {
      this.#doc.deleteItem(this.#id);
    }

    this.#parent = undefined;
    this.#doc = undefined;
  }

  /**
   * INTERNAL
   */
  abstract _detachChild(crdt: AbstractCrdt): ApplyResult;
  /**
   * INTERNAL
   */
  abstract _serialize(parentId: string, parentKey: string, doc?: Doc): Op[];

  /**
   * INTERNAL
   */
  abstract _toSerializedCrdt(): SerializedCrdt;

  abstract _getType(): string;
}