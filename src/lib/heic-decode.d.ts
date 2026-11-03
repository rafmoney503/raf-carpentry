/* heic-decode ships no types: the one call src/lib/photo-jpeg.ts makes. */
declare module 'heic-decode' {
  type Decoded = { width: number; height: number; data: Uint8ClampedArray };
  function decode(input: { buffer: Uint8Array | ArrayBuffer }): Promise<Decoded>;
  export default decode;
}
