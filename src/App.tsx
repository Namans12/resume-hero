import { useState, useEffect } from 'react';
import HeroSection from './components/HeroSection';
import PortfolioSection from './components/PortfolioSection';
import DottedBackground from './components/DottedBackground';

function App() {
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  // The hanging lamp belongs to the hero scene — fade it out once scrolled past.
  const [heroActive, setHeroActive] = useState(true);

  useEffect(() => {
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        setHeroActive(window.scrollY < window.innerHeight * 0.35);
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { window.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf); };
  }, []);

  const toggleTheme = () => setIsDark(prev => !prev);

  return (
    <div style={{ backgroundColor: isDark ? '#0b0b0f' : '#ffffff', transition: 'background-color 0.65s ease' }}>
      <DottedBackground isDark={isDark} />
      <HeroSection isDark={isDark} onThemeChange={toggleTheme} lampVisible={heroActive} />
      <PortfolioSection isDark={isDark} />
    </div>
  );
}

export default App;
