import React, { useEffect, useRef, useState } from 'react';
import HangingLamp from './HangingLamp';
import ExploreButton from './ExploreButton';
import HeroPlants from './HeroPlants';
import heroDay from '../assets/hero-desk-day.png';
import heroNight from '../assets/hero-desk-night.png';
import avatarVideo from '../assets/avatar-typing.mp4';

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

  // "Watch me" — play a clip of the avatar over the static desk illustration.
  const [playing, setPlaying] = useState(false);
  const [hovered, setHovered] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const startVideo = () => {
    setPlaying(true);
    setHovered(false);
  };
  const stopVideo = () => {
    setPlaying(false);
    const v = videoRef.current;
    if (v) { v.pause(); v.currentTime = 0; }
  };

  useEffect(() => {
    if (playing) videoRef.current?.play().catch(() => {});
  }, [playing]);

  return (
    <section
      className="relative w-full min-h-screen overflow-hidden"
      style={{ zIndex: 0 }}
    >
      {/* Decorative plants — behind the hero illustration; hidden while the
          video plays so focus stays on the clip */}
      <div
        aria-hidden={playing}
        style={{
          opacity: playing ? 0 : 1,
          transition: 'opacity 0.45s ease',
          pointerEvents: playing ? 'none' : undefined,
        }}
      >
        <HeroPlants isDark={isDark} />
      </div>

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

      {/* Avatar video — plays over both light/dark desk illustrations */}
      <video
        ref={videoRef}
        src={avatarVideo}
        playsInline
        muted
        loop
        draggable={false}
        onEnded={stopVideo}
        className="absolute inset-0 w-full h-full object-contain object-bottom select-none pointer-events-none"
        style={{
          opacity: playing ? fade : 0,
          zIndex: 3,
          transition: 'opacity 0.45s ease',
        }}
      />

      {/* Play button ("Watch me") — shown when the clip isn't playing */}
      {fade > 0.05 && !playing && (
        <button
          type="button"
          aria-label="Watch Me Build & Solve"
          onClick={startVideo}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          className="absolute left-20 top-6 sm:left-28 sm:top-8 z-10
            flex items-center justify-center w-9 h-9
            transition-transform duration-300 hover:scale-110
            focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
          style={{ opacity: fade }}
        >
          {/* Play triangle */}
          <svg width="38" height="38" viewBox="0 0 24 24" aria-hidden="true" style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.45))' }}>
            <path
              d="M7 5.5v13l11-6.5L7 5.5z"
              fill={isDark ? '#f3f4f6' : '#1f2937'}
              stroke={isDark ? '#f3f4f6' : '#1f2937'}
              strokeWidth="2.4"
              strokeLinejoin="round"
            />
          </svg>

          {/* Tooltip */}
          {hovered && (
            <span className="absolute left-full top-1/2 -translate-y-1/2 ml-3 pointer-events-none whitespace-nowrap">
              <span className={`absolute top-1/2 -left-1 -translate-y-1/2 w-2 h-2 rotate-45 ${
                isDark ? 'bg-gray-800 border-l border-b border-gray-600/70' : 'bg-white border-l border-b border-gray-200'
              }`} />
              <span className={`block px-3 py-1.5 rounded-lg text-xs font-medium shadow-lg ${
                isDark
                  ? 'bg-gray-800 text-gray-100 border border-gray-600/70'
                  : 'bg-white text-gray-700 border border-gray-200 shadow-md'
              }`}>
                Watch Me Build & Solve
              </span>
            </span>
          )}
        </button>
      )}

      {/* Square button — return to the current layout while the clip plays */}
      {playing && (
        <button
          type="button"
          aria-label="Back to layout"
          onClick={stopVideo}
          className="absolute left-20 top-6 sm:left-28 sm:top-8 z-10
            flex items-center justify-center w-9 h-9
            transition-transform duration-300 hover:scale-110
            focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
        >
          {/* Stop square */}
          <span className="w-[26px] h-[26px] rounded-sm" style={{ background: isDark ? '#f3f4f6' : '#1f2937', filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.45))' }} />
        </button>
      )}

      {/* Explore button — at bottom of hero section to scroll into portfolio */}
      {fade > 0.05 && (
        <div
          className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 pointer-events-auto"
          style={{ opacity: fade }}
        >
          <ExploreButton
            isDark={isDark}
            onClick={() => {
              window.scrollTo({
                top: window.innerHeight,
                behavior: 'smooth',
              });
            }}
          />
        </div>
      )}

      {/* HangingLamp — fixed position, theme toggle; fades out past the hero */}
      <HangingLamp isDark={isDark} onThemeChange={onThemeChange} isVisible={lampVisible} />
    </section>
  );
};

export default HeroSection;
