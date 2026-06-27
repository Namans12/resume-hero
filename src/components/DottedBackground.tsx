import React, { useEffect, useRef } from 'react';

interface DottedBackgroundProps {
  isDark: boolean;
  opacity?: number;
}

// Defaults mirrored from the polka-dot generator controls.
const SETTINGS = {
  spacing: 40,        // density
  dotSize: 5,
  baseOpacity: 1,     // opacity 100%
  randomOpacity: false,
  tiling: 'grid' as 'grid' | 'offset' | 'random',
  maskType: 'center' as 'center' | 'edges' | 'none',
  maskSize: 5,
  feather: 2,
};

// Interactive cursor-connection tuning.
// Only the dots in the cursor's immediate grid cell connect: one line when the
// cursor sits on a dot, up to 4 when it's in the middle of four dots.
const CONNECT_RADIUS = SETTINGS.spacing * 0.95; // px - just under one cell
const MAX_LINKS = 4;
const LINE_STRENGTH = 1; // max line opacity at the cursor
const EASE = 0.18;          // cursor-follow easing (lower = smoother/laggier)

interface Dot { x: number; y: number; alpha: number; }

function hexToRgba(hex: string, alpha = 1) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/**
 * Fixed, full-viewport polka-dot texture with an interactive constellation
 * effect: dots near the cursor connect to it with lines that fade with distance
 * and continuously break/reform as the pointer moves. White dots in dark mode,
 * black dots in light mode.
 */
const DottedBackground: React.FC<DottedBackgroundProps> = ({ isDark, opacity = 1 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dotsRef = useRef<Dot[]>([]);
  const mouseRef = useRef({ x: 0, y: 0, active: false });
  const smoothRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const dotColor = isDark ? '#ffffff' : '#000000';
    let w = 0, h = 0, dpr = 1;

    // Precompute the dot field + each dot's masked base opacity.
    const buildField = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const { spacing, baseOpacity, randomOpacity, tiling, maskType, maskSize, feather } = SETTINGS;
      const cx = w / 2, cy = h / 2;
      const r0 = (w * maskSize) / 200;
      const R = Math.max(w, h) / 2 + feather;

      const dots: Dot[] = [];
      for (let y = 0; y < h; y += spacing) {
        for (let x = 0; x < w; x += spacing) {
          let offsetX = 0;
          if (tiling === 'offset' && (y / spacing) % 2 === 1) offsetX = spacing / 2;
          else if (tiling === 'random') offsetX = Math.random() * spacing - spacing / 2;
          const px = x + offsetX, py = y;

          let m = 1;
          if (maskType !== 'none') {
            const d = Math.hypot(px - cx, py - cy);
            const t = Math.max(0, Math.min(1, (d - r0) / (R - r0)));
            m = maskType === 'center' ? 1 - t : t;
          }
          const rnd = randomOpacity ? Math.random() : 1;
          dots.push({ x: px, y: py, alpha: baseOpacity * m * rnd });
        }
      }
      dotsRef.current = dots;
    };

    const render = () => {
      ctx.clearRect(0, 0, w, h);
      const dots = dotsRef.current;
      const { dotSize } = SETTINGS;
      const radius = dotSize / 2;

      // Static dot field.
      for (const dot of dots) {
        if (dot.alpha <= 0.01) continue;
        ctx.fillStyle = hexToRgba(dotColor, dot.alpha);
        ctx.beginPath();
        ctx.arc(dot.x, dot.y, radius, 0, Math.PI * 2);
        ctx.fill();
      }

      // Ease the anchor point toward the real cursor so lines glide rather than
      // snap as the pointer crosses between grid cells.
      const m = mouseRef.current;
      const s = smoothRef.current;
      s.x += (m.x - s.x) * EASE;
      s.y += (m.y - s.y) * EASE;

      // Cursor connections - link only to the nearest few dots (the cursor's
      // grid cell): 1 line when on a dot, up to MAX_LINKS in the middle.
      if (m.active) {
        const near: { dot: Dot; dist: number }[] = [];
        for (const dot of dots) {
          const dist = Math.hypot(dot.x - s.x, dot.y - s.y);
          if (dist <= CONNECT_RADIUS) near.push({ dot, dist });
        }
        near.sort((a, b) => a.dist - b.dist);

        ctx.lineCap = 'round';
        for (let i = 0; i < Math.min(MAX_LINKS, near.length); i++) {
          const { dot, dist } = near[i];
          const t = 1 - dist / CONNECT_RADIUS;  // 1 at cursor → 0 at cell edge
          const k = Math.pow(t, 0.45);          // bold through the cell, soft fade only at the edge

          // Inherit the dot's masked fade so lines dim in the vignetted corners.
          ctx.strokeStyle = hexToRgba(dotColor, k * LINE_STRENGTH * dot.alpha);
          ctx.lineWidth = 0.8 + k * 2;
          ctx.beginPath();
          ctx.moveTo(s.x, s.y);
          ctx.lineTo(dot.x, dot.y);
          ctx.stroke();

          // Brighten the connected dot, but keep it within its own fade.
          ctx.fillStyle = hexToRgba(dotColor, Math.min(1, dot.alpha * (1 + k)));
          ctx.beginPath();
          ctx.arc(dot.x, dot.y, radius + k * 1.8, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      rafRef = requestAnimationFrame(render);
    };

    let rafRef = 0;
    buildField();
    rafRef = requestAnimationFrame(render);

    const onMove = (e: MouseEvent) => {
      if (!mouseRef.current.active) {
        smoothRef.current.x = e.clientX;
        smoothRef.current.y = e.clientY;
      }
      mouseRef.current = { x: e.clientX, y: e.clientY, active: true };
    };
    const onLeave = () => { mouseRef.current.active = false; };
    const onResize = () => buildField();

    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('mouseout', onLeave);
    window.addEventListener('blur', onLeave);
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(rafRef);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseout', onLeave);
      window.removeEventListener('blur', onLeave);
      window.removeEventListener('resize', onResize);
    };
  }, [isDark]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="absolute top-0 left-0 pointer-events-none"
      style={{ zIndex: 0, opacity, transition: 'opacity 0.5s ease' }}
    />
  );
};

export default DottedBackground;
