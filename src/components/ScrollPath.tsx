import { useEffect, useRef, useState } from 'react';
import { SKETCHES, type SketchId } from './authoredSketches';
import { flowConnector, type Point } from './flowConnector';
import { artworkPlacement } from './artworkPlacement';

// Each station gets its own scroll interval: long artwork traces must not
// consume the next section's drawing time simply because they contain more ink.
const STATIONS: SketchId[] = ['about', 'skills', 'experience', 'projects', 'achievements', 'certifications', 'hands'];
type Segment = { id: string; d: string; start: number; end: number };
type Layout = { width: number; height: number; segments: Segment[] };
const clamp = (v: number) => Math.max(0, Math.min(1, v));

// Generated sketches use absolute M/C commands, with coordinate pairs only.
function placePath(d: string, scale: number, x: number, y: number) {
  let coordinate = 0;
  return d.replace(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi, value =>
    String(Number(value) * scale + (coordinate++ % 2 === 0 ? x : y)));
}

// Entrance transforms move painted boxes without changing layout. Remove
// translations from the whole ancestor chain (the form's wrapper animates
// by 18px), otherwise its measured border remains offset after settling.
function entranceOffset(el: Element, section: Element) {
  let offset = 0;
  for (let node: Element | null = el; node && node !== section; node = node.parentElement) {
    const transform = getComputedStyle(node).transform;
    if (transform !== 'none') offset += new DOMMatrixReadOnly(transform).m42;
  }
  return offset;
}

/* Where content actually ends, row by row: the rightmost pixel anything
   paints (boxes for painted elements, glyph boxes for text - a heading's
   box spans the whole column while its letters stop far short), in host
   coordinates. Entrance translations are removed along each element's
   ancestor chain, so it describes the settled layout even before the
   whileInView animations have played (the experience cards start 24px to
   the left). Used only by flourishes that leave the gutter for empty space. */
function contentSkyline(host: HTMLElement) {
  const ROW = 16;
  const rect = host.getBoundingClientRect();
  const top0 = rect.top + window.scrollY;
  const sky = new Float32Array(Math.ceil(host.scrollHeight / ROW) + 1);
  const shifts = new Map<Element, Point>();
  const shift = (el: Element | null, stop: Element): Point => {
    if (!el || el === stop) return { x: 0, y: 0 };
    const known = shifts.get(el);
    if (known) return known;
    const up = shift(el.parentElement, stop);
    const t = getComputedStyle(el).transform;
    const m = t === 'none' ? null : new DOMMatrixReadOnly(t);
    const own = { x: up.x + (m ? m.m41 : 0), y: up.y + (m ? m.m42 : 0) };
    shifts.set(el, own);
    return own;
  };
  const add = (r: DOMRect, s: Point) => {
    if (r.width < 1 || r.height < 1) return;
    const right = r.right - rect.left - s.x;
    const a = Math.max(0, Math.floor((r.top + window.scrollY - top0 - s.y) / ROW));
    const b = Math.min(sky.length - 1, Math.floor((r.bottom + window.scrollY - top0 - s.y) / ROW));
    for (let i = a; i <= b; i++) if (right > sky[i]) sky[i] = right;
  };
  const range = document.createRange();
  for (const section of host.querySelectorAll('.section-shell')) {
    for (const el of section.querySelectorAll('img,video,canvas,button,input,textarea,select,form,[class*="rounded"]')) {
      add(el.getBoundingClientRect(), shift(el, section));
    }
    const walker = document.createTreeWalker(section, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (!n.textContent?.trim()) continue;
      range.selectNodeContents(n);
      add(range.getBoundingClientRect(), shift(n.parentElement, section));
    }
  }
  return (top: number, bottom: number) => {
    let max = 0;
    const a = Math.max(0, Math.floor(top / ROW)), b = Math.min(sky.length - 1, Math.floor(bottom / ROW));
    for (let i = a; i <= b; i++) if (sky[i] > max) max = sky[i];
    return max;
  };
}

