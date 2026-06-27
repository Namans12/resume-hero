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
  { id: 'achievements',   label: 'Achievements' },
  { id: 'certifications', label: 'Certifications' },
  { id: 'contact',        label: 'Contact' },
];

/* ── Résumé content ───────────────────────────────────────────────── */

const EMAIL = 'namanshrimal12@gmail.com';
const PHONE = '+91 74249 91005';

const SOCIALS = [
  { label: 'GitHub',   href: 'https://github.com/Namans12',                    icon: 'github' },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/in/naman-shrimal12/',   icon: 'linkedin' },
  { label: 'Website',  href: 'https://naman1201.vercel.app/',                  icon: 'globe' },
];

const skillGroups = [
  { label: 'Languages',               items: ['Python', 'SQL', 'JavaScript', 'TypeScript', 'HTML / CSS'] },
  { label: 'Frameworks & ML',         items: ['React', 'FastAPI', 'TensorFlow', 'Keras', 'OpenCV', 'Matplotlib'] },
  { label: 'Data Engineering',        items: ['Databricks', 'Apache Spark', 'PySpark', 'Delta Lake', 'Azure Data Factory', 'Microsoft Fabric'] },
  { label: 'Concepts & Architecture', items: ['ETL / ELT Pipelines', 'Lakehouse Architecture', 'Data Warehousing', 'Agentic AI'] },
  { label: 'Cloud & DevOps',          items: ['Microsoft Azure', 'Google Cloud', 'Docker', 'Terraform', 'GitHub'] },
  { label: 'Databases',               items: ['SQLite', 'Neo4j', 'MySQL'] },
];

const experience = [
  {
    role: 'Software Engineer',
    org: 'Navikenz Ltd.',
    span: 'Mar 2025 - Present',
    location: 'Hybrid · Noida',
    note: 'Promoted from Intern · Oct 2025',
    points: [
      'Earned the Databricks Certified Data Engineer Associate cert via structured training in Apache Spark, PySpark, Delta Lake & Lakehouse Architecture - applied directly to production ETL workflows.',
      'Designed & delivered a Data Ingestion Framework POC on Databricks + Delta Lake, automating ETL pipelines across multiple sources and standardizing ingestion for high-performance internal analytics.',
      'Conducted end-to-end QA for a client-facing Agentic AI data ingestion pipeline - validating transformation logic, data accuracy & system reliability across the full lifecycle under production conditions.',
      'Developed a Data Deduplication Detection POC using ML-based similarity & hashing to identify and eliminate redundant records at scale.',
      'Led the Navisphere POC - migrated Databricks analytics workloads to a React self-serve web interface, cutting analyst dependency for ad-hoc warehousing queries.',
    ],
  },
];

const projects = [
  {
    title: 'NaviMed Scheduler',
    tag: 'Reinforcement Learning · Healthcare',
    desc: 'A smart patient appointment system. A PPO agent trained for 500k timesteps in a simulated 3-doctor, 32-slot/day clinic - with emergencies, priority tiers and no-show risk - hit 100% scheduling success (37.35 avg reward, ~4× the untrained baseline). FastAPI microservices serve RL inference, no-show scoring over a 110k-appointment dataset, and ARIMA demand forecasting to a Next.js dashboard, with an LLM chatbot for booking & rescheduling.',
    stack: ['Python', 'FastAPI', 'Stable-Baselines3', 'Next.js', 'ARIMA', 'SQLite'],
    href: 'https://github.com/Namans12/NaviMed-Scheduler',
  },
  {
    title: 'SignaText',
    tag: 'Computer Vision · NLP',
    desc: 'Real-time American Sign Language to text. A 27-class CNN (843K params) recognizes fingerspelling through a two-stage pipeline - a main CNN plus letter-group classifiers for visually similar pairs - gated by a 50-frame stability window, running 30+ FPS on CPU. NLP post-processing assembles recognized letters into coherent words and sentences.',
    stack: ['TensorFlow', 'Keras', 'OpenCV', 'MediaPipe', 'CNN'],
    href: 'https://github.com/Namans12/SignaText',
  },
];

const achievements = [
  { title: 'Finalist - Lumen Hackathon',                detail: 'Shortlisted for interview and received an internship offer.' },
  { title: '2nd Place - Formidium Hackathon',           detail: 'Blockchain & AI category.' },
  { title: '2nd Place - Honeywell International Hackathon', detail: 'National-level engineering challenge.' },
  { title: 'Published Research',                         detail: 'Faster Multi-Document Summarization using Primera & Pegasus NLP models.' },
];

