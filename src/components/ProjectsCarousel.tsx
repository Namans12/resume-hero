import React, { useState } from 'react';
import signatextImg from '../assets/projects/signatext.webp';
import navimedImg from '../assets/projects/navimed.webp';
import cogmemImg from '../assets/projects/cogmem.webp';
import heartguardImg from '../assets/projects/heartguard.webp';

interface Project {
  title: string;
  tag: string;
  img: string;
  desc: string;
  stack: string[];
  href: string;
}

const PROJECTS: Project[] = [
  {
    title: 'NaviMed Scheduler',
    tag: 'Reinforcement Learning · Healthcare',
    img: navimedImg,
    desc: 'A smart patient-appointment system. A PPO agent reached 100% scheduling success (~4× baseline) in a simulated 3-doctor clinic, with FastAPI services for no-show scoring & ARIMA forecasting and an LLM booking chatbot on a Next.js dashboard.',
    stack: ['Python', 'FastAPI', 'Stable-Baselines3', 'Next.js', 'ARIMA'],
    href: 'https://github.com/Namans12/NaviMed-Scheduler',
  },
  {
    title: 'SignaText',
    tag: 'Computer Vision · NLP',
    img: signatextImg,
    desc: 'Real-time American Sign Language to text. A 27-class CNN recognises fingerspelling through a two-stage pipeline at 30+ FPS on CPU, and NLP post-processing assembles the letters into coherent words and sentences.',
    stack: ['TensorFlow', 'Keras', 'OpenCV', 'MediaPipe', 'CNN'],
    href: 'https://github.com/Namans12/SignaText',
  },
  {
    title: 'HeartGuard AI',
    tag: 'Machine Learning · Healthcare',
    img: heartguardImg,
    desc: 'A heart-disease risk predictor. A Random Forest trained on a clinical dataset estimates risk from health parameters and returns a low / moderate / high assessment — deployed with Gradio on Hugging Face Spaces.',
    stack: ['Python', 'scikit-learn', 'Random Forest', 'Gradio', 'Hugging Face'],
    href: 'https://github.com/Namans12/HeartGuard-AI',
  },
  {
    title: 'CogMem LLM',
    tag: 'LLM · Cognitive Memory',
    img: cogmemImg,
    desc: 'A cognitive-memory architecture for LLMs that goes beyond vector-DB retrieval — a reasoning core, working memory and typed long-term storage, with a controller deciding what to remember, retrieve and forget. Episodic recall with Ebbinghaus-style decay, a knowledge graph and a skill library all persist across sessions.',
    stack: ['Python', 'LLMs', 'SQLite', 'NumPy', 'Knowledge Graph'],
    href: 'https://github.com/Namans12/cogmem-llm',
  },
];

const GITHUB_PATH =
  'M12 1.5a10.5 10.5 0 0 0-3.32 20.46c.53.1.72-.23.72-.5v-1.76c-2.92.63-3.54-1.4-3.54-1.4-.48-1.22-1.17-1.55-1.17-1.55-.96-.65.07-.64.07-.64 1.06.08 1.62 1.09 1.62 1.09.94 1.62 2.47 1.15 3.07.88.1-.68.37-1.15.67-1.42-2.33-.26-4.78-1.16-4.78-5.18 0-1.15.41-2.08 1.08-2.82-.11-.27-.47-1.34.1-2.78 0 0 .88-.28 2.88 1.07a10 10 0 0 1 5.24 0c2-1.35 2.88-1.07 2.88-1.07.57 1.44.21 2.51.1 2.78.68.74 1.08 1.67 1.08 2.82 0 4.03-2.46 4.92-4.8 5.18.38.32.71.97.71 1.96v2.9c0 .28.19.61.73.5A10.5 10.5 0 0 0 12 1.5Z';

const Chevron: React.FC<{ dir: 'left' | 'right' }> = ({ dir }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d={dir === 'left' ? 'M15 6l-6 6 6 6' : 'M9 6l6 6-6 6'} />
  </svg>
);

