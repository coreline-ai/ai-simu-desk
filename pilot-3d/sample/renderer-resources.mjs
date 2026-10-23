// Three shares the PBR LUT across renderers but registers a renderer-owned
// texture-dispose listener. Release it while that renderer's properties still
// exist; renderer.dispose() alone leaves those listener closures reachable.
export class RendererResources {
  constructor(renderer) { this.renderer = renderer; this.lut = null; this.disposed = false; }
  capture(root) {
    if (this.disposed || this.lut || !root) return !!this.lut;
    root.traverse(node => {
      if (this.lut) return;
      for (const material of [node.material].flat().filter(Boolean)) {
        const texture = this.renderer.properties.get(material).uniforms?.dfgLUT?.value;
        if (texture?.isTexture && texture.name === 'DFG_LUT') { this.lut = texture; break; }
      }
    });
    return !!this.lut;
  }
  release() {
    if (this.disposed) return;
    // Texture.dispose keeps its CPU data. Other live renderers re-upload the
    // shared LUT on their next draw using Three's normal texture lifecycle.
    this.lut?.dispose();
    this.lut = null;
  }
  dispose() {
    if (this.disposed) return;
    this.release();
    this.disposed = true;
    this.renderer = null;
  }
}
