import { useState, useEffect, lazy, Suspense } from 'react';
import HeroSection from './components/HeroSection';
import DottedBackground from './components/DottedBackground';
import StarBackground from './components/StarBackground';
import ThemeToggleBar from './components/ThemeToggleBar';
import BackToTopRocket from './components/BackToTopRocket';
import CustomCursor from './components/CustomCursor';
// Below-the-fold; code-split so GSAP + the portfolio load after the hero paints.
const PortfolioSection = lazy(() => import('./components/PortfolioSection'));
// Also code-split: it carries the seven ordered section illustrations
// and only becomes visible from the About section down.
const ScrollPath = lazy(() => import('./components/ScrollPath'));

/* localStorage throws outright in some privacy modes / blocked-cookie contexts.
   Reading it inside a useState initializer meant that threw during render and
   took the whole app down, so both accesses are guarded. */
const readTheme = (): boolean => {
  try {
    const saved = localStorage.getItem('theme');
    // Default to dark mode; only honor a returning visitor's explicit choice.
    return saved ? saved === 'dark' : true;
  } catch {
    return true;
  }
};
const writeTheme = (isDark: boolean) => {
  try {
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  } catch { /* non-persistent session - the in-memory choice still applies */ }
};

/* ── Scroll-driven fades ──────────────────────────────────────────────
   These three values change every scroll frame. Routing them through
   React state re-rendered the ENTIRE tree (PortfolioSection's ~dozens of
   framer-motion nodes included) once per frame, and churned every inline
   ref callback along with it. They're published as CSS custom properties
   on <html> instead: the compositor reads them directly, React never
   re-renders, and the only state left is the two BOOLEAN thresholds below
   (which flip once each per hero traversal).

   --sp-stars 0→1  star sky fading in / app background fading out
   --sp-dots  1→0  dotted texture fading out
   --sp-hero  1→0  hero illustration + intro copy fading out           */
const HERO_CONTROLS_CUTOFF = 0.05;

function App() {
  const [isDark, setIsDark] = useState(readTheme);

  // Lamp hangs while the hero owns the viewport.
  const [heroActive, setHeroActive] = useState(true);
  // Play / Explore buttons unmount once the hero has essentially faded out;
  // the theme toggle becomes clickable at the same time the stars arrive.
  const [heroControls, setHeroControls] = useState(true);
  const [toggleLive, setToggleLive] = useState(false);

  useEffect(() => {
    writeTheme(isDark);
    // The hero→stars hand-off crossfades two semi-transparent layers (wrapper
    // background out, StarBackground in), so mid-scroll neither fully covers
    // the page canvas. The body must match the theme or the browser-default
    // white bleeds through as a pale wash during the transition.
    document.body.style.backgroundColor = isDark ? '#0b0b0f' : '#ffffff';
  }, [isDark]);

  useEffect(() => {
    const root = document.documentElement;
    let raf = 0;

    const apply = () => {
      const vh = window.innerHeight;
      const sy = window.scrollY;
      // Stars fade in between 40%-90% of viewport scroll
      const stars = Math.max(0, Math.min(1, (sy - vh * 0.4) / (vh * 0.5)));
      // Dots fade out smoothly (eased) over the first ~60% of scroll
      const td = Math.max(0, Math.min(1, sy / (vh * 0.6)));
      const dots = 1 - td * td * (3 - 2 * td); // smoothstep - gentle start & finish
      // Hero illustration fades over the first 75% of a viewport
      const hero = Math.max(0, Math.min(1, 1 - sy / (vh * 0.75)));

      root.style.setProperty('--sp-stars', String(stars));
      root.style.setProperty('--sp-dots', String(dots));
      root.style.setProperty('--sp-hero', String(hero));

      // Threshold flips only - these are the sole per-scroll re-renders.
      setHeroActive(sy < vh * 0.35);
      setHeroControls(hero > HERO_CONTROLS_CUTOFF);
      setToggleLive(stars > 0.45);
    };

    // Synchronously for the first paint (a restored scroll position must not
    // spend a frame showing the un-faded hero); rAF-throttled thereafter.
    apply();
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(apply);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    if (import.meta.env.DEV) {
      (window as unknown as Record<string, unknown>).__spScroll = apply;
    }
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); cancelAnimationFrame(raf); };
  }, []);

  const toggleTheme = () => setIsDark(prev => !prev);

  return (
    <>
      <StarBackground isDark={isDark} active={!heroActive} />
      {/* Toggle bar fades in as the star background takes over */}
      <ThemeToggleBar isDark={isDark} onThemeChange={toggleTheme} interactive={toggleLive} />
      <div
        style={{
          position: 'relative',
          // App background fades opaque → transparent to reveal the stars beneath.
          // Space-separated rgb() takes a var() alpha, so the whole crossfade is
          // one compositor-side calc off --sp-stars.
          ['--sp-bg-rgb' as string]: isDark ? '11 11 15' : '255 255 255',
          backgroundColor: 'rgb(var(--sp-bg-rgb) / calc(1 - var(--sp-stars, 0)))',
        }}
      >
        <DottedBackground isDark={isDark} />
        <HeroSection
          isDark={isDark}
          onThemeChange={toggleTheme}
          lampVisible={heroActive}
          controlsVisible={heroControls}
        />
        <Suspense fallback={null}>
          <PortfolioSection isDark={isDark} />
        </Suspense>
        <Suspense fallback={null}>
          <ScrollPath isDark={isDark} />
        </Suspense>
      </div>
      <BackToTopRocket isDark={isDark} />
      <CustomCursor />
    </>
  );
}

export default App;
