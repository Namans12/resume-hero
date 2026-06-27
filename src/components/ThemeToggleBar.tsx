import React from 'react';

const MOON_BG = 'url("https://res.cloudinary.com/dipad09ui/image/upload/q_auto/f_auto/v1781442808/moon_pmihqh.jpg")';
const SUN_BG  = 'url("https://res.cloudinary.com/dipad09ui/image/upload/q_auto/f_auto/v1781442808/sun_jypuii.png")';

const NOISE = "url(\"data:image/svg+xml,<svg viewBox='0 0 300 300' xmlns='http://www.w3.org/2000/svg'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='5' numOctaves='2' /></filter><rect width='300' height='300' filter='url(%23n)' opacity='0.4'/></svg>\")";

interface ThemeToggleBarProps {
  isDark: boolean;
  onThemeChange: () => void;
  /** 0–1 scroll progress — drives both opacity and slide-in */
  opacity: number;
}

const ThemeToggleBar: React.FC<ThemeToggleBarProps> = ({ isDark, onThemeChange, opacity }) => {
  const slideY = (1 - opacity) * 20; // 20px above when hidden → 0 when fully visible

  return (
    /* Outer: fixed position + scale — no animation here */
    <div
      style={{
        position: 'fixed',
        top: '1.5rem',
        right: 'clamp(0.75rem, 2.5vw, 3.5rem)',
        zIndex: 50,
        transform: 'scale(0.46)',
        transformOrigin: 'top right',
        pointerEvents: opacity > 0.45 ? 'auto' : 'none',
      }}
    >
      {/* Inner: scroll-driven fade + slide */}
      <div
        style={{
          opacity,
          transform: `translateY(-${slideY}px)`,
          transition: 'opacity 0.3s ease, transform 0.3s ease',
        }}
      >
        {/* Pill */}
        <div
          onClick={onThemeChange}
          role="button"
          tabIndex={0}
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onThemeChange(); } }}
          style={{
            position: 'relative',
            width: '16rem',
            height: '7rem',
            borderRadius: '3.5rem',
            overflow: 'hidden',
            cursor: 'pointer',
            backgroundImage: isDark ? MOON_BG : SUN_BG,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            boxShadow: isDark
              ? 'inset 0 0 7rem 7rem rgba(0,0,0,0.3),inset 0 0.8rem 0.4rem rgba(0,0,0,0.3),inset 0 3rem 1rem rgba(0,0,0,0.25),0 -0.25em 0.25em rgba(0,0,0,0.2),0 0.25em 0.25em rgba(255,255,255,0.08)'
              : 'inset 0 0 7rem 7rem rgba(0,0,0,0.1),inset 0 0.8rem 0.4rem rgba(0,0,0,0.2),inset 0 3rem 1rem rgba(0,0,0,0.1),0 -0.25em 0.25em rgba(0,0,0,0.15),0 0.25em 0.25em rgba(255,255,255,0.4)',
            transition: 'box-shadow 300ms ease',
          }}
        >
          {/* Noise overlay */}
          <div style={{ position: 'absolute', inset: 0, backgroundImage: NOISE, opacity: 0.4, pointerEvents: 'none' }} />

          {/* Knob shadow */}
          <div
            style={{
              position: 'absolute',
              top: '1.1rem',
              left: isDark ? '10.7rem' : '0.8rem',
              width: '4.5rem',
              height: '4.5rem',
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.1)',
              transition: 'left 300ms ease',
              pointerEvents: 'none',
            }}
          />

          {/* Knob */}
          <div
            style={{
              position: 'absolute',
              zIndex: 5,
              top: '1.1rem',
              left: isDark ? '10.7rem' : '0.8rem',
              width: '4.5rem',
              height: '4.5rem',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: isDark ? '#2b3445' : '#d0cbc3',
              boxShadow: isDark
                ? 'inset 0 0.25rem 0.25rem rgba(255,255,255,0.08),inset 0 -0.25rem 0.25rem rgba(0,0,0,0.2),0 0.6rem 0.4rem rgba(0,0,0,0.5),0 1.25rem 1rem rgba(0,0,0,0.5)'
                : 'inset 0 0.25rem 0.25rem rgba(255,255,255,0.4),inset 0 -0.25rem 0.25rem rgba(0,0,0,0.15),0 0.6rem 0.4rem rgba(0,0,0,0.25),0 1.25rem 1rem rgba(0,0,0,0.25)',
              transition: 'left 300ms ease, background-color 300ms ease, box-shadow 300ms ease',
            }}
          >
            {/* Sun icon — visible in dark mode */}
            <svg
              viewBox="0 0 24 24"
              fill="#c8d8f0"
              aria-hidden="true"
              style={{
                position: 'absolute',
                width: '2rem',
                height: '2rem',
                opacity: isDark ? 1 : 0,
                transform: isDark ? 'rotate(0deg) scale(1)' : 'rotate(-180deg) scale(0.5)',
                transition: 'opacity 300ms ease, transform 300ms ease',
              }}
            >
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>

            {/* Moon icon — visible in light mode */}
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="#000"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
              style={{
                position: 'absolute',
                width: '2rem',
                height: '2rem',
                opacity: isDark ? 0 : 1,
                transform: isDark ? 'rotate(180deg) scale(0.5)' : 'rotate(0deg) scale(1)',
                transition: 'opacity 300ms ease, transform 300ms ease',
              }}
            >
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1"     x2="12" y2="3"     />
              <line x1="12" y1="21"    x2="12" y2="23"    />
              <line x1="4.22" y1="4.22"   x2="5.64" y2="5.64"   />
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1"  y1="12"    x2="3"  y2="12"    />
              <line x1="21" y1="12"    x2="23" y2="12"    />
              <line x1="4.22" y1="19.78"  x2="5.64" y2="18.36"  />
              <line x1="18.36" y1="5.64"  x2="19.78" y2="4.22"  />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ThemeToggleBar;
