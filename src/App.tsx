import { useState, useEffect, lazy, Suspense } from 'react';
import HeroSection from './components/HeroSection';
import DottedBackground from './components/DottedBackground';
import StarBackground from './components/StarBackground';
import ThemeToggleBar from './components/ThemeToggleBar';
import BackToTopRocket from './components/BackToTopRocket';

// Below-the-fold; code-split so GSAP + the portfolio load after the hero paints.
const PortfolioSection = lazy(() => import('./components/PortfolioSection'));

function App() {
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  const [heroActive, setHeroActive] = useState(true);

  // 0 = hero fully visible, 1 = fully scrolled past hero
  const [starsOpacity, setStarsOpacity] = useState(0);

  // Dotted background fades out quickly so it doesn't show through the
  // fading hero illustration during the scroll transition.
  const [dotsOpacity, setDotsOpacity] = useState(1);

  useEffect(() => {
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
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
      </div>
      <BackToTopRocket isDark={isDark} />
    </>
  );
}

export default App;
