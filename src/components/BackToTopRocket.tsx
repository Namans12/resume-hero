import React, { useEffect, useRef, useState } from 'react';
import { MdOutlineRocket } from 'react-icons/md';

interface BackToTopRocketProps {
  isDark: boolean;
}

const TAP_MS = 600; // three-line tap animation plays over the rocket head
const THRUST_MS = 320; // thrusters fire while the rocket holds still
const FLY_MS = 1000; // rocket rises straight up + page scrolls, locked together
const RESET_MS = 320; // fade-out window before the transform is reset unseen

// ease-in-out: smooth start and a gentle deceleration into the target.
// Hand-rolled because this component used to pull framer-motion's `animate`
// into the EAGER bundle purely for this one tween plus three decorative
// keyframe spans — 133KB (44KB gzip) of critical-path JS for a control that
// isn't even visible until you're past the About section. The keyframes now
// live in index.css and the tween is nine lines of rAF.
const easeInOut = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

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
  /* Every timer and rAF the launch sequence starts is registered here so
     unmounting mid-flight can tear all of them down. Previously the nested
     setTimeout chain and the tween ran on regardless, and `scrollBehavior`
     was restored ONLY from the tween's completion callback - an interruption
     left the whole document stuck on `scroll-behavior: auto`. */
  const pending = useRef<{ timers: number[]; raf: number; restore: (() => void) | null }>({
    timers: [], raf: 0, restore: null,
  });

  useEffect(() => {
    // The threshold needs getBoundingClientRect + offsetHeight, so computing it
    // inside the scroll handler forced a layout on every single scroll event.
    // It only moves when the page reflows, so it's cached and recomputed on
    // resize instead, and the handler itself is rAF-throttled.
    let threshold = Infinity;
    let raf = 0;
    const measure = () => {
      const about = document.getElementById('about');
      threshold = about
        ? about.getBoundingClientRect().top + window.scrollY + about.offsetHeight * 0.85
        : window.innerHeight * 1.85;
    };
    const update = () => setVisible(window.scrollY > threshold);
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    };
    const onResize = () => { measure(); update(); };

    measure();
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    // #about arrives with a lazy chunk, so the first measure can land before it
    // exists; re-measure once layout has settled.
    const settle = window.setTimeout(onResize, 800);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(settle);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  // Tear down any in-flight launch sequence on unmount.
  useEffect(() => () => {
    const p = pending.current;
    p.timers.forEach(clearTimeout);
    p.timers = [];
    cancelAnimationFrame(p.raf);
    p.restore?.();
    p.restore = null;
  }, []);

  const after = (ms: number, fn: () => void) => {
    pending.current.timers.push(window.setTimeout(fn, ms));
  };

  const launch = () => {
    if (busyRef.current) return;
    busyRef.current = true;

    setTapping(true); // 1) hand-tap animation over the rocket head

    after(TAP_MS, () => {
      setTapping(false);
      setThrust(true); // 2) thrusters fire - rocket holds still

      after(THRUST_MS, () => {
        // 3) lift straight up + scroll to About, driven by one locked progress.
        //    scroll-behavior forced to 'auto' so the page tracks each frame
        //    instead of lagging behind via CSS smooth-scroll.
        const startY = window.scrollY;
        const targetY = aboutTarget();
        const flyUp = -(window.innerHeight + 200);
        const html = document.documentElement;
        const prevBehavior = html.style.scrollBehavior;
        html.style.scrollBehavior = 'auto';
        const restore = () => { html.style.scrollBehavior = prevBehavior; };
        pending.current.restore = restore;

        const t0 = performance.now();
        const step = () => {
          const p = Math.min(1, (performance.now() - t0) / FLY_MS);
          const e = easeInOut(p);
          if (rocketRef.current) rocketRef.current.style.transform = `translateY(${e * flyUp}px)`;
          window.scrollTo(0, startY + (targetY - startY) * e);
          if (p < 1) pending.current.raf = requestAnimationFrame(step);
          else { restore(); pending.current.restore = null; }
        };
        pending.current.raf = requestAnimationFrame(step);

        // 4) once landed at About the rocket is off-screen: hide it, reset its
        //    transform unseen, then fade it back in at rest (no snap, no turn).
        after(FLY_MS, () => {
          setThrust(false);
          setResetting(true);
          after(RESET_MS, () => {
            if (rocketRef.current) rocketRef.current.style.transform = 'translateY(0px)';
            setResetting(false);
            busyRef.current = false;
            pending.current.timers = [];
          });
        });
      });
    });
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
          {[-1, 0, 1].map(dir => (
            <span key={dir} style={{ position: 'absolute', left: dir * 8, top: 0, transform: `rotate(${dir * 16}deg)`, transformOrigin: 'center bottom' }}>
              <span
                className="rocket-tap"
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
          <span aria-hidden className="rocket-flame-in" style={{ marginTop: -9, transformOrigin: 'top center', display: 'block' }}>
            <span
              className="rocket-flame"
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
          </span>
        )}
      </span>
    </button>
  );
};

export default BackToTopRocket;
