import React, { useState, useRef, useEffect } from 'react';

interface HangingLampProps {
  isDark: boolean;
  onThemeChange: () => void;
  isVisible?: boolean;
  isMenuOpen?: boolean;
}

const STIFFNESS = 0.18;
const DAMPING   = 0.72;
const PULL_DIST = 18; // px the handle travels down when pulled

const HangingLamp: React.FC<HangingLampProps> = ({ isDark, onThemeChange, isVisible = true, isMenuOpen = false }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isPulled, setIsPulled]   = useState(false);

  const pullStringRef = useRef<SVGLineElement>(null);
  const pullHandleRef = useRef<HTMLDivElement>(null);
  const animationRef  = useRef<number>();

  // Keep a ref in sync so the rAF loop can read isPulled without restarting
  const isPulledRef = useRef(false);
  useEffect(() => { isPulledRef.current = isPulled; }, [isPulled]);

  // Single persistent spring loop — runs once on mount, never restarts
  const springPos = useRef(0);
  const springVel = useRef(0);
  useEffect(() => {
    const tick = () => {
      const target = isPulledRef.current ? PULL_DIST : 0;
      const force = (target - springPos.current) * STIFFNESS;
      springVel.current = springVel.current * DAMPING + force;
      springPos.current += springVel.current;
      const pos = springPos.current;

      pullStringRef.current?.setAttribute('y2', String(240 + pos));
      if (pullHandleRef.current) {
        pullHandleRef.current.style.transform = `translateY(${pos}px)`;
      }

      animationRef.current = requestAnimationFrame(tick);
    };
    animationRef.current = requestAnimationFrame(tick);
    return () => { if (animationRef.current) cancelAnimationFrame(animationRef.current); };
  }, []); // intentionally empty — persistent loop uses ref

  // Release the pull after 900 ms so spring bounces back
  useEffect(() => {
    if (!isPulled) return;
    const t = setTimeout(() => setIsPulled(false), 900);
    return () => clearTimeout(t);
  }, [isPulled]);

  const handleClick = () => {
    setIsPulled(true);
    onThemeChange();
  };

  return (
    <>
      {/* Hanging Lamp — fixed, scales from ceiling anchor */}
      <div
        className={`fixed -top-14 right-0 sm:right-4 md:right-10 lg:right-16 z-50 pointer-events-none
          origin-top scale-90 sm:scale-105 lg:scale-[1.22]
          transition-[opacity,transform] duration-500
          ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-8'}
          ${isMenuOpen ? 'blur-sm md:blur-none' : ''}`}
      >
        {/* Ceiling anchor */}
        <div
          className={`w-7 h-3.5 rounded-b-xl mx-auto shadow-md ${isDark ? 'bg-gray-700' : 'bg-gray-800'}`}
        />

        {/* Lamp SVG + interactions */}
        <div
          className={`relative ${isMenuOpen ? 'pointer-events-none md:pointer-events-auto' : 'pointer-events-auto'}`}
          style={{ transformOrigin: '50% 0%' }}
        >
          <svg
            width="350"
            height="400"
            viewBox="0 0 350 400"
            className="transform-gpu"
            style={{ transformOrigin: '175px 0px' }}
          >
            <defs>
              <filter id="lampGlow">
                <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
                <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
              <filter id="dropShadow">
                <feDropShadow dx="0" dy="6" stdDeviation="3" floodColor="#000" floodOpacity="0.3"/>
              </filter>
              <linearGradient id="lightBeamGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%"   style={{ stopColor: '#feefae', stopOpacity: 0.45 }} />
                <stop offset="70%"  style={{ stopColor: '#feefae', stopOpacity: 0.3 }} />
                <stop offset="100%" style={{ stopColor: '#feefae', stopOpacity: 0 }} />
              </linearGradient>
            </defs>

            {/* Main hanging cord (ceiling → lamp top) */}
            <line
              x1="175" y1="0" x2="175" y2="78"
              stroke="#4a5568" strokeWidth="4" strokeLinecap="round"
              className={`cursor-pointer ${isMenuOpen ? 'pointer-events-none md:pointer-events-auto' : ''}`}
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
              onClick={handleClick}
            />
            <circle cx="175" cy="0" r="4" fill="#6b7280" className="pointer-events-none" />

            {/* Lamp body — g centred at x=175 in SVG space */}
            <g id="light" transform="translate(6, 10)">
              {/* Bulb */}
              <path
                d="M181.07 121.86c0 7.11-5.26 12.88-11.75 12.88s-11.74-5.77-11.74-12.88S162.84 109 169.32 109s11.75 5.74 11.75 12.86z"
                fill={isDark ? '#4a5568' : '#f5d688f2'}
                filter={!isDark ? 'url(#lampGlow)' : undefined}
                className="transition-all duration-300 pointer-events-none"
              />

              {/* Light beam (day mode only) */}
              {!isDark && (
                <polygon
                  points="142.97 121.86 44.32 380.3 294.32 380.3 195.57 121.86 142.97 121.86"
                  fill="url(#lightBeamGradient)"
                  style={{ mixBlendMode: 'luminosity' }}
                  className="animate-pulse pointer-events-none"
                />
              )}

              {/* Socket */}
              <path
                d="M172.27 72.32v-2.79a2.38 2.38 0 00-2.27-2.47h-1.37a2.38 2.38 0 00-2.26 2.47v2.79a7.77 7.77 0 015.89 0z"
                fill="#6b7280"
                className="transition-all duration-300 pointer-events-none"
              />

              {/* Shade neck */}
              <path
                d="M178 81.25V90l-.36-.08a54.11 54.11 0 00-15.25-.19l-1.36.19-.37.08v-8.75a10.88 10.88 0 01.1-1.41 9.69 9.69 0 01.32-1.48c0-.06 0-.12.05-.18a7.23 7.23 0 01.26-.7.42.42 0 010-.12l.18-.41c.07-.15.14-.3.22-.44a10.34 10.34 0 011-1.51 9.67 9.67 0 011.43-1.43c.16-.12.32-.25.5-.36a4.93 4.93 0 01.54-.34 6 6 0 01.55-.31l.56-.24a7.77 7.77 0 012.93-.58 7.87 7.87 0 013 .58 9.19 9.19 0 015.3 6 10.2 10.2 0 01.4 2.93z"
                fill="#60A5FA"
                className="transition-all duration-500 pointer-events-none"
              />

              {/* Shade dome */}
              <path
                d="M195.67 121.86H143l1.58-12.67c1-7.93 8.11-17.48 16.1-19.2l.37-.08 1.43-.2a54.74 54.74 0 0115.18.2l.34.09c8 1.72 15.14 11.27 16.11 19.2z"
                fill="#60A5FA"
                filter="url(#dropShadow)"
                className="transition-all duration-500 pointer-events-none"
              />

              {/* Shade details */}
              <path
                d="M178 81.25h-17.35a10.88 10.88 0 01.1-1.41 9.69 9.69 0 01.32-1.48h16.5a10.2 10.2 0 01.43 2.89zM178 87.2V90l-.36-.08a54.11 54.11 0 00-15.25-.19l-1.36.19-.37.08v-2.67c3-.3 6.17-.46 9.38-.46 2.7 0 5.36.13 7.96.33z"
                fill={isDark ? '#FFFFFF' : '#555555'}
                className="transition-all duration-300 pointer-events-none"
              />

              {/* Bottom rim */}
              <polygon
                points="195.67 119.86 142.98 119.86 140.94 119.86 140.94 123.62 197.71 123.62 197.71 119.86 195.67 119.86"
                fill={isDark ? '#FFFFFF' : '#555555'}
                className="transition-all duration-300 pointer-events-none"
              />
            </g>

            {/* Pull string */}
            <line
              ref={pullStringRef}
              x1="175" y1="145" x2="175" y2="240"
              stroke={isDark ? '#6b7280' : '#9ca3af'}
              strokeWidth="3"
              strokeLinecap="round"
              className={`cursor-pointer ${isMenuOpen ? 'pointer-events-none md:pointer-events-auto' : ''}`}
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
              onClick={handleClick}
            />

            {/* String beads */}
            {[155, 175, 195, 215, 235].map(cy => (
              <circle key={cy} cx="175" cy={cy} r="2.5"
                fill={isDark ? '#6b7280' : '#9ca3af'}
                className="pointer-events-none"
              />
            ))}
          </svg>
        </div>

        {/* Pull handle + tooltip */}
        {/* Container centered on the cord (x=175 in SVG) */}
        <div
          className={`absolute top-[255px] left-1/2 -translate-x-1/2
            ${isMenuOpen ? 'pointer-events-none md:pointer-events-auto' : 'pointer-events-auto'}`}
        >
          <div
            ref={pullHandleRef}
            role="button"
            tabIndex={0}
            aria-label={isDark ? 'Pull to turn light on' : 'Pull to turn light off'}
            className={`w-6 h-6 rounded-full border-2 transition-colors duration-300
              touch-manipulation focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500
              ${isHovered ? 'scale-110' : ''}
              ${isDark ? 'bg-gray-500 border-gray-400' : 'bg-gray-300 border-gray-400'}
              ${isMenuOpen ? 'cursor-not-allowed md:cursor-pointer' : 'cursor-pointer'}`}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onClick={handleClick}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick(); }
            }}
          />

          {/* Tooltip to the right of handle */}
          {isHovered && (
            <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 pointer-events-none z-10 whitespace-nowrap">
              <div className={`absolute top-1/2 -left-1 -translate-y-1/2 w-2 h-2 rotate-45 ${
                isDark ? 'bg-gray-800 border-l border-b border-gray-600/70' : 'bg-white border-l border-b border-gray-200'
              }`} />
              <div className={`px-3 py-1.5 rounded-lg text-xs font-medium shadow-lg ${
                isDark
                  ? 'bg-gray-800 text-gray-100 border border-gray-600/70'
                  : 'bg-white text-gray-700 border border-gray-200 shadow-md'
              }`}>
                {isDark ? 'Pull to turn on' : 'Pull to turn off'}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Ambient warm glow (day mode) */}
      {!isDark && (
        <div
          className="fixed inset-0 pointer-events-none z-0"
          style={{
            background: 'radial-gradient(circle at 50% 25%, rgba(253,230,138,0.08) 0%, transparent 60%)',
            animation: 'ambientPulse 4s ease-in-out infinite alternate',
          }}
        />
      )}
    </>
  );
};

export default HangingLamp;
