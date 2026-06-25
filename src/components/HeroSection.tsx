import React from 'react';
import HangingLamp from './HangingLamp';
import heroDay from '../assets/hero-desk-day.png';
import heroNight from '../assets/hero-desk-night.png';

interface HeroSectionProps {
  isDark: boolean;
  onThemeChange: () => void;
}

const HeroSection: React.FC<HeroSectionProps> = ({ isDark, onThemeChange }) => {
  return (
    <section
      className="relative w-full min-h-screen overflow-hidden"
      style={{
        backgroundColor: isDark ? '#0b0b0f' : '#ffffff',
        transition: 'background-color 0.65s ease',
      }}
    >
      {/* Full-page illustration — object-contain, no cropping */}
      <img
        src={heroDay}
        alt=""
        aria-hidden="true"
        draggable={false}
        className="absolute inset-0 w-full h-full object-contain object-bottom select-none pointer-events-none"
        style={{ opacity: isDark ? 0 : 1, transition: 'opacity 0.65s ease' }}
      />
      <img
        src={heroNight}
        alt="Developer at desk"
        draggable={false}
        className="absolute inset-0 w-full h-full object-contain object-bottom select-none pointer-events-none"
        style={{ opacity: isDark ? 1 : 0, transition: 'opacity 0.65s ease' }}
      />

      {/* HangingLamp — fixed position, theme toggle */}
      <HangingLamp isDark={isDark} onThemeChange={onThemeChange} isVisible />
    </section>
  );
};

export default HeroSection;
