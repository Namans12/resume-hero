import React, { useEffect } from 'react';

// Shared particle coordinates — the EXACT same field powers both skies.
const makePositions = (n: number): [number, number][] =>
  Array.from({ length: n }, () => [
    Math.floor(Math.random() * 2000),
    Math.floor(Math.random() * 2000),
  ]);

const P1 = makePositions(700);
const P2 = makePositions(200);
const P3 = makePositions(100);

// Build a box-shadow field from positions. `glare` (px) adds a soft glow used
// by the day sky so the same dots read as warm sun-glares instead of stars.
const field = (positions: [number, number][], color: string, glare = 0): string =>
  positions
    .map(([x, y]) => (glare ? `${x}px ${y}px ${glare}px 1px ${color}` : `${x}px ${y}px ${color}`))
    .join(', ');

// Night: crisp pure-white stars.
const S1 = field(P1, '#FFF');
const S2 = field(P2, '#FFF');
const S3 = field(P3, '#FFF');

// Day: IDENTICAL to the night stars (same positions, sizes, overlay, drift) —
// only the colour changes to a warm yellow-white sun-glare tint.
const SUN_TINT = 'rgba(255,226,150,0.95)';
const G1 = field(P1, SUN_TINT);
const G2 = field(P2, SUN_TINT);
const G3 = field(P3, SUN_TINT);

interface StarBackgroundProps {
  opacity: number;
  isDark: boolean;
}

const StarBackground: React.FC<StarBackgroundProps> = ({ opacity, isDark }) => {
  useEffect(() => {
    if (!document.getElementById('star-anim')) {
      const s = document.createElement('style');
      s.id = 'star-anim';
      s.textContent = `
        @keyframes animStar {
          from { transform: translateY(0px);     }
          to   { transform: translateY(-2000px); }
        }
      `;
      document.head.appendChild(s);
    }
  }, []);

  // Night vs day: base gradient + particle layers swap together
  const background = isDark
    ? 'radial-gradient(ellipse at bottom, #1B2735 0%, #090A0F 100%)'
    : 'linear-gradient(to bottom, #E8F4F8 0%, #F0F8FF 40%, #FAFCFF 70%, #FFFFFF 100%)';

  const layers = isDark
    ? [
        { size: 1, shadow: S1, dur: 50  },
        { size: 2, shadow: S2, dur: 100 },
        { size: 3, shadow: S3, dur: 150 },
      ]
    : [
        { size: 1, shadow: G1, dur: 50  },
        { size: 2, shadow: G2, dur: 100 },
        { size: 3, shadow: G3, dur: 150 },
      ];

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: -1,
        opacity,
        transition: 'opacity 0.5s ease',
        background,
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    >
      {/* Day-only diffused sun, top-right */}
      {!isDark && (
        <div
          style={{
            position: 'absolute',
            top: '-10%',
            right: '-10%',
            width: '70vw',
            height: '70vw',
            background:
              'radial-gradient(circle at 55% 45%, rgba(255,255,250,0.5) 0%, rgba(255,252,240,0.25) 20%, rgba(255,248,230,0.1) 40%, transparent 65%)',
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Three parallax layers; each two divs offset by 2000px for a seamless loop */}
      {layers.map(({ size, shadow, dur }) =>
        [0, 2000].map(top => (
          <div
            key={`${size}-${top}`}
            style={{
              position: 'absolute',
              top,
              width: size,
              height: size,
              background: 'transparent',
              boxShadow: shadow,
              animation: `animStar ${dur}s linear infinite`,
            }}
          />
        ))
      )}
    </div>
  );
};

export default StarBackground;