const ProjectsCarousel: React.FC<{ isDark: boolean }> = ({ isDark }) => {
  const [active, setActive] = useState(0);
  const n = PROJECTS.length;

  const edge = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(17,24,39,0.12)';
  const accent = isDark ? '#8ea2ff' : '#4f46e5';
  const ctrlBg = isDark ? 'rgba(20,22,32,0.7)' : 'rgba(255,255,255,0.85)';
  const ctrlText = isDark ? '#f3f4f6' : '#111827';
  const font = '"Manrope", sans-serif';

  const go = (d: number) => setActive((a) => (a + d + n) % n);

  return (
    <div className="relative mt-10 select-none" style={{ maxWidth: '56rem' }}>
      <div className="pcar-wrap relative">
      <ul className="pcar-list list-none p-0 m-0" style={{ gap: 'clamp(6px, 1vw, 12px)', height: 'clamp(340px, 54vh, 500px)' }}>
        {PROJECTS.map((p, i) => (
          <li key={p.title} className="pcar-item" data-active={i === active ? '' : undefined}>
            {/* Clicking the card just opens/pins the slide - it never navigates.
                Only the "View on GitHub" link below opens the repo. */}
            <div
              onClick={() => setActive(i)}
              className="pcar-card relative block w-full h-full rounded-2xl overflow-hidden"
              style={{ border: `1px solid ${edge}`, cursor: 'pointer' }}
            >
              {/* Project image - desaturated when collapsed, full colour when expanded */}
              <img src={p.img} alt={p.title} draggable={false} className="pcar-img absolute inset-0 w-full h-full object-cover" />

              {/* Legibility scrim */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.55) 35%, rgba(0,0,0,0.12) 65%, transparent 100%)' }}
              />

              {/* Heading - rotates from vertical (collapsed strip) to horizontal (open card) */}
              <h3
                className="pcar-name absolute whitespace-nowrap leading-none"
                style={{
                  color: 'rgba(255,255,255,0.85)',
                  fontFamily: font,
                  fontWeight: 500,
                  fontSize: 'clamp(0.95rem, 1.7vw, 1.25rem)',
                  letterSpacing: '0.01em',
                  textShadow: '0 1px 8px rgba(0,0,0,0.5)',
                  pointerEvents: 'none',
                }}
              >
                {p.title}
              </h3>

              {/* Detail - fades in above the heading once the card has fully opened */}
              <div className="pcar-detail absolute flex flex-col" style={{ left: '1.25rem', right: '1.25rem', bottom: '3.6rem', pointerEvents: 'none' }}>
                <span
                  className="self-start text-[0.62rem] font-semibold uppercase tracking-[0.16em] px-2.5 py-1 rounded-full"
                  style={{ background: 'rgba(255,255,255,0.94)', color: '#1e1b4b', fontFamily: font }}
                >
                  {p.tag}
                </span>
                <p
                  className="mt-2 text-[0.82rem] leading-relaxed"
                  style={{
                    color: 'rgba(255,255,255,0.9)',
                    fontFamily: font,
                    textShadow: '0 1px 8px rgba(0,0,0,0.6)',
                    display: '-webkit-box',
                    WebkitLineClamp: 4,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {p.desc}
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {p.stack.map((s) => (
                    <span
                      key={s}
                      className="px-2 py-0.5 rounded-md text-[0.68rem] font-semibold"
                      style={{ color: '#fff', border: '1px solid rgba(255,255,255,0.35)', fontFamily: font }}
                    >
                      {s}
                    </span>
                  ))}
                </div>
                <a
                  href={p.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  onFocus={() => setActive(i)}
                  className="pcar-link mt-4 self-start inline-flex items-center gap-2 text-sm font-semibold no-underline"
                  style={{ color: '#fff', fontFamily: font }}
                >
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <path d={GITHUB_PATH} />
                  </svg>
                  View on GitHub
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </a>
              </div>
            </div>
          </li>
        ))}
      </ul>

        {/* View More -> Project Library (slide-up text swap on hover) */}
        <a
          href="https://library1201.vercel.app"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="View more on my Project Library"
          className="pcar-more group absolute focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          style={{
            right: 0,
            top: '50%',
            transform: 'translateY(-50%)',
            borderRadius: 9999,
            background: accent,
            color: isDark ? '#0b0b0f' : '#ffffff',
            fontFamily: font,
            fontWeight: 700,
            fontSize: '0.75rem',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            textDecoration: 'none',
            boxShadow: isDark ? '0 12px 32px rgba(0,0,0,0.45)' : '0 12px 32px rgba(79,70,229,0.35)',
          }}
        >
          <span className="pcar-more__track">
            <span className="pcar-more__item">
              View More
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M9 6l6 6-6 6" />
              </svg>
            </span>
            <span className="pcar-more__item">
              Project Library
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M7 17L17 7M8 7h9v9" />
              </svg>
            </span>
          </span>
        </a>
      </div>

      {/* Controls */}
      <div className="mt-6 flex items-center justify-center gap-4">
        <button
          type="button"
          onClick={() => go(-1)}
          aria-label="Previous project"
          className="flex items-center justify-center rounded-full transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          style={{ width: 40, height: 40, color: ctrlText, background: ctrlBg, border: `1px solid ${edge}` }}
        >
          <Chevron dir="left" />
        </button>

        <div className="flex items-center gap-2">
          {PROJECTS.map((p, i) => (
            <button
              key={p.title}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`Show ${p.title}`}
              style={{
                width: i === active ? 22 : 8,
                height: 8,
                borderRadius: 9999,
                background: i === active ? accent : edge,
                transition: 'all 0.35s ease',
              }}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={() => go(1)}
          aria-label="Next project"
          className="flex items-center justify-center rounded-full transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          style={{ width: 40, height: 40, color: ctrlText, background: ctrlBg, border: `1px solid ${edge}` }}
        >
          <Chevron dir="right" />
        </button>
      </div>
    </div>
  );
};

export default ProjectsCarousel;
