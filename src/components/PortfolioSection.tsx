import React, { useLayoutEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

interface PortfolioSectionProps {
  isDark: boolean;
}

const SECTIONS = [
  { id: 'about',          label: 'About' },
  { id: 'skills',         label: 'Skills' },
  { id: 'experience',     label: 'Experience' },
  { id: 'projects',       label: 'Projects' },
  { id: 'certifications', label: 'Certifications' },
  { id: 'contact',        label: 'Contact' },
];

const projects = [
  { title: 'Project One',   tag: 'Web App',     desc: 'A short description of this project and the problem it solves.' },
  { title: 'Project Two',   tag: 'Design',      desc: 'A short description of this project and the problem it solves.' },
  { title: 'Project Three', tag: 'Open Source', desc: 'A short description of this project and the problem it solves.' },
  { title: 'Project Four',  tag: 'Experiment',  desc: 'A short description of this project and the problem it solves.' },
];

// Nav scaling tuning
const MAX_SCALE = 1.12;   // active (centred) item — stands out without overflowing
const MIN_SCALE = 0.62;   // far item
const FALLOFF   = 1.05;   // viewport-heights over which an item shrinks to MIN

const PortfolioSection: React.FC<PortfolioSectionProps> = ({ isDark }) => {
  const text     = isDark ? '#f3f4f6' : '#111827';
  const subtle   = isDark ? 'rgba(243,244,246,0.62)' : 'rgba(17,24,39,0.58)';
  const cardBg   = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(17,24,39,0.03)';
  const cardEdge = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(17,24,39,0.10)';

  const rootRef     = useRef<HTMLDivElement>(null);
  const navRef      = useRef<HTMLElement>(null);
  const navItemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const sectionRefs = useRef<(HTMLElement | null)[]>([]);

  useLayoutEffect(() => {
    const n = SECTIONS.length;
    // Target values written on scroll; current values lerped toward them
    // every frame so the font sizing glides smoothly between sections.
    const targetScale = new Array(n).fill(MIN_SCALE);
    const targetOpac  = new Array(n).fill(0.32);
    const curScale    = new Array(n).fill(MIN_SCALE);
    const curOpac     = new Array(n).fill(0.32);

    // Compute targets from scroll position (cheap; runs on every scroll tick)
    const updateTargets = () => {
      const vh = window.innerHeight;
      const center = vh / 2;

      // Reveal the nav midway through the hero→portfolio transition.
      const rootTop = rootRef.current?.getBoundingClientRect().top ?? vh;
      const visible = rootTop < vh * 0.45;
      if (navRef.current) {
        navRef.current.style.opacity = visible ? '1' : '0';
        navRef.current.style.pointerEvents = visible ? 'auto' : 'none';
      }

      let activeIdx = 0;
      let activeDist = Infinity;
      const dists = sectionRefs.current.map((sec, i) => {
        if (!sec) return Infinity;
        const r = sec.getBoundingClientRect();
        const secCenter = r.top + r.height / 2;
        const d = Math.abs(secCenter - center) / vh; // in viewport-heights
        if (d < activeDist) { activeDist = d; activeIdx = i; }
        return d;
      });

      for (let i = 0; i < n; i++) {
        const t = Math.min(dists[i] / FALLOFF, 1);   // 0 = centred, 1 = far
        const eased = t * t * (3 - 2 * t);            // smoothstep
        targetScale[i] = MAX_SCALE - eased * (MAX_SCALE - MIN_SCALE);
        targetOpac[i]  = 0.32 + (1 - eased) * 0.68;

        const el = navItemRefs.current[i];
        if (el) {
          const isActive = i === activeIdx;
          if (el.classList.contains('is-active') !== isActive) {
            el.classList.toggle('is-active', isActive);
          }
        }
      }
    };

    // Per-frame lerp toward targets — this is what makes sizing smooth.
    const SMOOTH = 0.12;
    let raf = 0;
    const render = () => {
      for (let i = 0; i < n; i++) {
        const el = navItemRefs.current[i];
        if (!el) continue;
        curScale[i] += (targetScale[i] - curScale[i]) * SMOOTH;
        curOpac[i]  += (targetOpac[i]  - curOpac[i])  * SMOOTH;
        el.style.transform = `scale(${curScale[i].toFixed(4)})`;
        el.style.opacity = curOpac[i].toFixed(3);
      }
      raf = requestAnimationFrame(render);
    };

    const st = ScrollTrigger.create({
      trigger: rootRef.current,
      start: 'top bottom',
      end: 'bottom top',
      onUpdate: updateTargets,
      onRefresh: updateTargets,
    });

    updateTargets();
    // One synchronous write so items have a correct transform on first paint
    // (before the rAF lerp loop takes over the smoothing).
    for (let i = 0; i < n; i++) {
      const el = navItemRefs.current[i];
      if (el) { el.style.transform = `scale(${curScale[i]})`; el.style.opacity = String(curOpac[i]); }
    }
    raf = requestAnimationFrame(render);
    window.addEventListener('resize', updateTargets);
    return () => {
      st.kill();
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', updateTargets);
    };
  }, []);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  return (
    <div
      ref={rootRef}
      style={{
        position: 'relative',
        zIndex: 1,
        // theme tokens consumed by .cine-nav__label in index.css
        ['--cine-idle' as string]:  isDark ? 'rgba(243,244,246,0.30)' : 'rgba(17,24,39,0.28)',
        ['--cine-hover' as string]: isDark ? 'rgba(243,244,246,0.70)' : 'rgba(17,24,39,0.65)',
        ['--text-circle' as string]: isDark ? '#cdd2f0' : '#3a3f63',
      }}
    >
      {/* ── Fixed cinematic side nav ─────────────────────────────── */}
      <nav
        ref={navRef}
        aria-label="Sections"
        className="fixed z-40 select-none"
        style={{
          left: 'clamp(0.9rem, 3.5vw, 3.5rem)',
          top: '50%',
          transform: 'translateY(-50%)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'clamp(1.1rem, 3vh, 2.3rem)',   // generous vertical spacing
          maxWidth: 'min(42vw, 22rem)',         // keep labels within the left column
          opacity: 0,                           // hidden over the hero; revealed on scroll
          pointerEvents: 'none',
          transition: 'opacity 0.5s ease',
        }}
      >
        {SECTIONS.map((s, i) => (
          <button
            key={s.id}
            ref={el => { navItemRefs.current[i] = el; }}
            onClick={() => scrollTo(s.id)}
            className="cine-nav__label pointer-events-auto text-left bg-transparent border-0 p-0 focus:outline-none"
            style={{ fontSize: 'clamp(0.95rem, 1.9vw, 1.6rem)' }}
          >
            {s.label}
          </button>
        ))}
      </nav>

      {/* ── Section panels ───────────────────────────────────────── */}
      <SectionShell id="about" idx={0} refCb={el => (sectionRefs.current[0] = el)}>
        <Eyebrow color={subtle}>Who I am</Eyebrow>
        <Heading color={text}>About</Heading>
        <Body color={subtle}>
          A short introduction about you — your background, what drives you, and the kind of work
          you love to build. Replace this with your own story.
        </Body>
      </SectionShell>

      <SectionShell id="skills" idx={1} refCb={el => (sectionRefs.current[1] = el)}>
        <Eyebrow color={subtle}>What I work with</Eyebrow>
        <Heading color={text}>Skills</Heading>
        <div className="mt-8 flex flex-wrap gap-3" style={{ maxWidth: '40rem' }}>
          {['React', 'TypeScript', 'GSAP', 'Framer Motion', 'WebGL', 'Node.js', 'Tailwind', 'Canvas 2D'].map(skill => (
            <motion.span
              key={skill}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.6 }}
              transition={{ duration: 0.4 }}
              className="px-4 py-2 rounded-full text-sm font-semibold"
              style={{ color: text, border: `1px solid ${cardEdge}`, backgroundColor: cardBg, fontFamily: '"Manrope", sans-serif' }}
            >
              {skill}
            </motion.span>
          ))}
        </div>
      </SectionShell>

      <SectionShell id="experience" idx={2} refCb={el => (sectionRefs.current[2] = el)}>
        <Eyebrow color={subtle}>Where I&apos;ve been</Eyebrow>
        <Heading color={text}>Experience</Heading>
        <div className="mt-8 flex flex-col gap-6" style={{ maxWidth: '42rem' }}>
          {[
            { role: 'Senior Engineer', org: 'Company A', span: '2023 — Present' },
            { role: 'Frontend Developer', org: 'Company B', span: '2021 — 2023' },
            { role: 'Junior Developer', org: 'Company C', span: '2019 — 2021' },
          ].map((job, i) => (
            <motion.div
              key={job.org}
              initial={{ opacity: 0, x: -24 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.5 }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className="rounded-2xl p-6 border backdrop-blur-sm"
              style={{ backgroundColor: cardBg, borderColor: cardEdge }}
            >
              <div className="flex items-baseline justify-between gap-4 flex-wrap">
                <h3 className="text-xl font-bold" style={{ color: text, fontFamily: '"Manrope", sans-serif' }}>{job.role}</h3>
                <span className="text-sm" style={{ color: subtle, fontFamily: '"Manrope", sans-serif' }}>{job.span}</span>
              </div>
              <p className="mt-1 text-base" style={{ color: subtle, fontFamily: '"Manrope", sans-serif' }}>{job.org}</p>
            </motion.div>
          ))}
        </div>
      </SectionShell>

      <SectionShell id="projects" idx={3} refCb={el => (sectionRefs.current[3] = el)}>
        <Eyebrow color={subtle}>Selected work</Eyebrow>
        <Heading color={text}>Projects</Heading>
        <div className="mt-10 grid gap-6 sm:grid-cols-2" style={{ maxWidth: '46rem' }}>
          {projects.map((p, i) => (
            <motion.article
              key={p.title}
              initial={{ opacity: 0, y: 36 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              whileHover={{ y: -6 }}
              className="group rounded-2xl p-7 border backdrop-blur-sm cursor-pointer"
              style={{ backgroundColor: cardBg, borderColor: cardEdge }}
            >
              <span
                className="inline-block text-xs font-semibold uppercase tracking-[0.18em] px-3 py-1 rounded-full"
                style={{ color: subtle, border: `1px solid ${cardEdge}`, fontFamily: '"Manrope", sans-serif' }}
              >
                {p.tag}
              </span>
              <h3 className="mt-5 text-2xl font-bold" style={{ color: text, fontFamily: '"Manrope", sans-serif' }}>{p.title}</h3>
              <p className="mt-3 text-base" style={{ color: subtle, fontFamily: '"Manrope", sans-serif' }}>{p.desc}</p>
            </motion.article>
          ))}
        </div>
      </SectionShell>

      <SectionShell id="certifications" idx={4} refCb={el => (sectionRefs.current[4] = el)}>
        <Eyebrow color={subtle}>Credentials</Eyebrow>
        <Heading color={text}>Certifications</Heading>
        <div className="mt-8 flex flex-col gap-4" style={{ maxWidth: '40rem' }}>
          {[
            { name: 'Certification One', by: 'Issuing Body', year: '2024' },
            { name: 'Certification Two', by: 'Issuing Body', year: '2023' },
            { name: 'Certification Three', by: 'Issuing Body', year: '2022' },
          ].map((c, i) => (
            <motion.div
              key={c.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.5 }}
              transition={{ duration: 0.45, delay: i * 0.07 }}
              className="rounded-xl px-6 py-4 border flex items-center justify-between gap-4"
              style={{ backgroundColor: cardBg, borderColor: cardEdge }}
            >
              <div>
                <h3 className="text-lg font-bold" style={{ color: text, fontFamily: '"Manrope", sans-serif' }}>{c.name}</h3>
                <p className="text-sm" style={{ color: subtle, fontFamily: '"Manrope", sans-serif' }}>{c.by}</p>
              </div>
              <span className="text-sm font-semibold" style={{ color: subtle, fontFamily: '"Manrope", sans-serif' }}>{c.year}</span>
            </motion.div>
          ))}
        </div>
      </SectionShell>

      <SectionShell id="contact" idx={5} refCb={el => (sectionRefs.current[5] = el)}>
        <Eyebrow color={subtle}>Say hello</Eyebrow>
        <Heading color={text}>Contact</Heading>
        <Body color={subtle}>
          The best way to reach me. Drop a line and let&apos;s build something.
        </Body>
        <motion.a
          href="mailto:hello@example.com"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: 0.4 }}
          className="mt-8 inline-flex items-center gap-2 px-7 py-3 rounded-full text-base font-semibold"
          style={{ color: isDark ? '#0b0b0f' : '#ffffff', backgroundColor: text, fontFamily: '"Manrope", sans-serif' }}
        >
          Get in touch
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </motion.a>
      </SectionShell>
    </div>
  );
};

