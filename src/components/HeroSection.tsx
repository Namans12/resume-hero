import React, { useEffect, useState } from 'react';
import HangingLamp from './HangingLamp';
import heroDay from '../assets/hero-desk-day.png';
import heroNight from '../assets/hero-desk-night.png';

interface HeroSectionProps {
  isDark: boolean;
  onThemeChange: () => void;
  lampVisible?: boolean;
}

const HeroSection: React.FC<HeroSectionProps> = ({ isDark, onThemeChange, lampVisible = true }) => {
  // Fade the avatar/desk illustration out as the visitor scrolls down.
  const [fade, setFade] = useState(1);
  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const progress = window.scrollY / (window.innerHeight * 0.75);
        setFade(Math.max(0, Math.min(1, 1 - progress)));
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { window.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf); };
  }, []);

  // Cross-fade without revealing the dotted background: the incoming image sits
  // underneath at full opacity (snaps in, no transition) while the outgoing one
  // fades out on top — so the character area is always fully covered.
  const dayActive = !isDark;
  const nightActive = isDark;

  return (
    <section
      className="relative w-full min-h-screen overflow-hidden"
      style={{ zIndex: 0 }}
    >
      {/* Full-page illustration — object-contain, no cropping */}
      <img
        src={heroDay}
        alt=""
        aria-hidden="true"
        draggable={false}
        className="absolute inset-0 w-full h-full object-contain object-bottom select-none pointer-events-none"
        style={{
          opacity: dayActive ? fade : 0,
          zIndex: dayActive ? 1 : 2,
          transition: dayActive ? 'none' : 'opacity 0.65s ease',
        }}
      />
      <img
        src={heroNight}
        alt="Developer at desk"
        draggable={false}
        className="absolute inset-0 w-full h-full object-contain object-bottom select-none pointer-events-none"
        style={{
          opacity: nightActive ? fade : 0,
          zIndex: nightActive ? 1 : 2,
          transition: nightActive ? 'none' : 'opacity 0.65s ease',
        }}
      />

      {/* HangingLamp — fixed position, theme toggle; fades out past the hero */}
      <HangingLamp isDark={isDark} onThemeChange={onThemeChange} isVisible={lampVisible} />
    </section>
  );
};

export default HeroSection;
