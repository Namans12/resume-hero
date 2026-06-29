import { useEffect, useRef } from 'react';

/* A line anchored to the page (absolute) alongside the right edge, spanning the
   About section down to just above the footer. It SCROLLS WITH the content - you
   only see the on-screen slice - and draws solid down to the middle of the
   viewport, leaving the part below the middle unfilled. So it's always ~half
   drawn in view, completing only as you reach the footer. Pure CSS scroll-driven
   (animation-timeline: scroll()); JS only measures the geometry on load/resize.
   Desktop only. */

// Build a winding vertical line that fills the given pixel box (1:1 with the viewBox).
const buildPath = (w: number, h: number) => {
  const cx = w / 2;
  const amp = w * 0.34;
  const seg = Math.max(5, Math.round(h / 340)); // a gentle wave roughly every 340px
  let d = `M ${cx} 0`;
  for (let i = 1; i <= seg; i++) {
    const y = (h * i) / seg;
    const py = (h * (i - 1)) / seg;
    const x = cx + (i % 2 ? amp : -amp);
    const px = cx + ((i - 1) % 2 ? amp : -amp);
    const my = (py + y) / 2;
    d += ` C ${px.toFixed(1)} ${my.toFixed(1)} ${x.toFixed(1)} ${my.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }
  return d;
};

const W = 78;
// Where the drawing frontier (the end-point dot) sits down the viewport.
// 0.5 = middle, ~0.85 = lower third (near the bottom), 1 = very bottom edge.
const FRONTIER = 0.80;

const ScrollPath: React.FC<{ isDark: boolean }> = ({ isDark }) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const trackRef = useRef<SVGPathElement>(null);
  const drawRef = useRef<SVGPathElement>(null);
  const dotRef = useRef<SVGCircleElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const svg = svgRef.current;
    const track = trackRef.current;
    const draw = drawRef.current;
    const dot = dotRef.current;
    if (!wrap || !svg || !track || !draw || !dot) return;
    if (!window.matchMedia('(min-width: 1024px)').matches) return;

    let raf = 0;
    const measure = () => {
      const about = document.getElementById('about');
      const footer = document.querySelector('footer');
      if (!about || !footer) { raf = requestAnimationFrame(measure); return; }

      const vh = window.innerHeight;
      // Anchor the line's top to the "About" heading itself (not the section top,
      // which sits above the eyebrow).
      const headingEl = about.querySelector('h2') ?? about;
      const lineTop = headingEl.getBoundingClientRect().top + window.scrollY;
      // End the line so the frontier reaches it exactly when the page is fully
      // scrolled (footer-bottom = page end): the dot lands at the frontier with no
      // leftover pre-path. Uses footer geometry (stable - not affected by this element,
      // unlike scrollHeight which this tall element would inflate in a measure loop).
      const footerBottom = footer.getBoundingClientRect().bottom + window.scrollY;
      const lineBottom = footerBottom - vh * (1 - FRONTIER);
      const lineHeight = Math.max(200, lineBottom - lineTop);

      const d = buildPath(W, lineHeight);
      track.setAttribute('d', d);
      draw.setAttribute('d', d);
      dot.style.offsetPath = `path("${d}")`;
      svg.setAttribute('viewBox', `0 0 ${W} ${lineHeight}`);

      // Anchor the element to the page (scrolls with content).
      wrap.style.top = `${Math.round(lineTop)}px`;
      wrap.style.height = `${Math.round(lineHeight)}px`;

      // Draw frontier sits FRONTIER down the viewport (where the cursor marked):
      // solid above it, unfilled below. 0% drawn when About's top hits that line,
      // 100% when the footer does.
      const front = vh * FRONTIER;
      wrap.style.setProperty('--sp-start', `${Math.round(Math.max(0, lineTop - front))}px`);
      wrap.style.setProperty('--sp-end', `${Math.round(lineBottom - front)}px`);
    };

    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('load', measure);
    const t = window.setTimeout(measure, 600); // re-measure after late layout (fonts/images)

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', measure);
      window.removeEventListener('load', measure);
      clearTimeout(t);
    };
  }, []);

  const accent = isDark ? '#8ea2ff' : '#4f46e5';
  const track = isDark ? 'rgba(142,162,255,0.20)' : 'rgba(79,70,229,0.16)';

  return (
    <div
      ref={wrapRef}
      aria-hidden
      className="scroll-path hidden lg:block"
      style={{
        position: 'absolute',
        right: 'clamp(0.6rem, 1.6vw, 1.9rem)',
        width: W,
        zIndex: 2,
        pointerEvents: 'none',
      }}
    >
      {/* overflow visible so the dot + its glow never get clipped at the path ends */}
      <svg ref={svgRef} width="100%" height="100%" fill="none" preserveAspectRatio="none" style={{ overflow: 'visible' }}>
        {/* faint full pre-path - shows the route the line travels along */}
        <path ref={trackRef} d="" stroke={track} strokeWidth={4} strokeLinecap="round" />
        {/* solid drawn portion - revealed down to the frontier as you scroll */}
        <path ref={drawRef} className="scroll-path__draw" d="" pathLength={100} stroke={accent} strokeWidth={5} strokeLinecap="round" />
        {/* glowing, pulsing dot at the drawing frontier */}
        <circle ref={dotRef} className="scroll-path__dot" r={6} cx={0} cy={0} fill={accent} style={{ filter: `drop-shadow(0 0 6px ${accent})` }} />
      </svg>
    </div>
  );
};

export default ScrollPath;