/* ── Shared section scaffolding ───────────────────────────────────── */

const SectionShell: React.FC<{
  id: string;
  idx: number;
  refCb: (el: HTMLElement | null) => void;
  children: React.ReactNode;
}> = ({ id, refCb, children }) => (
  <section
    id={id}
    ref={refCb}
    className="relative w-full min-h-screen flex flex-col justify-center
               py-24 pr-6 sm:pr-10 lg:pr-20"
    style={{ paddingLeft: 'clamp(8.5rem, 26vw, 22rem)' }}
  >
    <div className="max-w-4xl">{children}</div>
  </section>
);

const Eyebrow: React.FC<{ color: string; children: React.ReactNode }> = ({ color, children }) => (
  <motion.p
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, amount: 0.6 }}
    transition={{ duration: 0.5 }}
    className="text-sm font-semibold uppercase tracking-[0.3em]"
    style={{ color, fontFamily: '"Manrope", sans-serif' }}
  >
    {children}
  </motion.p>
);

const Heading: React.FC<{ color: string; children: React.ReactNode }> = ({ color, children }) => (
  <motion.h2
    initial={{ opacity: 0, y: 28 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, amount: 0.5 }}
    transition={{ duration: 0.6, delay: 0.05 }}
    className="mt-4 font-extrabold leading-[1.04]"
    style={{ color, fontFamily: '"Manrope", sans-serif', fontSize: 'clamp(2.5rem, 7vw, 5.5rem)' }}
  >
    {children}
  </motion.h2>
);

const Body: React.FC<{ color: string; children: React.ReactNode }> = ({ color, children }) => (
  <motion.p
    initial={{ opacity: 0, y: 24 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, amount: 0.5 }}
    transition={{ duration: 0.5, delay: 0.12 }}
    className="mt-6 max-w-2xl text-lg"
    style={{ color, fontFamily: '"Manrope", sans-serif' }}
  >
    {children}
  </motion.p>
);

export default PortfolioSection;
