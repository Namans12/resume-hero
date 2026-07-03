import React, { useEffect, useRef, useState } from 'react';
import HangingLamp from './HangingLamp';
import ExploreButton from './ExploreButton';
import HeroPlants from './HeroPlants';
import heroDay from '../assets/hero-desk-day.webp';
import heroNight from '../assets/hero-desk-night.webp';
import avatarVideo from '../assets/avatar-typing.mp4';

// The clip plays through while scrolling - the static desk image is hidden during
// playback, so the two avatar layers never overlap (which was the ghosting cause).
// Flip to true to instead stop the clip on scroll, if a device ever shows smear.
const STOP_VIDEO_ON_SCROLL = false;

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
  // fades out on top - so the character area is always fully covered.
  const dayActive = !isDark;
  const nightActive = isDark;

  // "Watch me" - play a clip of the avatar over the static desk illustration.
  const SHOW_WATCH_BUTTON = true;
  // Shared position for the play/stop control - open dotted area, right of the head.
  const watchBtnPos: React.CSSProperties = { left: '10%', top: '30%' };
  const [playing, setPlaying] = useState(false);
  // The clip loads with preload="none", so on click it has no decoded frame yet.
  // We keep the static desk on screen until `videoReady` (the video's first frame
  // is actually painting) and only then swap - the two show the same scene, so the
  // hand-off is invisible instead of flashing an empty/black video box.
  const [videoReady, setVideoReady] = useState(false);
  // Start fetching the clip on hover so the first frame is usually ready by click.
  const [warm, setWarm] = useState(false);
  const [hovered, setHovered] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const warmVideo = () => {
    setWarm(true);
    // Kick off buffering now; harmless if already loading.
    videoRef.current?.load();
  };
  const startVideo = () => {
    setPlaying(true);
    setHovered(false);
  };
  const stopVideo = () => {
    setPlaying(false);
    setVideoReady(false);
    const v = videoRef.current;
    if (v) { v.pause(); v.currentTime = 0; }
  };

  useEffect(() => {
    if (playing) videoRef.current?.play().catch(() => setPlaying(false));
  }, [playing]);

  // Stop the clip as soon as the visitor scrolls away from the hero - a playing
  // video composited during scroll smears/ghosts.
  useEffect(() => {
    if (!STOP_VIDEO_ON_SCROLL || !playing) return;
    const stopOnScroll = () => {
      if (window.scrollY > 0) {
        setPlaying(false);
        const v = videoRef.current;
        if (v) { v.pause(); v.currentTime = 0; }
      }
    };
    window.addEventListener('scroll', stopOnScroll, { passive: true });
    return () => window.removeEventListener('scroll', stopOnScroll);
  }, [playing]);

  return (
    <section
      className="relative w-full min-h-screen overflow-hidden"
      style={{ zIndex: 0 }}
    >
      {/* Decorative plants - behind the hero illustration; hidden while the
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

      {/* Full-page illustration - object-contain, no cropping */}
      <img
        src={heroDay}
        alt=""
        aria-hidden="true"
        draggable={false}
        className="absolute inset-x-0 bottom-0 w-full h-[58vh] object-cover object-center lg:inset-0 lg:h-full lg:object-contain lg:object-bottom select-none pointer-events-none"
        style={{
          opacity: dayActive && !videoReady ? fade : 0,
          zIndex: dayActive ? 1 : 2,
          transition: dayActive ? 'none' : 'opacity 0.65s ease',
        }}
      />
      <img
        src={heroNight}
        alt="Developer at desk"
        draggable={false}
        className="absolute inset-x-0 bottom-0 w-full h-[58vh] object-cover object-center lg:inset-0 lg:h-full lg:object-contain lg:object-bottom select-none pointer-events-none"
        style={{
          opacity: nightActive && !videoReady ? fade : 0,
          zIndex: nightActive ? 1 : 2,
          transition: nightActive ? 'none' : 'opacity 0.65s ease',
        }}
      />

      {/* Avatar video - plays the clip once, then onEnded returns to the static desk */}
      <video
        ref={videoRef}
        src={avatarVideo}
        playsInline
        muted
        // Warmed to "auto" on hover so the first frame is usually decoded by click.
        preload={warm ? 'auto' : 'none'}
        poster={heroNight}
        draggable={false}
        // Reveal only once real frames are flowing - avoids the empty-video flash.
        onPlaying={() => setVideoReady(true)}
        onEnded={stopVideo}
        onError={stopVideo}
        className="absolute inset-x-0 bottom-0 w-full h-[58vh] object-cover object-center lg:inset-0 lg:h-full lg:object-contain lg:object-bottom select-none pointer-events-none"
        style={{
          opacity: videoReady ? fade : 0,
          zIndex: 3,
          // Held hidden until the first frame paints, then snapped in over the
          // matching static desk so the two avatar layers never overlap; own GPU
          // layer so the moving clip composites cleanly while the page scrolls.
          transition: 'none',
          transform: 'translateZ(0)',
          backfaceVisibility: 'hidden',
          willChange: 'transform, opacity',
        }}
      />

      {/* Hero intro - name + tagline, top-left; fades out on scroll and
          hides while the avatar clip is playing */}
      <div
        className="absolute z-10 pointer-events-none select-none"
        style={{
          left: 'clamp(3rem, 8.2vw, 9rem)',
          top: 'clamp(1.5rem, 5.3vh, 6rem)',
          opacity: playing ? 0 : fade,
          transition: 'opacity 0.45s ease',
        }}
      >
        <p
          style={{
            fontFamily: '"Manrope", sans-serif',
            fontWeight: 700,
            fontSize: 'clamp(0.76rem, 1.6vw, 1rem)',
            letterSpacing: '0.24em',
            textTransform: 'uppercase',
            color: isDark ? '#8ea2ff' : '#4f46e5',
            margin: 0,
          }}
        >
          Hi, I&apos;m
        </p>
        <h1
          style={{
            fontFamily: '"Manrope", sans-serif',
            fontWeight: 800,
            fontSize: 'clamp(2.05rem, 5.3vw, 3.7rem)',
            lineHeight: 1.05,
            letterSpacing: '-0.015em',
            // Pull the large "N" left ~3px so its stroke optically aligns with
            // the kicker/tagline (whose glyphs have a smaller side-bearing).
            textIndent: '-0.05em',
            whiteSpace: 'nowrap',
            color: isDark ? '#f3f4f6' : '#111827',
            margin: '0.4rem 0 0',
            textShadow: isDark ? '0 2px 24px rgba(0,0,0,0.45)' : '0 2px 24px rgba(255,255,255,0.55)',
          }}
        >
          Naman Shrimal
        </h1>
        <p
          style={{
            fontFamily: '"Manrope", sans-serif',
            fontWeight: 500,
            fontSize: 'clamp(0.88rem, 1.65vw, 1.18rem)',
            lineHeight: 1.4,
            whiteSpace: 'nowrap',
            color: isDark ? 'rgba(243,244,246,0.7)' : 'rgba(17,24,39,0.72)',
            margin: '0.7rem 0 0',
            textShadow: isDark ? '0 1px 16px rgba(0,0,0,0.55)' : '0 1px 16px rgba(255,255,255,0.75)',
          }}
        >
          I turn messy data into intelligent products.
        </p>
      </div>

      {/* Play button ("Watch me") - shown when the clip isn't playing */}
      {SHOW_WATCH_BUTTON && fade > 0.05 && !playing && (
        <button
          type="button"
          aria-label="Watch Me Build & Solve"
          onClick={startVideo}
          onMouseEnter={() => { setHovered(true); warmVideo(); }}
          onMouseLeave={() => setHovered(false)}
          onFocus={warmVideo}
          className="absolute z-10
            flex items-center justify-center w-9 h-9
            transition-transform duration-300 hover:scale-110
            focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
          style={{ ...watchBtnPos, opacity: fade }}
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

      {/* Explore button - at bottom of hero section to scroll into portfolio */}
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

      {/* HangingLamp - fixed position, theme toggle; fades out past the hero */}
      <HangingLamp isDark={isDark} onThemeChange={onThemeChange} isVisible={lampVisible} />
    </section>
  );
};

export default HeroSection;