const certifications = [
  { name: 'Databricks Certified Data Engineer Associate', by: 'Databricks' },
  { name: 'Azure AI Engineer Associate',                  by: 'Microsoft' },
  { name: 'Azure AI Fundamentals',                        by: 'Microsoft' },
  { name: 'Introduction to Generative AI',                by: 'Google Cloud' },
];

// Nav scaling tuning
const MAX_SCALE = 1.12;   // active (centred) item - stands out without overflowing
const MIN_SCALE = 0.62;   // far item
const FALLOFF   = 1.05;   // viewport-heights over which an item shrinks to MIN

const PortfolioSection: React.FC<PortfolioSectionProps> = ({ isDark }) => {
  const text     = isDark ? '#f3f4f6' : '#111827';
  const subtle   = isDark ? 'rgba(243,244,246,0.62)' : 'rgba(17,24,39,0.58)';
  const cardBg   = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(17,24,39,0.03)';
  const cardEdge = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(17,24,39,0.10)';
  const accent   = isDark ? '#8ea2ff' : '#4f46e5';

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

    // Per-frame lerp toward targets - this is what makes sizing smooth.
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

  const font = '"Manrope", sans-serif';

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
          gap: 'clamp(0.9rem, 2.6vh, 2rem)',   // generous vertical spacing
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
            style={{ fontSize: 'clamp(0.85rem, 1.75vw, 1.5rem)' }}
          >
            {s.label}
          </button>
        ))}
      </nav>

      {/* ── Section panels ───────────────────────────────────────── */}
      <SectionShell id="about" refCb={el => (sectionRefs.current[0] = el)}>
        <Eyebrow color={subtle}>Who I am</Eyebrow>
        <Heading color={text}>About</Heading>
        <Body color={subtle}>
          I&apos;m <strong style={{ color: text }}>Naman Shrimal</strong> - a Software Engineer at Navikenz
          building data engineering and AI systems, from production ETL pipelines on Databricks &amp; Delta Lake
          to client-facing Agentic AI workflows. I like turning messy data into reliable, intelligent products.
        </Body>

        <motion.div
          initial={{ opacity: 0, y: 22 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="mt-8 rounded-2xl p-6 border backdrop-blur-sm"
          style={{ backgroundColor: cardBg, borderColor: cardEdge, maxWidth: '38rem' }}
        >
          <p className="text-xs font-semibold uppercase tracking-[0.22em]" style={{ color: accent, fontFamily: font }}>
            Education
          </p>
          <h3 className="mt-2 text-xl font-bold" style={{ color: text, fontFamily: font }}>
            B.Tech - Computer Science &amp; Engineering (AI &amp; ML)
          </h3>
          <p className="mt-1 text-base" style={{ color: subtle, fontFamily: font }}>
            Jain (Deemed-to-be University), Bengaluru
          </p>
          <p className="mt-1 text-sm" style={{ color: subtle, fontFamily: font }}>
            2021 - 2025 · CGPA 8.10 / 10
          </p>
        </motion.div>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-6 text-base"
          style={{ color: subtle, fontFamily: font, maxWidth: '38rem' }}
        >
          Beyond the keyboard, I volunteer with <strong style={{ color: text }}>Prayas</strong> (underprivileged
          education &amp; healthcare) and the <strong style={{ color: text }}>Go Nirvana Foundation</strong> (animal welfare).
        </motion.p>
      </SectionShell>

      <SectionShell id="skills" refCb={el => (sectionRefs.current[1] = el)}>
        <Eyebrow color={subtle}>What I work with</Eyebrow>
        <Heading color={text}>Skills</Heading>
        <div className="mt-8 flex flex-col gap-7" style={{ maxWidth: '44rem' }}>
          {skillGroups.map((group, gi) => (
            <motion.div
              key={group.label}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.45, delay: gi * 0.05 }}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.22em] mb-3" style={{ color: accent, fontFamily: font }}>
                {group.label}
              </p>
              <div className="flex flex-wrap gap-2.5">
                {group.items.map(skill => (
                  <span
                    key={skill}
                    className="px-3.5 py-1.5 rounded-full text-sm font-semibold"
                    style={{ color: text, border: `1px solid ${cardEdge}`, backgroundColor: cardBg, fontFamily: font }}
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </SectionShell>

      <SectionShell id="experience" refCb={el => (sectionRefs.current[2] = el)}>
        <Eyebrow color={subtle}>Where I&apos;ve been</Eyebrow>
        <Heading color={text}>Experience</Heading>
        <div className="mt-8 flex flex-col gap-6" style={{ maxWidth: '46rem' }}>
          {experience.map((job, i) => (
            <motion.div
              key={job.org}
              initial={{ opacity: 0, x: -24 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className="rounded-2xl p-6 sm:p-7 border backdrop-blur-sm"
              style={{ backgroundColor: cardBg, borderColor: cardEdge }}
            >
              <div className="flex items-baseline justify-between gap-4 flex-wrap">
                <h3 className="text-xl font-bold" style={{ color: text, fontFamily: font }}>
                  {job.role} <span style={{ color: accent }}>· {job.org}</span>
                </h3>
                <span className="text-sm whitespace-nowrap" style={{ color: subtle, fontFamily: font }}>{job.span}</span>
              </div>
              <div className="mt-1 flex items-center gap-2 flex-wrap text-sm" style={{ color: subtle, fontFamily: font }}>
                <span>{job.location}</span>
                <span aria-hidden>•</span>
                <span>{job.note}</span>
              </div>
              <ul className="mt-5 flex flex-col gap-3">
                {job.points.map((pt, pi) => (
                  <li key={pi} className="flex gap-3 text-[0.95rem] leading-relaxed" style={{ color: subtle, fontFamily: font }}>
                    <span className="mt-2 shrink-0 w-1.5 h-1.5 rounded-full" style={{ backgroundColor: accent }} />
                    <span>{pt}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </SectionShell>

      <SectionShell id="projects" refCb={el => (sectionRefs.current[3] = el)}>
        <Eyebrow color={subtle}>Selected work</Eyebrow>
        <Heading color={text}>Projects</Heading>
        <div className="mt-10 grid gap-6 sm:grid-cols-2" style={{ maxWidth: '50rem' }}>
          {projects.map((p, i) => (
            <motion.a
              key={p.title}
              href={p.href}
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, y: 36 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              whileHover={{ y: -6 }}
              className="group rounded-2xl p-7 border backdrop-blur-sm cursor-pointer flex flex-col no-underline"
              style={{ backgroundColor: cardBg, borderColor: cardEdge }}
            >
              <div className="flex items-start justify-between gap-3">
                <span
                  className="inline-block text-xs font-semibold uppercase tracking-[0.16em] px-3 py-1 rounded-full"
                  style={{ color: subtle, border: `1px solid ${cardEdge}`, fontFamily: font }}
                >
                  {p.tag}
                </span>
                <span
                  className="shrink-0 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                  style={{ color: subtle }}
                  aria-hidden
                >
                  <Icon name="github" size={20} />
                </span>
              </div>
              <h3 className="mt-5 text-2xl font-bold" style={{ color: text, fontFamily: font }}>{p.title}</h3>
              <p className="mt-3 text-[0.95rem] leading-relaxed" style={{ color: subtle, fontFamily: font }}>{p.desc}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                {p.stack.map(s => (
                  <span
                    key={s}
                    className="px-2.5 py-1 rounded-md text-xs font-semibold"
                    style={{ color: subtle, backgroundColor: cardBg, border: `1px solid ${cardEdge}`, fontFamily: font }}
                  >
                    {s}
                  </span>
                ))}
              </div>
            </motion.a>
          ))}
        </div>
      </SectionShell>

      <SectionShell id="achievements" refCb={el => (sectionRefs.current[4] = el)}>
        <Eyebrow color={subtle}>Highlights</Eyebrow>
        <Heading color={text}>Achievements</Heading>
        <div className="mt-8 grid gap-4 sm:grid-cols-2" style={{ maxWidth: '46rem' }}>
          {achievements.map((a, i) => (
            <motion.div
              key={a.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.45, delay: i * 0.07 }}
              className="rounded-2xl p-6 border backdrop-blur-sm flex gap-4"
              style={{ backgroundColor: cardBg, borderColor: cardEdge }}
            >
              <span className="shrink-0 mt-0.5" style={{ color: accent }} aria-hidden>
                <Icon name="trophy" size={22} />
              </span>
              <div>
                <h3 className="text-base font-bold leading-snug" style={{ color: text, fontFamily: font }}>{a.title}</h3>
                {a.detail && <p className="mt-1.5 text-sm leading-relaxed" style={{ color: subtle, fontFamily: font }}>{a.detail}</p>}
              </div>
            </motion.div>
          ))}
        </div>
      </SectionShell>

      <SectionShell id="certifications" refCb={el => (sectionRefs.current[5] = el)}>
        <Eyebrow color={subtle}>Credentials</Eyebrow>
        <Heading color={text}>Certifications</Heading>
        <div className="mt-8 flex flex-col gap-4" style={{ maxWidth: '42rem' }}>
          {certifications.map((c, i) => (
            <motion.div
              key={c.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.5 }}
              transition={{ duration: 0.45, delay: i * 0.07 }}
              className="rounded-xl px-6 py-4 border flex items-center gap-4"
              style={{ backgroundColor: cardBg, borderColor: cardEdge }}
            >
              <span className="shrink-0" style={{ color: accent }} aria-hidden>
                <Icon name="badge" size={24} />
              </span>
              <div className="min-w-0">
                <h3 className="text-lg font-bold leading-snug" style={{ color: text, fontFamily: font }}>{c.name}</h3>
                <p className="text-sm" style={{ color: subtle, fontFamily: font }}>{c.by}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </SectionShell>

      <SectionShell id="contact" refCb={el => (sectionRefs.current[6] = el)}>
        <Eyebrow color={subtle}>Say hello</Eyebrow>
        <Heading color={text}>Contact</Heading>
        <Body color={subtle}>
          Always happy to talk data engineering, ML, or a good problem worth solving. Drop a line -
          let&apos;s build something.
        </Body>

        <motion.a
          href={`mailto:${EMAIL}`}
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: 0.4 }}
          className="mt-8 inline-flex items-center gap-2 px-7 py-3 rounded-full text-base font-semibold no-underline"
          style={{ color: isDark ? '#0b0b0f' : '#ffffff', backgroundColor: text, fontFamily: font }}
        >
          {EMAIL}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </motion.a>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="mt-6 flex flex-wrap items-center gap-3"
        >
          {SOCIALS.map(s => (
            <a
              key={s.label}
              href={s.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold no-underline transition-colors"
              style={{ color: text, border: `1px solid ${cardEdge}`, backgroundColor: cardBg, fontFamily: font }}
            >
              <Icon name={s.icon} size={18} />
              {s.label}
            </a>
          ))}
          <span className="text-sm" style={{ color: subtle, fontFamily: font }}>{PHONE}</span>
        </motion.div>
      </SectionShell>
    </div>
  );
};

/* ── Inline icons (currentColor, theme-aware) ─────────────────────── */

const Icon: React.FC<{ name: string; size?: number }> = ({ name, size = 20 }) => {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none' as const };
  switch (name) {
    case 'github':
      return (
        <svg {...common} fill="currentColor">
          <path fillRule="evenodd" clipRule="evenodd" d="M12 1.5a10.5 10.5 0 0 0-3.32 20.46c.53.1.72-.23.72-.5v-1.76c-2.92.63-3.54-1.4-3.54-1.4-.48-1.22-1.17-1.55-1.17-1.55-.96-.65.07-.64.07-.64 1.06.08 1.62 1.09 1.62 1.09.94 1.62 2.47 1.15 3.07.88.1-.68.37-1.15.67-1.42-2.33-.26-4.78-1.16-4.78-5.18 0-1.15.41-2.08 1.08-2.82-.11-.27-.47-1.34.1-2.78 0 0 .88-.28 2.88 1.07a10 10 0 0 1 5.24 0c2-1.35 2.88-1.07 2.88-1.07.57 1.44.21 2.51.1 2.78.68.74 1.08 1.67 1.08 2.82 0 4.03-2.46 4.92-4.8 5.18.38.32.71.97.71 1.96v2.9c0 .28.19.61.73.5A10.5 10.5 0 0 0 12 1.5Z" />
        </svg>
      );
    case 'linkedin':
      return (
        <svg {...common} fill="currentColor">
          <path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9h4v12H3V9Zm6 0h3.8v1.64h.05c.53-.95 1.83-1.95 3.77-1.95 4.03 0 4.78 2.49 4.78 5.73V21h-4v-5.66c0-1.35-.03-3.08-1.97-3.08-1.97 0-2.27 1.46-2.27 2.98V21H9V9Z" />
        </svg>
      );
    case 'globe':
      return (
        <svg {...common} stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3c2.5 2.5 2.5 15 0 18M12 3c-2.5 2.5-2.5 15 0 18" />
        </svg>
      );
    case 'trophy':
      return (
        <svg {...common} stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4Z" />
          <path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3" />
        </svg>
      );
    case 'badge':
      return (
        <svg {...common} stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="9" r="6" />
          <path d="m8.5 13.5-1 7 4.5-2.5 4.5 2.5-1-7" />
          <path d="m9.5 9 1.7 1.7L14.5 7.5" />
        </svg>
      );
    default:
      return null;
  }
};

/* ── Shared section scaffolding ───────────────────────────────────── */

const SectionShell: React.FC<{
  id: string;
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
