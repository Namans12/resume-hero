import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence, MotionConfig } from 'framer-motion';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import ProjectsCarousel from './ProjectsCarousel';

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

// Formspree form endpoint. Create a free form at https://formspree.io/ and paste
// its URL here (it's a public form ID, safe to commit). Until it's set, the form
// shows a "not configured yet" notice instead of silently failing.
const FORMSPREE_ENDPOINT = 'https://formspree.io/f/YOUR_FORM_ID';

const SOCIALS = [
  { label: 'GitHub',   href: 'https://github.com/Namans12',                  icon: 'github' },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/in/naman-shrimal12/', icon: 'linkedin' },
];

const LOCATIONS = [
  { label: 'Work', place: 'Noida, India' },
  { label: 'Home', place: 'Jaipur, India' },
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
  {
    role: 'Research & Development',
    org: 'Independent Projects',
    span: 'July 2023 - Feb 2025',
    points: [
      { text: 'Authored and published a research paper on a faster multi-document hybrid summarization model built on Primera and Pegasus.', readMore: 'Read More', href: '' },
      'Designed and trained models across NLP, computer vision, and reinforcement learning - with TensorFlow, Keras, and PPO.',
      'Engineered RESTful APIs in FastAPI, layering in authentication, custom middleware, and SQLAlchemy-backed persistence.',
      'Earned an internship offer as a finalist at the Lumen hackathon, and placed 2nd at the national Honeywell engineering challenge and the Formidium hackathon.',
    ],
  },
];

const achievements = [
  { title: 'Finalist - Lumen Hackathon',                detail: 'Shortlisted for interview and received an internship offer.' },
  { title: 'Published Research',                         detail: 'Faster Multi-Document Summarization using Primera & Pegasus NLP models.' },
  { title: '2nd Place - Honeywell International Hackathon', detail: 'National-level engineering challenge.' },
  { title: '2nd Place - Formidium Hackathon',           detail: 'Blockchain & AI category.' },
];

