import { useEffect, useRef, useState } from 'react';
import { SKETCHES, type SketchId } from './authoredSketches';

// Each station gets its own scroll interval: long artwork traces must not
// consume the next section's drawing time simply because they contain more ink.
const STATIONS: SketchId[] = ['about', 'skills', 'experience', 'projects', 'achievements', 'certifications', 'hands'];
type Point = { x: number; y: number };
type Segment = { id: string; d: string; start: number; end: number };
type Layout = { width: number; height: number; segments: Segment[] };
const clamp = (v: number) => Math.max(0, Math.min(1, v));

// Generated sketches use absolute M/C commands, with coordinate pairs only.
function placePath(d: string, scale: number, x: number, y: number) {
  let coordinate = 0;
  return d.replace(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi, value =>
    String(Number(value) * scale + (coordinate++ % 2 === 0 ? x : y)));
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
    const measure = () => {
      frame = 0;
      if (disposed) return;
      const width = host.clientWidth;
      if (width < 1024) { setLayout(null); return; }
      const hostTop = host.getBoundingClientRect().top + window.scrollY;
      const segments: Segment[] = [];
      let previous: { point: Point; tangent: Point; end: number } | undefined;
      for (const id of STATIONS) {
        const section = document.getElementById(id === 'hands' ? 'contact' : id);
        const heading = section?.querySelector('h2');
        const content = section?.firstElementChild;
        if (!section || !heading || !content) continue;
        // Remove the entrance translation so anchors stay stable while headings animate.
        const transform = getComputedStyle(heading).transform;
        const translateY = transform === 'none' ? 0 : new DOMMatrixReadOnly(transform).m42;
        const headingTop = heading.getBoundingClientRect().top + window.scrollY - translateY;
        const art = SKETCHES[id];
        const gutter = Math.min(250, Math.max(180, width * 0.19));
        const coords = (art.d.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi) ?? []).map(Number);
        // The hands source has wide empty margins. Size its actual strokes,
        // rather than its canvas, so the two hands are clearly legible.
        const xs = coords.filter((_, i) => i % 2 === 0);
        const ys = coords.filter((_, i) => i % 2 === 1);
        const minX = id === 'hands' ? Math.min(...xs) : 0;
        const minY = id === 'hands' ? Math.min(...ys) : 0;
        const boxW = id === 'hands' ? Math.max(...xs) - minX : art.vb[0];
        const boxH = id === 'hands' ? Math.max(...ys) - minY : art.vb[1];
        const scale = Math.min((gutter - 48) / boxW, (id === 'hands' ? 360 : 250) / boxH);
        const artHeight = boxH * scale;
        const x = width - gutter + (gutter - boxW * scale) / 2 - 10 - minX * scale;
        const y = headingTop - hostTop - 12 - minY * scale;
        const start = Math.max(previous ? previous.end + 80 : 0, headingTop - window.innerHeight * 0.82);
        const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
        const end = Math.max(start + 1, Math.min(maxScroll, headingTop + artHeight - window.innerHeight * 0.38));
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
          const p = previous.point;
          const lead = Math.min(70, Math.max(12, (entry.y - p.y) / 4));
          const incoming = direction(false);
          // Match the artist's endpoint directions, then ease into the long
          // vertical connector. All cubic joins share a vertical tangent.
          const control = (point: Point, tangent: Point, sign: number) => ({
            x: Math.max(width - gutter + 12, Math.min(width - 20, point.x + tangent.x * 28 * sign)),
            y: point.y + tangent.y * 28 * sign,
          });
          const out = control(p, previous.tangent, 1);
          const into = control(entry, incoming, -1);
          const a = { x: p.x, y: p.y + lead };
          const b = { x: entry.x, y: entry.y - lead };
          const bend = Math.max(12, (b.y - a.y) / 2);
          segments.push({
            id: `to-${id}`,
            d: `M ${p.x} ${p.y} C ${out.x} ${out.y} ${a.x} ${a.y - lead / 2} ${a.x} ${a.y}`
              + ` C ${a.x} ${a.y + bend} ${b.x} ${b.y - bend} ${b.x} ${b.y}`
              + ` C ${b.x} ${b.y + lead / 2} ${into.x} ${into.y} ${entry.x} ${entry.y}`,
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
    for (const section of document.querySelectorAll('.section-shell')) observer.observe(section);
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
