import { PatchableRef } from "../ValueRef";

type P = {
  x: number;
  y: number;
  z?: number;
};

describe('Read-only "p" ref cache', () => {
  it("empty", () => {
    const p = new PatchableRef({ x: 0, y: 0, z: undefined });
    expect(p.current).toStrictEqual({ x: 0, y: 0 });
  });

  describe('Tracking "p"', () => {
    it("patching p", () => {
      const p = new PatchableRef<P>({ x: 0, y: 0 });
      p.patch({ y: 1, z: 2 });

      expect(p.current).toStrictEqual({ x: 0, y: 1, z: 2 });
    });

    it("patching p with undefineds deletes keys", () => {
      const p = new PatchableRef<P>({ x: 1, y: 2 });

      p.patch({ x: undefined });
      expect(p.current).toStrictEqual({ y: 2 });

      p.patch({ y: undefined });
      expect(p.current).toStrictEqual({});

      p.patch({ z: undefined });
      expect(p.current).toStrictEqual({});
    });
  });

  describe("caching", () => {
    it("caches immutable results (p)", () => {
      const p = new PatchableRef<P>({ x: 0, y: 0 });

      const me1 = p.current;
      const me2 = p.current;
      expect(me1).toBe(me2);

      // These are effectively no-ops
      p.patch({ x: 0 });
      p.patch({ y: 0, z: undefined });

      const me3 = p.current;
      expect(me2).toBe(me3); // No observable change!

      p.patch({ y: -1 });

      const me4 = p.current;
      const me5 = p.current;
      expect(me3).not.toBe(me4); // p changed...
      expect(me4).toBe(me5);

      const me6 = p.current;
      const me7 = p.current;
      expect(me5).toBe(me6); // p did not change
      expect(me6).toBe(me7);
    });
  });
});
