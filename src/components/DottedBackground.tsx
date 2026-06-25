import React, { useEffect, useRef } from 'react';

interface DottedBackgroundProps {
  isDark: boolean;
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

function hexToRgba(hex: string, alpha = 1) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/**
 * Fixed, full-viewport polka-dot texture rendered to a canvas and masked with a
 * radial feather. Transparent background so the page colour shows through.
 * White dots in dark mode, black dots in light mode.
 */
const DottedBackground: React.FC<DottedBackgroundProps> = ({ isDark }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const dotColor = isDark ? '#ffffff' : '#000000';

    const draw = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const { spacing, dotSize, baseOpacity, randomOpacity, tiling } = SETTINGS;
      for (let y = 0; y < h; y += spacing) {
        for (let x = 0; x < w; x += spacing) {
          let offsetX = 0;
          if (tiling === 'offset' && (y / spacing) % 2 === 1) offsetX = spacing / 2;
          else if (tiling === 'random') offsetX = Math.random() * spacing - spacing / 2;

          const opacity = randomOpacity ? Math.random() * baseOpacity : baseOpacity;
          ctx.fillStyle = hexToRgba(dotColor, opacity);
          ctx.beginPath();
          ctx.arc(x + offsetX, y, dotSize / 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      const { maskType, maskSize, feather } = SETTINGS;
      if (maskType !== 'none') {
        const gradient = ctx.createRadialGradient(
          w / 2, h / 2, (w * maskSize) / 200,
          w / 2, h / 2, Math.max(w, h) / 2 + feather,
        );
        if (maskType === 'center') {
          gradient.addColorStop(0, 'rgba(255,255,255,1)');
          gradient.addColorStop(1, 'rgba(255,255,255,0)');
        } else {
          gradient.addColorStop(0, 'rgba(255,255,255,0)');
          gradient.addColorStop(1, 'rgba(255,255,255,1)');
        }
        ctx.globalCompositeOperation = 'destination-in';
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, w, h);
        ctx.globalCompositeOperation = 'source-over';
      }
    };

    draw();
    window.addEventListener('resize', draw);
    return () => window.removeEventListener('resize', draw);
  }, [isDark]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
    />
  );
};

export default DottedBackground;
