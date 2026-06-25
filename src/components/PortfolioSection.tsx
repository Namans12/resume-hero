import React from 'react';
import { motion } from 'framer-motion';

interface PortfolioSectionProps {
  isDark: boolean;
}

const projects = [
  { title: 'Project One',   tag: 'Web App',     desc: 'A short description of this project and the problem it solves.' },
  { title: 'Project Two',   tag: 'Design',      desc: 'A short description of this project and the problem it solves.' },
  { title: 'Project Three', tag: 'Open Source', desc: 'A short description of this project and the problem it solves.' },
  { title: 'Project Four',  tag: 'Experiment',  desc: 'A short description of this project and the problem it solves.' },
];

const PortfolioSection: React.FC<PortfolioSectionProps> = ({ isDark }) => {
  const text     = isDark ? '#f3f4f6' : '#111827';
  const subtle   = isDark ? 'rgba(243,244,246,0.6)' : 'rgba(17,24,39,0.55)';
  const cardBg   = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(17,24,39,0.03)';
  const cardEdge = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(17,24,39,0.10)';

  return (
    <section
      id="portfolio"
      className="relative w-full min-h-screen px-6 sm:px-10 lg:px-20 py-24 sm:py-32"
      style={{ zIndex: 1 }}
    >
      <div className="max-w-6xl mx-auto">
        <motion.p
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: 0.5 }}
          className="text-sm font-semibold uppercase tracking-[0.3em]"
          style={{ color: subtle, fontFamily: '"Manrope", sans-serif' }}
        >
          Selected Work
        </motion.p>

        <motion.h2
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: 0.6, delay: 0.05 }}
          className="mt-4 font-bold leading-[1.05]"
          style={{ color: text, fontFamily: '"Manrope", sans-serif', fontSize: 'clamp(2.25rem, 6vw, 5rem)' }}
        >
          My Portfolio
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: 0.5, delay: 0.12 }}
          className="mt-6 max-w-2xl text-lg"
          style={{ color: subtle, fontFamily: '"Manrope", sans-serif' }}
        >
          A collection of things I&apos;ve designed and built. Replace these placeholders with your real
          projects, case studies, and writing.
        </motion.p>

        <div className="mt-16 grid gap-6 sm:grid-cols-2">
          {projects.map((p, i) => (
            <motion.article
              key={p.title}
              initial={{ opacity: 0, y: 36 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              whileHover={{ y: -6 }}
              className="group rounded-2xl p-7 sm:p-9 border backdrop-blur-sm cursor-pointer"
              style={{ backgroundColor: cardBg, borderColor: cardEdge }}
            >
              <span
                className="inline-block text-xs font-semibold uppercase tracking-[0.18em] px-3 py-1 rounded-full"
                style={{ color: subtle, border: `1px solid ${cardEdge}`, fontFamily: '"Manrope", sans-serif' }}
              >
                {p.tag}
              </span>
              <h3
                className="mt-5 text-2xl sm:text-3xl font-bold"
                style={{ color: text, fontFamily: '"Manrope", sans-serif' }}
              >
                {p.title}
              </h3>
              <p className="mt-3 text-base" style={{ color: subtle, fontFamily: '"Manrope", sans-serif' }}>
                {p.desc}
              </p>
              <span
                className="mt-6 inline-flex items-center gap-1 text-sm font-semibold transition-transform duration-300 group-hover:translate-x-1"
                style={{ color: text, fontFamily: '"Manrope", sans-serif' }}
              >
                View project
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
};

export default PortfolioSection;
