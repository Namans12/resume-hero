import { useState, useEffect, lazy, Suspense } from 'react';
import HeroSection from './components/HeroSection';
import DottedBackground from './components/DottedBackground';
import StarBackground from './components/StarBackground';
import ThemeToggleBar from './components/ThemeToggleBar';
import BackToTopRocket from './components/BackToTopRocket';
import CustomCursor from './components/CustomCursor';
// Below-the-fold; code-split so GSAP + the portfolio load after the hero paints.
const PortfolioSection = lazy(() => import('./components/PortfolioSection'));
// Also code-split: it carries the two embedded artworks (~30KB of path data)
// and only becomes visible from the About section down.
const ScrollPath = lazy(() => import('./components/ScrollPath'));

function App() {
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('theme');
    // Default to dark mode; only honor a returning visitor's explicit choice.
    return saved ? saved === 'dark' : true;
  });

  const [heroActive, setHeroActive] = useState(true);

  // 0 = hero fully visible, 1 = fully scrolled past hero
  const [starsOpacity, setStarsOpacity] = useState(0);

  // Dotted background fades out quickly so it doesn't show through the
  // fading hero illustration during the scroll transition.
  const [dotsOpacity, setDotsOpacity] = useState(1);

  useEffect(() => {
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    // The hero→stars hand-off crossfades two semi-transparent layers (wrapper
    // background out, StarBackground in), so mid-scroll neither fully covers
    // the page canvas. The body must match the theme or the browser-default
    // white bleeds through as a pale wash during the transition.
    document.body.style.backgroundColor = isDark ? '#0b0b0f' : '#ffffff';
  }, [isDark]);

  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const vh = window.innerHeight;
        const sy = window.scrollY;
        setHeroActive(sy < vh * 0.35);
        // Stars fade in between 40%–90% of viewport scroll
        const p = (sy - vh * 0.4) / (vh * 0.5);
        setStarsOpacity(Math.max(0, Math.min(1, p)));
        // Dots fade out smoothly (eased) over the first ~60% of scroll
        const td = Math.max(0, Math.min(1, sy / (vh * 0.6)));
        const dEased = td * td * (3 - 2 * td); // smoothstep - gentle start & finish
        setDotsOpacity(1 - dEased);
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { window.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf); };
  }, []);

  const toggleTheme = () => setIsDark(prev => !prev);

  // App background fades from opaque → transparent to reveal star background beneath
  const bgRgb = isDark ? '11,11,15' : '255,255,255';
  const bgColor = `rgba(${bgRgb},${1 - starsOpacity})`;

  return (
    <>
      <StarBackground opacity={starsOpacity} isDark={isDark} />
      {/* Toggle bar fades in as the star background takes over */}
      <ThemeToggleBar isDark={isDark} onThemeChange={toggleTheme} opacity={starsOpacity} />
      <div style={{ position: 'relative', backgroundColor: bgColor, transition: 'background-color 0.65s ease' }}>
        <DottedBackground isDark={isDark} opacity={dotsOpacity} />
        <HeroSection isDark={isDark} onThemeChange={toggleTheme} lampVisible={heroActive} />
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
