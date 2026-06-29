import { useEffect, useRef } from 'react';

/* A thick, complex line fixed to the right that draws as you scroll - from the
   About section to just above the footer - with a glowing dot riding the leading
   edge (via offset-path). The draw, dot and fade are PURE CSS scroll-driven
   animations (animation-timeline: scroll()), so there's no per-frame JS - it
   runs on the compositor. JS only measures the scroll range + path length once.
   Desktop only; progressively enhanced (hidden where scroll timelines aren't supported). */

// A deliberate flowing vertical curve - three smooth S-swings (viewBox 0 0 100 1000).
const PATH_D =
  'M 50 8 C 96 120 10 232 50 360 C 90 484 12 596 50 720 C 84 812 20 900 50 992';

const ScrollPath: React.FC<{ isDark: boolean }> = ({ isDark }) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<SVGCircleElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const dot = dotRef.current;
    if (!wrap || !dot) return;
    if (!window.matchMedia('(min-width: 1024px)').matches) return;

    // The dot's motion path - set once.
    dot.style.offsetPath = `path("${PATH_D}")`;

    // Map the scroll-driven range to About -> just-above-footer. Runs only on
    // load/resize (no per-scroll JS); the animation itself is pure CSS.
    let raf = 0;
    const setRange = () => {
      const about = document.getElementById('about');
      const footer = document.querySelector('footer');
      if (!about || !footer) { raf = requestAnimationFrame(setRange); return; }
      const vh = window.innerHeight;
      const start = Math.max(0, about.getBoundingClientRect().top + window.scrollY - vh * 0.85);
      const end = footer.getBoundingClientRect().top + window.scrollY - vh;
      wrap.style.setProperty('--sp-start', `${Math.round(start)}px`);
      wrap.style.setProperty('--sp-end', `${Math.round(Math.max(start + 1, end))}px`);
    };
    setRange();
    window.addEventListener('resize', setRange);
    window.addEventListener('load', setRange);
    const t = window.setTimeout(setRange, 600); // re-measure after late layout (fonts/images)

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', setRange);
      window.removeEventListener('load', setRange);
      clearTimeout(t);
    };
  }, []);

  const accent = isDark ? '#8ea2ff' : '#4f46e5';
  const track = isDark ? 'rgba(142,162,255,0.16)' : 'rgba(79,70,229,0.13)';

  return (
    <div
      ref={wrapRef}
      aria-hidden
      className="scroll-path hidden lg:block"
      style={{
        position: 'fixed',
        right: 'clamp(0.6rem, 1.6vw, 1.9rem)',
        top: 'clamp(7rem, 13vh, 9rem)',        // clears the theme toggle bar (top-right)
        bottom: 'clamp(7.5rem, 14vh, 9.5rem)', // clears the back-to-top rocket (bottom-right)
        width: 78,
        zIndex: 30,
        pointerEvents: 'none',
      }}
    >
      <svg width="100%" height="100%" viewBox="0 0 100 1000" fill="none" preserveAspectRatio="xMidYMid meet">
        {/* faint full track - shows the complex shape */}
        <path d={PATH_D} stroke={track} strokeWidth={6} strokeLinecap="round" />
        {/* thick drawn portion - revealed by the scroll-driven dashoffset */}
        <path className="scroll-path__draw" d={PATH_D} stroke={accent} strokeWidth={8} strokeLinecap="round" />
        {/* glowing, pulsing dot - rides the path via offset-path + scroll-driven offset-distance */}
        <circle ref={dotRef} className="scroll-path__dot" r={7} cx={0} cy={0} fill={accent} style={{ filter: `drop-shadow(0 0 7px ${accent})` }} />
      </svg>
    </div>
  );
};

export default ScrollPath;
