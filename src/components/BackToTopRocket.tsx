import React, { useEffect, useRef, useState } from 'react';
import { motion, animate } from 'framer-motion';
import { MdOutlineRocket } from 'react-icons/md';

interface BackToTopRocketProps {
  isDark: boolean;
}

const TAP_MS = 600; // three-line tap animation plays over the rocket head
const THRUST_MS = 320; // thrusters fire while the rocket holds still
const FLY_MS = 1000; // rocket rises straight up + page scrolls, locked together
// ease-in-out: smooth start and a gentle deceleration into the target (no sudden stop)
const FLY_EASE: [number, number, number, number] = [0.65, 0, 0.35, 1];

// Scroll position that centers the About section in the viewport.
const aboutTarget = () => {
  const el = document.getElementById('about');
  if (!el) return 0;
  const absTop = el.getBoundingClientRect().top + window.scrollY;
  const centered = absTop + el.offsetHeight / 2 - window.innerHeight / 2;
  return Math.max(0, Math.round(centered));
};

/**
 * Fixed bottom-right rocket that returns the visitor to the About section.
 * Always mounted (opacity fades with scroll). On tap: a hand-tap animation plays
 * over the rocket, then the thrusters fire (rocket holds still), then the rocket
 * rises straight up - no rotation - while the page scrolls to About in lock-step.
 */
const BackToTopRocket: React.FC<BackToTopRocketProps> = ({ isDark }) => {
  const [visible, setVisible] = useState(false);
  const [tapping, setTapping] = useState(false);
  const [thrust, setThrust] = useState(false);
  const [resetting, setResetting] = useState(false);
  const busyRef = useRef(false);
  const rocketRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const onScroll = () => {
      // Hidden through the hero AND the About section; the rocket appears only as
      // About ends (moving into the next section) and stays visible from there on.
      const about = document.getElementById('about');
      const threshold = about
        ? about.getBoundingClientRect().top + window.scrollY + about.offsetHeight * 0.85
        : window.innerHeight * 1.85;
      setVisible(window.scrollY > threshold);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const launch = () => {
    if (busyRef.current) return;
    busyRef.current = true;

    setTapping(true); // 1) hand-tap animation over the rocket head

    window.setTimeout(() => {
      setTapping(false);
      setThrust(true); // 2) thrusters fire - rocket holds still

      window.setTimeout(() => {
        // 3) lift straight up + scroll to About, driven by one locked progress.
        //    scroll-behavior forced to 'auto' so the page tracks each frame
        //    instead of lagging behind via CSS smooth-scroll.
        const startY = window.scrollY;
        const targetY = aboutTarget();
        const flyUp = -(window.innerHeight + 200);
        const html = document.documentElement;
        const prevBehavior = html.style.scrollBehavior;
        html.style.scrollBehavior = 'auto';
        animate(0, 1, {
          duration: FLY_MS / 1000,
          ease: FLY_EASE,
          onUpdate: (p) => {
            if (rocketRef.current) rocketRef.current.style.transform = `translateY(${p * flyUp}px)`;
            window.scrollTo(0, startY + (targetY - startY) * p);
          },
          onComplete: () => {
            html.style.scrollBehavior = prevBehavior;
          },
        });

        // 4) once landed at About the rocket is off-screen: hide it, reset its
        //    transform unseen, then fade it back in at rest (no snap, no turn).
        window.setTimeout(() => {
          setThrust(false);
          setResetting(true);
          window.setTimeout(() => {
            if (rocketRef.current) rocketRef.current.style.transform = 'translateY(0px)';
            setResetting(false);
            busyRef.current = false;
          }, 320);
        }, FLY_MS);
      }, THRUST_MS);
    }, TAP_MS);
  };

  const iconColor = isDark ? '#f3f4f6' : '#111827';
  const iconShadow = isDark
    ? 'drop-shadow(0 1px 6px rgba(0,0,0,0.55))'
    : 'drop-shadow(0 1px 6px rgba(255,255,255,0.7))';
  const active = tapping || thrust;

  return (
    <button
      type="button"
      aria-label="Back to About"
      onClick={launch}
      className="fixed z-50 flex items-center justify-center transition-transform duration-150 hover:-translate-y-0.5 active:scale-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      style={{
        right: 'clamp(1rem, 1vw, 1rem)',
        bottom: 'clamp(1rem, 1vw, 1rem)',
        width: 54,
        height: 54,
        background: 'transparent',
        border: 'none',
        padding: 0,
        cursor: 'pointer',
        overflow: 'visible',
        opacity: resetting ? 0 : visible || active ? 1 : 0,
        pointerEvents: visible && !resetting ? 'auto' : 'none',
        transition: 'opacity 0.3s ease',
      }}
    >
      {/* Tap animation - three short, spaced lines popping over the rocket head together */}
      {tapping && (
        <span aria-hidden style={{ position: 'absolute', left: '50%', top: 4, width: 0, height: 0, pointerEvents: 'none' }}>
          {[-1, 0, 1].map((dir, i) => (
            <span key={i} style={{ position: 'absolute', left: dir * 8, top: 0, transform: `rotate(${dir * 16}deg)`, transformOrigin: 'center bottom' }}>
              <motion.span
                initial={{ opacity: 0, y: 4, scaleY: 0.3 }}
                animate={{ opacity: [0, 1, 0], y: [4, -3, -9], scaleY: [0.3, 1, 0.9] }}
                transition={{ duration: 0.5, times: [0, 0.4, 1], ease: 'easeOut' }}
                style={{ display: 'block', width: 2.5, height: 8, borderRadius: 2, background: iconColor, transformOrigin: 'center bottom' }}
              />
            </span>
          ))}
        </span>
      )}

      {/* Rocket (always vertical - no rotation) + thruster flame */}
      <span
        ref={rocketRef}
        style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', willChange: 'transform' }}
      >
        <span style={{ fontSize: 34, lineHeight: 0, color: iconColor, filter: iconShadow, display: 'block' }}>
          <MdOutlineRocket />
        </span>

        {thrust && (
          <motion.span
            aria-hidden
            initial={{ opacity: 0, scaleY: 0.3 }}
            animate={{ opacity: 1, scaleY: 1 }}
            style={{ marginTop: -9, transformOrigin: 'top center', display: 'block' }}
          >
            <motion.span
              animate={{ scaleY: [1, 1.6, 1], opacity: [0.9, 1, 0.85] }}
              transition={{ duration: 0.22, repeat: Infinity, ease: 'easeInOut' }}
              style={{
                display: 'block',
                width: 11,
                height: 20,
                background: 'linear-gradient(to bottom, #fff7ed, #fdba74, #f97316, #ef4444)',
                borderRadius: '50% 50% 45% 45% / 35% 35% 100% 100%',
                transformOrigin: 'top center',
                filter: 'blur(0.4px)',
              }}
            />
          </motion.span>
        )}
      </span>
    </button>
  );
};

export default BackToTopRocket;