export default function ScrollPath({ isDark }: { isDark: boolean }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [layout, setLayout] = useState<Layout | null>(null);

  useEffect(() => {
    const host = wrapRef.current?.parentElement;
    if (!host) return;
    let frame = 0;
    let disposed = false;
    const observed = new Set<Element>();
    const measure = () => {
      frame = 0;
      if (disposed) return;
      for (const el of host.querySelectorAll('.section-shell > div, #contact form')) {
        if (!observed.has(el)) { observer.observe(el); observed.add(el); }
      }
      const width = host.clientWidth;
      if (width < 1024) { setLayout(null); return; }
      const hostTop = host.getBoundingClientRect().top + window.scrollY;
      const freeLeft = contentSkyline(host);
      const segments: Segment[] = [];
      let previous: { point: Point; tangent: Point; end: number } | undefined;
      for (const id of STATIONS) {
        const section = document.getElementById(id === 'hands' ? 'contact' : id);
        const heading = section?.querySelector('h2');
        const content = section?.firstElementChild;
        if (!section || !heading || !content) continue;
        // Remove the entrance translation so anchors stay stable while headings animate.
        const headingTop = heading.getBoundingClientRect().top + window.scrollY - entranceOffset(heading, section);
        const art = SKETCHES[id];
        const form = id === 'hands' ? section.querySelector('form') : null;
        const formBottom = form ? form.getBoundingClientRect().bottom + window.scrollY - entranceOffset(form, section) : undefined;
        // Keep the band beside the content on wide monitors, rather than
        // letting the illustrations drift into a distant viewport margin.
        const contentEdge = content.getBoundingClientRect().right - host.getBoundingClientRect().left;
        const reservedGutter = Math.min(320, Math.max(200, width * 0.22));
        const drawingWidth = Math.min(width, contentEdge + reservedGutter);
        const placement = artworkPlacement(art, drawingWidth, headingTop, formBottom);
        const { scale, gutter, x } = placement;
        const y = placement.y - hostTop;
        const coords = (art.d.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi) ?? []).map(Number);
        const start = Math.max(previous ? previous.end + 80 : 0, placement.top - window.innerHeight * 0.82);
        const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
        // Contact is a stopping point: finish its drawing when the whole
        // form enters the viewport, rather than leaving the cuff unfilled.
        const finishFrontier = id === 'hands' ? 0.82 : 0.38;
        const end = Math.max(start + 1, Math.min(maxScroll, placement.bottom - window.innerHeight * finishFrontier));
        const entry = { x: x + art.entry[0] * scale, y: y + art.entry[1] * scale };
        const exit = { x: x + art.exit[0] * scale, y: y + art.exit[1] * scale };
        const direction = (atEnd: boolean): Point => {
          const anchor = atEnd ? art.exit : art.entry;
          for (let i = atEnd ? coords.length - 4 : 2; atEnd ? i >= 0 : i < coords.length; i += atEnd ? -2 : 2) {
            const dx = (coords[i] - anchor[0]) * (atEnd ? -1 : 1);
            const dy = (coords[i + 1] - anchor[1]) * (atEnd ? -1 : 1);
            const length = Math.hypot(dx, dy);
            if (length > 0.1) return { x: dx / length, y: dy / length };
          }
          return { x: 0, y: 1 };
        };
        if (previous) {
          const tailTop = placement.top - hostTop + (placement.bottom - placement.top) * 0.5;
          const lowerXs = coords.filter((_, i) => i % 2 === 0 && y + coords[i + 1] * scale >= tailTop);
          segments.push({
            id: `to-${id}`,
            d: flowConnector(
              { point: previous.point, tangent: previous.tangent },
              { point: entry, tangent: direction(false) },
              { left: drawingWidth - gutter + 10, right: drawingWidth - 10 },
              STATIONS.indexOf(id) - 1,
              {
                left: x + Math.min(...coords.filter((_, i) => i % 2 === 0)) * scale,
                right: x + Math.max(...coords.filter((_, i) => i % 2 === 0)) * scale,
                top: placement.top - hostTop,
                bottom: placement.bottom - hostTop,
                tailTop,
                lowerRight: x + Math.max(...lowerXs) * scale,
              },
              // Gears -> graph: oval loops; graph -> rocket: a heart knot.
              id === 'experience' ? { kind: 'ovals', freeLeft }
                : id === 'projects' ? { kind: 'heart', freeLeft } : undefined,
            ),
            start: previous.end, end: Math.max(previous.end + 1, start),
          });
        }
        segments.push({ id, d: placePath(art.d, scale, x, y), start, end });
        previous = { point: exit, tangent: direction(true), end };
      }
      const next = { width, height: host.scrollHeight, segments };
      setLayout(old => JSON.stringify(old) === JSON.stringify(next) ? old : next);
    };
    const schedule = () => { if (!disposed && !frame) frame = requestAnimationFrame(measure); };
    const observer = new ResizeObserver(schedule);
    observer.observe(host);
    for (const section of document.querySelectorAll('.section-shell')) { observer.observe(section); observed.add(section); }
    window.addEventListener('resize', schedule);
    document.fonts.ready.then(schedule);
    schedule();
    return () => {
      disposed = true;
      observer.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', schedule);
    };
  }, []);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || !layout) return;
    const routes = [...svg.querySelectorAll<SVGPathElement>('[data-route-segment]')];
    const ink = svg.querySelector<SVGPathElement>('[data-ink]')!;
    const pen = svg.querySelector<SVGGElement>('[data-pen]')!;
    const penStrokes = [...pen.querySelectorAll<SVGPathElement>('path')];
    const lengths = routes.map(path => path.getTotalLength());
    const totalLength = lengths.reduce((sum, length) => sum + length, 0);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    let current = window.scrollY;
    let lastTime = 0;
    const paint = (time: number) => {
      frame = 0;
      const target = window.scrollY;
      const delta = Math.min(64, lastTime ? time - lastTime : 16);
      lastTime = time;
      current += (target - current) * (1 - Math.exp(-delta / 65));
      if (Math.abs(target - current) < 0.2) current = target;
      let distance = 0;
      layout.segments.forEach((segment, i) => {
        const p = reduced.matches ? 1 : clamp((current - segment.start) / (segment.end - segment.start));
        distance += lengths[i] * p;
      });
      const progress = clamp(distance / totalLength);
      ink.style.strokeDashoffset = String(1 - progress);
      pen.style.opacity = progress <= 0 || progress >= 1 || reduced.matches ? '0' : '1';
      // SVG's dash renderer and getPointAtLength use different length
      // approximations on complex paths. Draw the nib with the SAME dash
      // parameterization as the ink, so it cannot drift from the endpoint.
      for (const stroke of penStrokes) stroke.style.strokeDashoffset = String(2 - progress);
      if (current !== target && !document.hidden) frame = requestAnimationFrame(paint);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(paint); };
    const visibility = () => {
      cancelAnimationFrame(frame); frame = 0; lastTime = 0;
      if (!document.hidden) { current = window.scrollY; schedule(); }
    };
    window.addEventListener('scroll', schedule, { passive: true });
    document.addEventListener('visibilitychange', visibility);
    reduced.addEventListener('change', schedule);
    schedule();
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      document.removeEventListener('visibilitychange', visibility);
      reduced.removeEventListener('change', schedule);
    };
  }, [layout]);

  // Remove subsequent move commands: the connector endpoints and artwork
  // endpoints coincide, producing one uninterrupted SVG stroke.
  const route = layout?.segments.map((segment, i) => i === 0 ? segment.d
    : segment.d.replace(/^M\s+[-\d.e+]+[ ,]+[-\d.e+]+\s*/i, '')).join(' ');
  const color = isDark ? '#a6b5f7' : '#6156ae';
  return <div ref={wrapRef} aria-hidden="true" className="scroll-path" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
    {layout && <svg ref={svgRef} width={layout.width} height={layout.height} fill="none" style={{ display: 'block' }}>
      {layout.segments.map(segment => <g key={segment.id} data-station={segment.id}>
        <path data-route-segment d={segment.d} stroke={color} strokeOpacity={0.07} strokeWidth={1.1} strokeLinecap="round" strokeLinejoin="round" />
      </g>)}
      <path data-ink d={route} pathLength={1} stroke={color} strokeWidth={1.35} strokeOpacity={0.62} strokeLinecap="round" strokeLinejoin="round" style={{ strokeDasharray: 1, strokeDashoffset: 1 }} />
      <g data-pen style={{ opacity: 0 }}>
        <path data-pen-halo d={route} pathLength={1} stroke={color} strokeWidth={14} strokeOpacity={0.09} strokeLinecap="round" style={{ strokeDasharray: '0 2', strokeDashoffset: 2 }} />
        <path data-pen-tip d={route} pathLength={1} stroke={color} strokeWidth={5} strokeOpacity={0.85} strokeLinecap="round" style={{ strokeDasharray: '0 2', strokeDashoffset: 2 }} />
      </g>
    </svg>}
  </div>;
}
