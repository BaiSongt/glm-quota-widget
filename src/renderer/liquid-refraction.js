(() => {
  'use strict';

  const SURFACE_SELECTOR = '.titlebar, .summary-card, .account-card, .empty, .add-btn, .modal';
  const surfaces = new Set();
  const byElement = new WeakMap();
  let sequence = 0;

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function smoothstep(edge0, edge1, value) {
    const t = clamp((value - edge0) / Math.max(edge1 - edge0, 1e-6), 0, 1);
    return t * t * (3 - 2 * t);
  }

  function roundedRectSdf(x, y, halfWidth, halfHeight, radius) {
    const qx = Math.abs(x) - halfWidth + radius;
    const qy = Math.abs(y) - halfHeight + radius;
    const outsideX = Math.max(qx, 0);
    const outsideY = Math.max(qy, 0);
    return Math.min(Math.max(qx, qy), 0)
      + Math.hypot(outsideX, outsideY)
      - radius;
  }

  function svgNode(name) {
    return document.createElementNS('http://www.w3.org/2000/svg', name);
  }

  function parserSupportsSvgBackdropFilter() {
    const probe = document.createElement('div');
    probe.style.backdropFilter = 'url("#liquid-refraction-probe")';
    if (probe.style.backdropFilter) return true;
    probe.style.webkitBackdropFilter = 'url("#liquid-refraction-probe")';
    return Boolean(probe.style.webkitBackdropFilter);
  }

  const supported = parserSupportsSvgBackdropFilter();
  document.documentElement.dataset.refraction = supported ? 'svg' : 'css';

  if (!supported) return;

  class LiquidRefractionSurface {
    constructor(element) {
      this.element = element;
      this.id = `glm-liquid-refraction-${++sequence}`;
      this.frame = 0;
      this.lastSignature = '';

      this.canvas = document.createElement('canvas');
      this.context = this.canvas.getContext('2d', { alpha: false });

      this.svg = svgNode('svg');
      this.svg.setAttribute('width', '0');
      this.svg.setAttribute('height', '0');
      this.svg.setAttribute('aria-hidden', 'true');
      this.svg.classList.add('liquid-filter-def');

      const defs = svgNode('defs');
      this.filter = svgNode('filter');
      this.filter.setAttribute('id', this.id);
      this.filter.setAttribute('filterUnits', 'userSpaceOnUse');
      this.filter.setAttribute('color-interpolation-filters', 'sRGB');

      this.map = svgNode('feImage');
      this.map.setAttribute('result', 'displacementMap');
      this.map.setAttribute('preserveAspectRatio', 'none');

      this.displacement = svgNode('feDisplacementMap');
      this.displacement.setAttribute('in', 'SourceGraphic');
      this.displacement.setAttribute('in2', 'displacementMap');
      this.displacement.setAttribute('xChannelSelector', 'R');
      this.displacement.setAttribute('yChannelSelector', 'G');

      this.filter.append(this.map, this.displacement);
      defs.appendChild(this.filter);
      this.svg.appendChild(defs);
      document.body.appendChild(this.svg);

      this.element.classList.add('liquid-refractive');
      this.element.style.setProperty('--liquid-refraction-filter', `url("#${this.id}")`);

      this.resizeObserver = new ResizeObserver(() => this.schedule());
      this.resizeObserver.observe(this.element);
      this.schedule();
    }

    schedule() {
      if (this.frame) return;
      this.frame = requestAnimationFrame(() => {
        this.frame = 0;
        this.rebuild();
      });
    }

    rebuild() {
      if (!this.element.isConnected) return;

      const rect = this.element.getBoundingClientRect();
      const width = Math.round(rect.width);
      const height = Math.round(rect.height);
      if (width < 8 || height < 8) return;

      const style = getComputedStyle(this.element);
      const cssRadius = parseFloat(style.borderTopLeftRadius) || Math.min(width, height) * 0.2;
      const scale = parseFloat(style.getPropertyValue('--liquid-refraction-scale')) || 18;
      const maxMapDimension = 220;
      const quality = Math.min(0.68, maxMapDimension / Math.max(width, height));
      const mapWidth = Math.max(28, Math.round(width * quality));
      const mapHeight = Math.max(24, Math.round(height * quality));
      const radius = clamp(cssRadius * quality, 2, Math.min(mapWidth, mapHeight) / 2);
      const signature = [width, height, mapWidth, mapHeight, radius.toFixed(2), scale.toFixed(2)].join(':');
      if (signature === this.lastSignature) return;
      this.lastSignature = signature;

      this.canvas.width = mapWidth;
      this.canvas.height = mapHeight;

      const image = this.context.createImageData(mapWidth, mapHeight);
      const data = image.data;
      const halfWidth = mapWidth / 2;
      const halfHeight = mapHeight / 2;
      const edgeBand = clamp(radius * 1.35, 7, 28);
      let offset = 0;

      for (let y = 0; y < mapHeight; y += 1) {
        for (let x = 0; x < mapWidth; x += 1) {
          const px = x + 0.5 - halfWidth;
          const py = y + 0.5 - halfHeight;
          const sdf = roundedRectSdf(px, py, halfWidth, halfHeight, radius);

          let red = 128;
          let green = 128;

          if (sdf <= 0) {
            const inwardDistance = -sdf;
            const edgeWeight = 1 - smoothstep(0, edgeBand, inwardDistance);
            const nx = px / Math.max(halfWidth, 1);
            const ny = py / Math.max(halfHeight, 1);
            const radialLength = Math.max(Math.hypot(nx, ny), 1e-5);
            const unitX = nx / radialLength;
            const unitY = ny / radialLength;
            const cornerBoost = 1 + Math.min(Math.abs(nx * ny) * 0.42, 0.24);
            const lens = Math.pow(edgeWeight, 1.42) * cornerBoost;

            // Pull the sampled backdrop slightly toward the optical centre near
            // the curved edge. This creates the magnified/refraction band seen
            // in liquid-glass implementations without animating the map.
            red = clamp(Math.round(128 - unitX * lens * 108), 0, 255);
            green = clamp(Math.round(128 - unitY * lens * 108), 0, 255);
          }

          data[offset] = red;
          data[offset + 1] = green;
          data[offset + 2] = 128;
          data[offset + 3] = 255;
          offset += 4;
        }
      }

      this.context.putImageData(image, 0, 0);
      const dataUrl = this.canvas.toDataURL('image/png');

      this.filter.setAttribute('x', '0');
      this.filter.setAttribute('y', '0');
      this.filter.setAttribute('width', String(width));
      this.filter.setAttribute('height', String(height));
      this.map.setAttribute('width', String(width));
      this.map.setAttribute('height', String(height));
      this.map.setAttribute('href', dataUrl);
      this.map.setAttributeNS('http://www.w3.org/1999/xlink', 'href', dataUrl);
      this.displacement.setAttribute('scale', String(scale));
    }

    destroy() {
      if (this.frame) cancelAnimationFrame(this.frame);
      this.resizeObserver.disconnect();
      this.svg.remove();
      this.element.classList.remove('liquid-refractive');
      this.element.style.removeProperty('--liquid-refraction-filter');
      surfaces.delete(this);
    }
  }

  function enhance(element) {
    if (!(element instanceof Element) || byElement.has(element)) return;
    const surface = new LiquidRefractionSurface(element);
    byElement.set(element, surface);
    surfaces.add(surface);
  }

  function scan(root = document) {
    if (root instanceof Element && root.matches(SURFACE_SELECTOR)) enhance(root);
    root.querySelectorAll?.(SURFACE_SELECTOR).forEach(enhance);
  }

  function cleanupDisconnected() {
    for (const surface of [...surfaces]) {
      if (!surface.element.isConnected) surface.destroy();
    }
  }

  const mutations = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node instanceof Element) scan(node);
      }
    }
    cleanupDisconnected();
  });

  mutations.observe(document.body, { childList: true, subtree: true });

  const themeObserver = new MutationObserver(() => {
    for (const surface of surfaces) {
      surface.lastSignature = '';
      surface.schedule();
    }
  });
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });

  scan(document);
})();