const certifications = [
  { name: 'Databricks Certified Data Engineer Associate', by: 'Databricks',   brand: 'databricks' },
  { name: 'Azure AI Engineer Associate',                  by: 'Microsoft',    brand: 'microsoft' },
  { name: 'Azure AI Fundamentals',                        by: 'Microsoft',    brand: 'microsoft' },
  { name: 'Introduction to Generative AI',                by: 'Google Cloud', brand: 'google' },
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
    // Hash targets do not exist until this lazy chunk mounts.
    const id = window.location.hash.slice(1);
    if (!SECTIONS.some(section => section.id === id)) return;
    const frame = requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'instant', block: 'start' });
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  /* One stable callback per slot, created once. Inline `el => (refs[i] = el)`
     arrows are a fresh identity on every render, so React detached and
     reattached all 14 refs (calling each with null, then the element) on
     every single re-render - which used to be once per scroll frame. */
  const setSectionRef = useMemo(
    () => SECTIONS.map((_, i) => (el: HTMLElement | null) => { sectionRefs.current[i] = el; }),
    [],
  );
  const setNavItemRef = useMemo(
    () => SECTIONS.map((_, i) => (el: HTMLButtonElement | null) => { navItemRefs.current[i] = el; }),
    [],
  );

  useLayoutEffect(() => {
    const n = SECTIONS.length;
    // Target values written on scroll; current values lerped toward them
    // every frame so the font sizing glides smoothly between sections.
    const targetScale = new Array(n).fill(MIN_SCALE);
    const targetOpac  = new Array(n).fill(0.65);
    const curScale    = new Array(n).fill(MIN_SCALE);
    const curOpac     = new Array(n).fill(0.65);

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
        navRef.current.inert = !visible;
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
        // Floor raised so far items stay legible; depth now comes mainly from scale.
        targetOpac[i]  = 0.65 + (1 - eased) * 0.35;

        const el = navItemRefs.current[i];
        if (el) {
          const isActive = i === activeIdx;
          if (el.classList.contains('is-active') !== isActive) {
            el.classList.toggle('is-active', isActive);
          }
        }
      }
    };

    /* Per-frame lerp toward targets - this is what makes sizing smooth. It
       used to be an unconditional rAF: 14 style writes plus two toFixed()
       allocations every frame for the whole session, including while the nav
       sits at opacity 0 over the hero and long after the values converged.
       Now it parks once every item is within a sub-pixel of its target, and
       updateTargets() kicks it awake. */
    const SMOOTH = 0.12;
    const EPS_SCALE = 0.0002;
    const EPS_OPAC = 0.0015;
    let raf = 0;
    const render = () => {
      let moving = false;
      for (let i = 0; i < n; i++) {
        const el = navItemRefs.current[i];
        if (!el) continue;
        const ds = targetScale[i] - curScale[i];
        const do_ = targetOpac[i] - curOpac[i];
        if (Math.abs(ds) < EPS_SCALE && Math.abs(do_) < EPS_OPAC) {
          if (curScale[i] !== targetScale[i] || curOpac[i] !== targetOpac[i]) {
            // snap the residue so the parked state is exact
            curScale[i] = targetScale[i];
            curOpac[i] = targetOpac[i];
            el.style.transform = `scale(${curScale[i].toFixed(4)})`;
            el.style.opacity = curOpac[i].toFixed(3);
          }
          continue;
        }
        moving = true;
        curScale[i] += ds * SMOOTH;
        curOpac[i]  += do_ * SMOOTH;
        el.style.transform = `scale(${curScale[i].toFixed(4)})`;
        el.style.opacity = curOpac[i].toFixed(3);
      }
      raf = moving ? requestAnimationFrame(render) : 0;
    };
    const kick = () => { if (!raf) raf = requestAnimationFrame(render); };

    const onScrollUpdate = () => { updateTargets(); kick(); };
    const st = ScrollTrigger.create({
      trigger: rootRef.current,
      start: 'top bottom',
      end: 'bottom top',
      onUpdate: onScrollUpdate,
      onRefresh: onScrollUpdate,
    });

    updateTargets();
    // One synchronous write so items have a correct transform on first paint
    // (before the rAF lerp loop takes over the smoothing).
    for (let i = 0; i < n; i++) {
      const el = navItemRefs.current[i];
      if (el) { el.style.transform = `scale(${curScale[i]})`; el.style.opacity = String(curOpac[i]); }
    }
    kick();
    window.addEventListener('resize', onScrollUpdate);
    return () => {
      st.kill();
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onScrollUpdate);
    };
  }, []);

  const scrollTo = (id: string) => {
    const section = document.getElementById(id);
    if (!section) return;
    // Centering a section taller than the viewport clips its heading and art.
    const tall = section.getBoundingClientRect().height > window.innerHeight + 1;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    section.scrollIntoView({ behavior: reduced ? 'instant' : 'smooth', block: tall ? 'start' : 'center' });
  };

  const font = '"Manrope", sans-serif';

  const footerLinks = [
    { label: 'Email',    href: `mailto:${EMAIL}`, icon: 'mail',     external: false },
    ...SOCIALS.map(s => ({ label: s.label, href: s.href, icon: s.icon, external: true })),
  ];

  return (
    /* Every entrance animation in here is a framer-motion `whileInView`,
       which is JS-driven and so untouched by the reduced-motion CSS rule in
       index.css. reducedMotion="user" makes framer-motion read the OS
       setting itself: transforms are dropped and only opacity is animated. */
    <MotionConfig reducedMotion="user">
    <div
      ref={rootRef}
      style={{
        position: 'relative',
        zIndex: 1,
        // theme tokens consumed by .cine-nav__label in index.css
        ['--cine-idle' as string]:  isDark ? 'rgba(243,244,246,0.62)' : 'rgba(17,24,39,0.58)',
        ['--cine-hover' as string]: isDark ? 'rgba(243,244,246,0.95)' : 'rgba(17,24,39,0.90)',
        ['--text-circle' as string]: isDark ? '#cdd2f0' : '#3a3f63',
      }}
    >
      {/* ── Fixed cinematic side nav ─────────────────────────────── */}
      <nav
        ref={navRef}
        aria-label="Sections"
        className="fixed z-40 select-none hidden lg:flex lg:flex-col"
        style={{
          left: 'clamp(0.9rem, 3.5vw, 3.5rem)',
          top: '50%',
          transform: 'translateY(-50%)',
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
            ref={setNavItemRef[i]}
            onClick={() => scrollTo(s.id)}
            className="cine-nav__label pointer-events-auto text-left bg-transparent border-0 p-0 focus:outline-none"
            style={{ fontSize: 'clamp(0.85rem, 1.75vw, 1.5rem)' }}
          >
            {s.label}
          </button>
        ))}
      </nav>

      {/* ── Section panels ───────────────────────────────────────── */}
      <SectionShell id="about" refCb={setSectionRef[0]}>
        <Eyebrow color={subtle}>Who I am</Eyebrow>
        <Heading color={text}>About</Heading>
        <Body color={subtle}>
          I&apos;m <strong style={{ color: text }}>Naman Shrimal</strong> - a Software Engineer at Navikenz
          building data engineering and AI systems, from production ETL pipelines on Databricks &amp; Delta Lake
          to client-facing Agentic AI workflows. What drives me is a humanity-first approach: an early curiosity
          about how AI could tackle the world&apos;s biggest challenges has grown into a mission to build systems
          that improve real lives - from&nbsp;reinforcement learning for healthcare scheduling to making sign language
          accessible as text. At the core of it, I turn messy data into reliable, intelligent products.
        </Body>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: 0.45, delay: 0.18 }}
          className="mt-8 flex flex-wrap items-center gap-3"
        >
          <button
            type="button"
            onClick={() => scrollTo('projects')}
            className="inline-flex items-center gap-2 px-7 py-3 rounded-full text-base font-semibold transition-transform duration-200 hover:-translate-y-0.5"
            style={{ color: isDark ? '#0b0b0f' : '#ffffff', backgroundColor: text, fontFamily: font }}
          >
            View my work
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <a
            href="https://drive.google.com/file/d/1rX41qJsjLWSNjC9Q6jg7srcoSxN2rxCL/view?usp=sharing"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-7 py-3 rounded-full text-base font-semibold no-underline transition-transform duration-200 hover:-translate-y-0.5"
            style={{ color: text, border: `1px solid ${cardEdge}`, backgroundColor: cardBg, fontFamily: font }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 3v4a1 1 0 0 0 1 1h4" />
              <path d="M16 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
              <path d="M9 13h6M9 17h4" />
            </svg>
            My resume
          </a>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 22 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="mt-8 rounded-2xl p-6 border backdrop-blur-sm"
          style={{ backgroundColor: cardBg, borderColor: cardEdge, maxWidth: '44rem' }}
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
          style={{ color: subtle, fontFamily: font, maxWidth: '51rem' }}
        >
          Beyond the keyboard, I volunteer with <strong style={{ color: text }}>Prayas</strong> (underprivileged
          education &amp; healthcare) and the <strong style={{ color: text }}>Go Nirvana Foundation</strong> (animal welfare).
        </motion.p>
      </SectionShell>

      <SectionShell id="skills" refCb={setSectionRef[1]}>
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

      <SectionShell id="experience" refCb={setSectionRef[2]}>
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
              {(job.location || job.note) && (
                <div className="mt-1 flex items-center gap-2 flex-wrap text-sm" style={{ color: subtle, fontFamily: font }}>
                  {job.location && <span>{job.location}</span>}
                  {job.location && job.note && <span aria-hidden>•</span>}
                  {job.note && <span>{job.note}</span>}
                </div>
              )}
              <ul className="mt-5 flex flex-col gap-3">
                {job.points.map((pt, pi) => (
                  <li key={pi} className="flex gap-3 text-[0.95rem] leading-relaxed" style={{ color: subtle, fontFamily: font }}>
                    <span className="mt-2 shrink-0 w-1.5 h-1.5 rounded-full" style={{ backgroundColor: accent }} />
                    <span>
                      {typeof pt === 'string' ? pt : (
                        <>
                          {pt.text}
                          {pt.href && (
                            <>
                              {' '}
                              <a
                                href={pt.href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-semibold no-underline hover:underline"
                                style={{ color: accent }}
                              >
                                {pt.readMore ?? 'Read More'}
                              </a>
                            </>
                          )}
                        </>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </SectionShell>

      <SectionShell id="projects" refCb={setSectionRef[3]}>
        <Eyebrow color={subtle}>Selected work</Eyebrow>
        <Heading color={text}>Projects</Heading>
        <ProjectsCarousel isDark={isDark} />
      </SectionShell>

      <SectionShell id="achievements" refCb={setSectionRef[4]}>
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
              <span className="shrink-0 mt-0.5" style={{ color: i < 2 ? '#D4AF37' : '#C0C0C0' }} aria-hidden>
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

      <SectionShell id="certifications" refCb={setSectionRef[5]}>
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
              <span className="shrink-0 inline-flex" aria-hidden>
                <BrandLogo brand={c.brand} size={28} />
              </span>
              <div className="min-w-0">
                <h3 className="text-lg font-bold leading-snug" style={{ color: text, fontFamily: font }}>{c.name}</h3>
                <p className="text-sm" style={{ color: subtle, fontFamily: font }}>{c.by}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </SectionShell>

      <SectionShell id="contact" refCb={setSectionRef[6]}>
        <Eyebrow color={subtle}>Say hello</Eyebrow>
        <Heading color={text}>Contact</Heading>

        <div className="mt-8 grid gap-10 xl:grid-cols-2 xl:items-start" style={{ maxWidth: '54rem' }}>
          {/* Left - intro + direct links */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.45 }}
          >
            <p className="text-base sm:text-lg leading-relaxed" style={{ color: subtle, fontFamily: font, maxWidth: '30rem' }}>
              Always happy to talk data engineering, ML, or a good problem worth solving. Use the form,
              or reach out directly.
            </p>

            <a
              href={`mailto:${EMAIL}`}
              className="mt-7 inline-flex items-center gap-2 px-7 py-3 rounded-full text-base font-semibold no-underline"
              style={{ color: isDark ? '#0b0b0f' : '#ffffff', backgroundColor: text, fontFamily: font }}
            >
              {EMAIL}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>

            <div className="mt-6 flex flex-wrap items-center gap-3">
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
              <LocationPill text={text} cardBg={cardBg} cardEdge={cardEdge} accent={accent} subtle={subtle} font={font} />
              <span className="text-sm" style={{ color: subtle, fontFamily: font }}>{PHONE}</span>
            </div>
          </motion.div>

          {/* Right - Formspree-backed contact form */}
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <ContactForm isDark={isDark} text={text} subtle={subtle} cardBg={cardBg} cardEdge={cardEdge} accent={accent} font={font} />
          </motion.div>
        </div>
      </SectionShell>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <footer
        className="relative w-full px-6 sm:px-10 pt-2.5 pb-3"
        style={{
          borderTop: `1px solid ${cardEdge}`,
          ['--foot-edge' as string]:   cardEdge,
          ['--foot-bg' as string]:     cardBg,
          ['--foot-idle' as string]:   subtle,
          ['--foot-accent' as string]: accent,
        }}
      >
        <div className="mx-auto grid max-w-5xl grid-cols-1 sm:grid-cols-3 items-center gap-6">
          {/* Left - name */}
          <a
            href="#about"
            onClick={(e) => { e.preventDefault(); scrollTo('about'); }}
            className="text-lg font-extrabold no-underline justify-self-center sm:justify-self-start"
            style={{ color: text, fontFamily: font, letterSpacing: '-0.01em' }}
          >
            Naman Shrimal
          </a>

          {/* Center - social icons */}
          <nav aria-label="Social links" className="flex items-center gap-3 justify-self-center">
            {footerLinks.map(l => (
              <a
                key={l.label}
                href={l.href}
                aria-label={l.label}
                {...(l.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                className="footer-soc inline-flex items-center justify-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                style={{ width: 46, height: 46 }}
              >
                <Icon name={l.icon} size={20} />
              </a>
            ))}
          </nav>

          {/* Right - copyright */}
          <p
            className="text-sm leading-relaxed justify-self-center sm:justify-self-end text-center sm:text-right"
            style={{ color: subtle, fontFamily: font }}
          >
            © {new Date().getFullYear()} Naman Shrimal ·<br />
            All Rights Reserved.
          </p>
        </div>
      </footer>
    </div>
    </MotionConfig>
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
    case 'location':
      return (
        <svg {...common} stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 21s-6-5.2-6-10a6 6 0 0 1 12 0c0 4.8-6 10-6 10Z" />
          <circle cx="12" cy="11" r="2.2" />
        </svg>
      );
    case 'swap':
      return (
        <svg {...common} stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 4 3 8l4 4" />
          <path d="M3 8h14" />
          <path d="m17 20 4-4-4-4" />
          <path d="M21 16H7" />
        </svg>
      );
    case 'mail':
      return (
        <svg {...common} stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="m3.5 7 8.5 6 8.5-6" />
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

/* Certification provider logos, in their brand colours. (Microsoft / Azure are
   absent from most icon sets for brand-policy reasons, so it's inlined here.) */
const BrandLogo: React.FC<{ brand: string; size?: number }> = ({ brand, size = 28 }) => {
  switch (brand) {
    case 'databricks':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" role="img" aria-label="Databricks">
          <path fill="#FF3621" d="M.95 14.184L12 20.403l9.919-5.55v2.21L12 22.662l-10.484-5.96-.565.308v.77L12 24l11.05-6.218v-4.317l-.515-.309L12 19.118l-9.867-5.653v-2.21L12 16.805l11.05-6.218V6.32l-.515-.308L12 11.974 2.647 6.681 12 1.388l7.76 4.368.668-.411v-.566L12 0 .95 6.27v.72L12 13.207l9.919-5.55v2.26L12 15.52 1.516 9.56l-.565.308Z" />
        </svg>
      );
    case 'microsoft':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" role="img" aria-label="Microsoft">
          <rect x="1"  y="1"  width="10" height="10" fill="#F25022" />
          <rect x="13" y="1"  width="10" height="10" fill="#7FBA00" />
          <rect x="1"  y="13" width="10" height="10" fill="#00A4EF" />
          <rect x="13" y="13" width="10" height="10" fill="#FFB900" />
        </svg>
      );
    case 'google':
      return (
        <svg width={size} height={size} viewBox="0 0 48 48" role="img" aria-label="Google">
          <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
          <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
          <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
          <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571.001-.001.002-.001.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
        </svg>
      );
    default:
      return null;
  }
};

/* ── Location pill - tap to switch between Home / Work ─────────────── */

const LocationPill: React.FC<{
  text: string; cardBg: string; cardEdge: string; accent: string; subtle: string; font: string;
}> = ({ text, cardBg, cardEdge, accent, subtle, font }) => {
  const [i, setI] = useState(0);
  const loc = LOCATIONS[i];
  const next = () => setI(p => (p + 1) % LOCATIONS.length);

  return (
    <button
      type="button"
      onClick={next}
      title="Tap to switch location"
      aria-label={`Location - ${loc.label}: ${loc.place}. Tap to switch.`}
      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-transform duration-200 hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      style={{ color: text, border: `1px solid ${cardEdge}`, backgroundColor: cardBg, fontFamily: font, perspective: '600px' }}
    >
      <span style={{ color: accent }} aria-hidden><Icon name="location" size={16} /></span>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={i}
          initial={{ rotateX: -90, opacity: 0 }}
          animate={{ rotateX: 0, opacity: 1 }}
          exit={{ rotateX: 90, opacity: 0 }}
          transition={{ duration: 0.24, ease: 'easeOut' }}
          style={{ display: 'inline-block', transformOrigin: 'center', backfaceVisibility: 'hidden', whiteSpace: 'nowrap' }}
        >
          <span className="text-[0.68rem] font-bold uppercase tracking-wider mr-1.5" style={{ color: accent }}>{loc.label}</span>
          {loc.place}
        </motion.span>
      </AnimatePresence>
      <motion.span
        className="ml-0.5"
        style={{ color: subtle, display: 'inline-flex' }}
        animate={{ rotate: i * 180 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        aria-hidden
      >
        <Icon name="swap" size={13} />
      </motion.span>
    </button>
  );
};

/* ── Contact form (Formspree-backed) ──────────────────────────────── */

type FieldName = 'name' | 'email' | 'message';

// Deliberately permissive on the address: anything stricter than
// "something@something.tld with no spaces" rejects real addresses, and the
// endpoint verifies it properly anyway.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const validate = (f: Record<FieldName, string>): Partial<Record<FieldName, string>> => {
  const errs: Partial<Record<FieldName, string>> = {};
  if (!f.name.trim()) errs.name = 'Please tell me your name.';
  if (!f.email.trim()) errs.email = 'An email address lets me reply.';
  else if (!EMAIL_RE.test(f.email.trim())) errs.email = 'That doesn’t look like an email address.';
  if (!f.message.trim()) errs.message = 'Add a short message.';
  else if (f.message.trim().length < 10) errs.message = 'A little more detail, please (10+ characters).';
  return errs;
};

const FieldError: React.FC<{ id: string; msg?: string; isDark: boolean; font: string }> = ({ id, msg, isDark, font }) =>
  msg ? (
    <p id={id} className="mt-1.5 text-xs font-medium" style={{ color: isDark ? '#fca5a5' : '#dc2626', fontFamily: font, margin: '0.375rem 0 0' }}>
      {msg}
    </p>
  ) : null;

const ContactForm: React.FC<{
  isDark: boolean;
  text: string;
  subtle: string;
  cardBg: string;
  cardEdge: string;
  accent: string;
  font: string;
}> = ({ isDark, text, subtle, cardBg, cardEdge, accent, font }) => {
  const [form, setForm] = useState({ name: '', email: '', message: '' });
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldName, string>>>({});

  const inputBg = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(17,24,39,0.04)';
  const ring    = isDark ? 'rgba(142,162,255,0.28)' : 'rgba(79,70,229,0.20)';

  const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const name = e.target.name as FieldName;
    setForm(f => ({ ...f, [name]: e.target.value }));
    // Editing after a send clears the stale banner: a "message is on its way"
    // notice used to sit under a form the visitor had already started
    // refilling, and a field error persisted after it had been corrected.
    setStatus(prev => (prev === 'success' || prev === 'error' ? 'idle' : prev));
    setErrorMsg('');
    setFieldErrors(prev => (prev[name] ? { ...prev, [name]: undefined } : prev));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    /* `noValidate` turns OFF the browser's own required/type=email checks,
       and nothing replaced them - an empty form POSTed happily. Validate
       here instead, so the messages are styled with the rest of the page
       rather than being native bubbles. */
    const errs = validate(form);
    if (Object.keys(errs).length) {
      setFieldErrors(errs);
      setStatus('error');
      setErrorMsg('Please fix the highlighted fields.');
      return;
    }
    setFieldErrors({});

    if (FORMSPREE_ENDPOINT.includes('YOUR_FORM_ID')) {
      setStatus('error');
      setErrorMsg('The contact form isn’t connected yet — add your Formspree endpoint.');
      return;
    }
    setStatus('submitting');
    setErrorMsg('');
    try {
      const res = await fetch(FORMSPREE_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setStatus('success');
        setForm({ name: '', email: '', message: '' });
        setFieldErrors({});
      } else {
        const data = await res.json().catch(() => null);
        setStatus('error');
        setErrorMsg(data?.errors?.[0]?.message ?? 'Something went wrong. Please try again.');
      }
    } catch {
      setStatus('error');
      setErrorMsg('Network error — please try again.');
    }
  };

  const fieldStyle: React.CSSProperties = {
    backgroundColor: inputBg,
    color: text,
    fontFamily: font,
  };

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="flex flex-col gap-5 rounded-2xl p-6 sm:p-7 border backdrop-blur-sm"
      style={{
        backgroundColor: cardBg,
        borderColor: cardEdge,
        ['--contact-accent' as string]: accent,
        ['--contact-edge' as string]: cardEdge,
        ['--contact-ring' as string]: ring,
        ['--contact-ph' as string]: subtle,
      }}
    >
      <div>
        <label htmlFor="cf-name" className="block text-sm font-semibold mb-2" style={{ color: text, fontFamily: font }}>Name</label>
        <input
          id="cf-name" name="name" type="text" required autoComplete="name"
          value={form.name} onChange={onChange} placeholder="Your name"
          aria-invalid={!!fieldErrors.name}
          aria-describedby={fieldErrors.name ? 'cf-name-err' : undefined}
          className="contact-input w-full rounded-xl px-4 py-3 text-base" style={fieldStyle}
        />
        <FieldError id="cf-name-err" msg={fieldErrors.name} isDark={isDark} font={font} />
      </div>

      <div>
        <label htmlFor="cf-email" className="block text-sm font-semibold mb-2" style={{ color: text, fontFamily: font }}>Email</label>
        <input
          id="cf-email" name="email" type="email" required autoComplete="email"
          value={form.email} onChange={onChange} placeholder="your.email@example.com"
          aria-invalid={!!fieldErrors.email}
          aria-describedby={fieldErrors.email ? 'cf-email-err' : undefined}
          className="contact-input w-full rounded-xl px-4 py-3 text-base" style={fieldStyle}
        />
        <FieldError id="cf-email-err" msg={fieldErrors.email} isDark={isDark} font={font} />
      </div>

      <div>
        <label htmlFor="cf-message" className="block text-sm font-semibold mb-2" style={{ color: text, fontFamily: font }}>Message</label>
        <textarea
          id="cf-message" name="message" required rows={5}
          value={form.message} onChange={onChange} placeholder="Tell me about your project, role, or collaboration"
          aria-invalid={!!fieldErrors.message}
          aria-describedby={fieldErrors.message ? 'cf-message-err' : undefined}
          className="contact-input w-full rounded-xl px-4 py-3 text-base resize-y" style={fieldStyle}
        />
        <FieldError id="cf-message-err" msg={fieldErrors.message} isDark={isDark} font={font} />
      </div>

      <button
        type="submit"
        disabled={status === 'submitting'}
        className="mt-1 inline-flex items-center justify-center px-7 py-3 rounded-full text-base font-semibold transition-transform duration-200 hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        style={{ color: isDark ? '#0b0b0f' : '#ffffff', backgroundColor: accent, fontFamily: font }}
      >
        {status === 'submitting' ? 'Sending…' : 'Send Message'}
      </button>

      <p role="status" aria-live="polite" className="text-sm font-medium" style={{ fontFamily: font, margin: 0 }}>
        {status === 'success' && (
          <span style={{ color: accent }}>Thanks — your message is on its way. I&apos;ll get back to you soon.</span>
        )}
        {status === 'error' && (
          <span style={{ color: isDark ? '#fca5a5' : '#dc2626' }}>{errorMsg}</span>
        )}
      </p>
    </form>
  );
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
    className="section-shell relative w-full min-h-screen flex flex-col justify-center
               py-20 sm:py-24 px-5 sm:px-8"
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
    className="mt-6 max-w-[51rem] text-lg"
    style={{ color, fontFamily: '"Manrope", sans-serif' }}
  >
    {children}
  </motion.p>
);

export default PortfolioSection;
