import React, { useRef } from 'react';

interface ScrollToExploreProps {
  isDark: boolean;
  label?: string;
  /** Element id to smooth-scroll to when clicked. */
  targetId?: string;
}

/**
 * Oversized "SCROLL TO EXPLORE" wordmark, Duten-style: the letters are filled
 * with a flowing matte-metallic gradient and a brighter gleam follows the
 * cursor. Clicking (or scrolling) carries the visitor into the portfolio.
 */
const ScrollToExplore: React.FC<ScrollToExploreProps> = ({
  isDark,
  label = 'SCROLL TO EXPLORE',
  targetId = 'portfolio',
}) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const gleamRef = useRef<HTMLSpanElement>(null);

  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = wrapRef.current;
    const g = gleamRef.current;
    if (!el || !g) return;
    const rect = el.getBoundingClientRect();
    g.style.setProperty('--mx', `${e.clientX - rect.left}px`);
    g.style.setProperty('--my', `${e.clientY - rect.top}px`);
    g.style.opacity = '1';
  };

  const handleLeave = () => {
    if (gleamRef.current) gleamRef.current.style.opacity = '0';
  };

  const goToPortfolio = () => {
    document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Matte-metallic fill (Duten "matte black"): charcoal with a brushed sheen.
  // Dark mode lifts to brushed-silver so it stays legible on the dark backdrop.
  const baseGradient = isDark
    ? 'linear-gradient(105deg,#5a5d63,#101114,#9aa0a8,#1a1c1f,#c9ced6,#26282c,#5a5d63)'
    : 'linear-gradient(105deg,#3a3a3d,#0a0a0c,#5a5b60,#141416,#7d7f86,#1c1c1f,#3a3a3d)';
  // Bright gleam revealed under the cursor.
  const gleamGradient =
    'linear-gradient(105deg,#ffffff,#c9ced6,#ffffff,#9aa0a8,#ffffff)';

  const textClasses = 'font-semibold uppercase tracking-[0.16em] whitespace-nowrap block';
  const sizeStyle: React.CSSProperties = {
    fontSize: 'clamp(2rem, 7vw, 14rem)',
    fontFamily: '"Manrope", ui-sans-serif, system-ui, sans-serif',
    lineHeight: 0.95,
  };

  return (
    <div className="flex flex-col items-center">
      <div
        ref={wrapRef}
        onMouseMove={handleMove}
        onMouseLeave={handleLeave}
        onClick={goToPortfolio}
        role="link"
        tabIndex={0}
        aria-label="Scroll to explore portfolio"
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); goToPortfolio(); }
        }}
        className="group relative inline-flex cursor-pointer select-none
          focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 rounded-xl"
      >
        <div className="relative">
          {/* Base — flowing matte-metallic fill, always visible */}
          <span
            className={textClasses}
            style={{
              ...sizeStyle,
              backgroundImage: baseGradient,
              backgroundSize: '220% 100%',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              color: 'transparent',
              animation: 'gradientFlow 7s linear infinite',
              transition: 'filter 0.4s ease',
            }}
          >
            {label}
          </span>

          {/* Gleam — brighter shine that follows the cursor */}
          <span
            ref={gleamRef}
            aria-hidden="true"
            className={`absolute inset-0 pointer-events-none ${textClasses}`}
            style={{
              ...sizeStyle,
              opacity: 0,
              transition: 'opacity 0.35s ease',
              backgroundImage: gleamGradient,
              backgroundSize: '220% 100%',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              color: 'transparent',
              animation: 'gradientFlow 4s linear infinite',
              filter: 'drop-shadow(0 0 14px rgba(255,255,255,0.35))',
              WebkitMaskImage:
                'radial-gradient(circle 170px at var(--mx, -300px) var(--my, -300px), #000 0%, rgba(0,0,0,0.45) 58%, transparent 80%)',
              maskImage:
                'radial-gradient(circle 170px at var(--mx, -300px) var(--my, -300px), #000 0%, rgba(0,0,0,0.45) 58%, transparent 80%)',
            }}
          >
            {label}
          </span>
        </div>
      </div>

      {/* Animated scroll indicator */}
      <button
        type="button"
        onClick={goToPortfolio}
        aria-label="Scroll down"
        className="mt-5 sm:mt-7 flex flex-col items-center gap-1 group/ind cursor-pointer
          focus:outline-none"
      >
        <span
          className="h-9 w-[22px] rounded-full border-2 flex items-start justify-center p-1
            transition-colors duration-300"
          style={{ borderColor: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(17,24,39,0.4)' }}
        >
          <span
            className="block w-1 h-2 rounded-full"
            style={{
              background: isDark ? 'rgba(255,255,255,0.8)' : 'rgba(17,24,39,0.7)',
              animation: 'scrollWheel 1.5s ease-in-out infinite',
            }}
          />
        </span>
        <svg
          width="18" height="18" viewBox="0 0 24 24" fill="none"
          className="animate-bounce"
          style={{ color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(17,24,39,0.5)' }}
        >
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
};

export default ScrollToExplore;
