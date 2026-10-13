import { useEffect, useRef } from 'react';

/* Gooey trailing-dots cursor (adapted from Eder Anaya's experiment).
   - Desktop / fine-pointer only; touch devices keep the native behaviour.
   - mix-blend-mode: difference -> auto-adapts to light & dark backgrounds.
   - TRAIL < the original 0.35 so the chain collapses slower (longer trail). */

const DOT_COUNT = 20;
const DOT_SIZE = 22;        // px - must match the .cursor-root span size in CSS
const TRAIL = 0.20;         // lower -> dots lag more -> longer, slower trail
const MIN_SCALE = 0.12;     // size of the tail-most dot (keeps the taper positive for any count)
const ANGLE_SPEED = 0.05;
const IDLE_TIMEOUT = 150;   // ms of stillness before the cluster drifts (idle wiggle)

interface Dot {
  x: number; y: number;
  scale: number; range: number;
  angleX: number; angleY: number;
  lockX: number; lockY: number;
  el: HTMLSpanElement;
}

const CustomCursor: React.FC = () => {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const pointer = window.matchMedia('(hover: hover) and (pointer: fine)');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const enabled = () => pointer.matches && !reducedMotion.matches;
    const html = document.documentElement;
    // Do not hide the native cursor until a real pointer position is known.
    root.style.visibility = 'hidden';

    const W = DOT_SIZE;
    const sineDots = Math.floor(DOT_COUNT * 0.3);
    const mouse = { x: window.innerWidth / 2 - W / 2, y: window.innerHeight / 2 - W / 2 };

    const dots: Dot[] = [];
    for (let i = 0; i < DOT_COUNT; i++) {
      const el = document.createElement('span');
      const scale = 1 - (i / (DOT_COUNT - 1)) * (1 - MIN_SCALE);
      el.style.transform = `translate3d(${mouse.x}px, ${mouse.y}px, 0) scale(${scale})`;
      root.appendChild(el);
      dots.push({
        x: mouse.x, y: mouse.y, scale,
        range: W / 2 - (W / 2) * scale + 2,
        angleX: 0, angleY: 0, lockX: 0, lockY: 0, el,
      });
    }

    let idle = false;
    let timeoutID = 0;
    let raf = 0;
    // The trail is only worth animating while the pointer is actually over the
    // page and the window has focus.
    let present = false;

    const goIdle = () => {
      idle = true;
      for (const d of dots) {
        d.lockX = d.x; d.lockY = d.y;
        d.angleX = Math.PI * 2 * Math.random();
        d.angleY = Math.PI * 2 * Math.random();
      }
    };
    const resetIdle = () => {
      clearTimeout(timeoutID);
      idle = false;
      timeoutID = window.setTimeout(goIdle, IDLE_TIMEOUT);
    };

    const onMove = (e: PointerEvent) => {
      if (!enabled() || document.hidden || e.pointerType === 'touch') {
        leave();
        return;
      }
      if (e.clientX < 0 || e.clientY < 0 || e.clientX >= window.innerWidth || e.clientY >= window.innerHeight) {
        leave();
        return;
      }
      mouse.x = e.clientX - W / 2;
      mouse.y = e.clientY - W / 2;
      if (!present) {
        // Re-entry must both restart rAF and discard the old, possibly
        // off-screen trail. Focus is not guaranteed to change on re-entry.
        for (const dot of dots) {
          dot.x = mouse.x; dot.y = mouse.y;
          dot.el.style.transform = `translate3d(${dot.x}px, ${dot.y}px, 0) scale(${dot.scale})`;
        }
        present = true;
        root.style.visibility = 'visible';
        html.classList.add('has-custom-cursor');
      }
      resetIdle();
      kick();
    };

    const render = () => {
      let x = mouse.x, y = mouse.y;
      for (let i = 0; i < dots.length; i++) {
        const dot = dots[i];
        const next = dots[i + 1] || dots[0];
        dot.x = x; dot.y = y;
        if (idle && i > sineDots) {
          dot.angleX += ANGLE_SPEED;
          dot.angleY += ANGLE_SPEED;
          dot.x = dot.lockX + Math.sin(dot.angleX) * dot.range;
          dot.y = dot.lockY + Math.sin(dot.angleY) * dot.range;
        }
        dot.el.style.transform = `translate3d(${dot.x}px, ${dot.y}px, 0) scale(${dot.scale})`;
        if (!idle || i <= sineDots) {
          x += (next.x - dot.x) * TRAIL;
          y += (next.y - dot.y) * TRAIL;
        }
      }
      /* The idle wiggle is perpetual BY DESIGN, so this can't stop just
         because the pointer stopped - the cluster is meant to keep drifting.
         What it should not do is keep repainting 20 goo-filtered,
         difference-blended spans when the pointer isn't even over the page or
         the window is in the background, which is what the old
         unconditional loop did for the whole session. */
      raf = present ? requestAnimationFrame(render) : 0;
    };
    const kick = () => { if (present && !raf) raf = requestAnimationFrame(render); };

    const leave = () => {
      present = false;
      root.style.visibility = 'hidden';
      html.classList.remove('has-custom-cursor');
      clearTimeout(timeoutID);
      cancelAnimationFrame(raf);
      raf = 0;
    };
    const onOut = (e: PointerEvent) => { if (e.relatedTarget === null) leave(); };
    // Returning focus must not resurrect a stale position; the next pointer
    // event supplies the actual location and restarts the animation.
    const onVisibility = () => { if (document.hidden) leave(); };
    window.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerover', onMove, { passive: true });
    document.addEventListener('pointerout', onOut);
    window.addEventListener('blur', leave);
    window.addEventListener('resize', leave);
    window.addEventListener('pagehide', leave);
    document.addEventListener('visibilitychange', onVisibility);
    pointer.addEventListener('change', leave);
    reducedMotion.addEventListener('change', leave);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timeoutID);
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerover', onMove);
      document.removeEventListener('pointerout', onOut);
      window.removeEventListener('blur', leave);
      window.removeEventListener('resize', leave);
      window.removeEventListener('pagehide', leave);
      pointer.removeEventListener('change', leave);
      reducedMotion.removeEventListener('change', leave);
      document.removeEventListener('visibilitychange', onVisibility);
      html.classList.remove('has-custom-cursor');
      dots.forEach(d => d.el.remove());
    };
  }, []);

  return (
    <>
      {/* Goo filter that fuses the dots into a liquid trail */}
      <svg aria-hidden style={{ position: 'absolute', width: 0, height: 0 }}>
        <defs>
          <filter id="cursor-goo">
            <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
            <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 35 -15" result="goo" />
            <feComposite in="SourceGraphic" in2="goo" operator="atop" />
          </filter>
        </defs>
      </svg>
      <div ref={rootRef} className="cursor-root" aria-hidden />
    </>
  );
};

export default CustomCursor;
