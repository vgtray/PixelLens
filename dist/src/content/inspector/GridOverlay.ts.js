export class GridOverlay {
  root;
  canvas = null;
  ctx = null;
  gridSize = 8;
  visible = false;
  rafId = null;
  onScroll = () => this.scheduleRedraw();
  onResize = () => this.handleResize();
  constructor(root) {
    this.root = root;
  }
  show(size) {
    if (size) this.gridSize = size;
    if (!this.canvas) this.createCanvas();
    this.visible = true;
    this.canvas.style.display = "block";
    this.draw();
    window.addEventListener("scroll", this.onScroll, { passive: true });
    window.addEventListener("resize", this.onResize, { passive: true });
  }
  hide() {
    this.visible = false;
    if (this.canvas) this.canvas.style.display = "none";
    window.removeEventListener("scroll", this.onScroll);
    window.removeEventListener("resize", this.onResize);
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
  }
  setGridSize(size) {
    this.gridSize = size;
    if (this.visible) this.draw();
  }
  destroy() {
    this.hide();
    this.canvas?.remove();
    this.canvas = null;
    this.ctx = null;
  }
  createCanvas() {
    this.canvas = document.createElement("canvas");
    this.canvas.className = "pixellens-grid-canvas";
    this.canvas.style.display = "none";
    this.root.appendChild(this.canvas);
    this.ctx = this.canvas.getContext("2d");
    this.handleResize();
  }
  handleResize() {
    if (!this.canvas) return;
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = window.innerWidth * dpr;
    this.canvas.height = window.innerHeight * dpr;
    this.canvas.style.width = `${window.innerWidth}px`;
    this.canvas.style.height = `${window.innerHeight}px`;
    if (this.ctx) this.ctx.scale(dpr, dpr);
    if (this.visible) this.draw();
  }
  scheduleRedraw() {
    if (this.rafId !== null) return;
    this.rafId = requestAnimationFrame(() => {
      this.rafId = null;
      this.draw();
    });
  }
  draw() {
    if (!this.ctx || !this.canvas) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const dpr = window.devicePixelRatio || 1;
    this.ctx.clearRect(0, 0, w * dpr, h * dpr);
    this.ctx.resetTransform();
    this.ctx.scale(dpr, dpr);
    const offsetX = window.scrollX % this.gridSize;
    const offsetY = window.scrollY % this.gridSize;
    this.ctx.strokeStyle = "rgba(99, 102, 241, 0.05)";
    this.ctx.lineWidth = 0.5;
    this.ctx.beginPath();
    for (let x = -offsetX; x <= w; x += this.gridSize) {
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, h);
    }
    for (let y = -offsetY; y <= h; y += this.gridSize) {
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(w, y);
    }
    this.ctx.stroke();
  }
}
