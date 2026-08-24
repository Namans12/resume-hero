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

    // Only on devices that actually have a mouse - never on touch phones/tablets.
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    /* A 20-dot trail under an SVG goo filter and mix-blend-mode: difference is
       about the most expensive paint combination available, and it chases the
       pointer continuously with an idle wiggle on top. That is exactly the
       kind of unprompted motion prefers-reduced-motion is asking about, so
       the whole thing simply doesn't mount - the native cursor stays. */
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const html = document.documentElement;
    html.classList.add('has-custom-cursor');

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
    let present = true;

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

    const onMove = (e: MouseEvent) => {
      mouse.x = e.clientX - W / 2;
      mouse.y = e.clientY - W / 2;
      resetIdle();
      kick();
    };
    window.addEventListener('mousemove', onMove, { passive: true });

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
      clearTimeout(timeoutID);
      cancelAnimationFrame(raf);
      raf = 0;
    };
    const enter = () => { present = true; kick(); };
    // mouseout bubbles from every element boundary; only a null relatedTarget
    // means the pointer actually left the page.
    const onOut = (e: MouseEvent) => { if (e.relatedTarget === null) leave(); };
    const onVisibility = () => { if (document.hidden) leave(); else enter(); };

    document.addEventListener('mouseout', onOut);
    window.addEventListener('blur', leave);
    window.addEventListener('focus', enter);
    document.addEventListener('visibilitychange', onVisibility);

    kick();

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timeoutID);
      window.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseout', onOut);
      window.removeEventListener('blur', leave);
      window.removeEventListener('focus', enter);
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
