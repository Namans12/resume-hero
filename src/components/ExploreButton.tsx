import React, { useState } from 'react';
import styled, { createGlobalStyle } from 'styled-components';

// @property must live at global scope to enable angle transitions
const GlobalDefs = createGlobalStyle`
  @property --angle-1 {
    syntax: "<angle>";
    inherits: false;
    initial-value: -75deg;
  }
  @property --angle-2 {
    syntax: "<angle>";
    inherits: false;
    initial-value: -45deg;
  }
`;

interface ExploreButtonProps {
  isDark: boolean;
  onClick?: () => void;
}

const ExploreButton: React.FC<ExploreButtonProps> = ({ isDark, onClick }) => {
  const [hovered, setHovered] = useState(false);
  const letters = 'Explore'.split('');

  return (
    <>
      <GlobalDefs />
      <StyledWrapper $isDark={isDark}>
        <div className="button-wrap">
          <button
            type="button"
            aria-label="Explore"
            onClick={onClick}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
          >
            {/* Main span - keeps padding + shimmer ::after */}
            <span>
              {/* Letters */}
              <span className={`btn-text ${hovered ? 'hide' : ''}`}>
                {letters.map((ch, i) => (
                  <span
                    key={i}
                    className="letter"
                    style={{
                      transitionDelay: hovered
                        ? `${i * 25}ms`
                        : `${(letters.length - 1 - i) * 20 + 100}ms`,
                    }}
                  >
                    {ch}
                  </span>
                ))}
              </span>

              {/* Arrow - burger lines morph into a down arrow */}
              <span className={`btn-arrow ${hovered ? 'show' : ''}`} aria-hidden="true">
                <span className="burger">
                  <span />
                  <span />
                  <span />
                </span>
              </span>
            </span>
          </button>
          <div className="button-shadow" />
        </div>
      </StyledWrapper>
    </>
  );
};

const StyledWrapper = styled.div.attrs<{ $isDark: boolean }>(p => ({
  style: {
    '--btn-text-color': p.$isDark ? 'rgba(220,220,240,1)' : 'rgba(50,50,50,1)',
    '--btn-arrow-color': p.$isDark ? 'rgba(220,220,240,1)' : 'rgba(50,50,50,1)',
  } as React.CSSProperties,
}))<{ $isDark: boolean }>`
  font-size: 1.6rem;
  --anim--hover-time: 400ms;
  --anim--hover-ease: cubic-bezier(0.25, 1, 0.5, 1);
  --border-width: clamp(1px, 0.0625em, 4px);

  /* ── Wrap ── */
  .button-wrap {
    position: relative;
    z-index: 2;
    border-radius: 999vw;
    background: transparent;
    pointer-events: none;
    transition: all var(--anim--hover-time) var(--anim--hover-ease);
  }

  /* ── Shadow div ── */
  .button-shadow {
    --shadow-cuttoff-fix: 2em;
    position: absolute;
    width: calc(100% + var(--shadow-cuttoff-fix));
    height: calc(100% + var(--shadow-cuttoff-fix));
    top: calc(0% - var(--shadow-cuttoff-fix) / 2);
    left: calc(0% - var(--shadow-cuttoff-fix) / 2);
    filter: blur(clamp(2px, 0.125em, 12px));
    overflow: visible;
    pointer-events: none;
  }

  .button-shadow::after {
    content: "";
    position: absolute;
    z-index: 0;
    inset: 0;
    border-radius: 999vw;
    background: linear-gradient(180deg, rgba(0,0,0,0.2), rgba(0,0,0,0.1));
    width: calc(100% - var(--shadow-cuttoff-fix) - 0.25em);
    height: calc(100% - var(--shadow-cuttoff-fix) - 0.25em);
    top: calc(var(--shadow-cuttoff-fix) - 0.5em);
    left: calc(var(--shadow-cuttoff-fix) - 0.875em);
    padding: 0.125em;
    box-sizing: border-box;
    mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
    mask-composite: exclude;
    transition: all var(--anim--hover-time) var(--anim--hover-ease);
    overflow: visible;
    opacity: 1;
  }

  /* ── Button base ── */
  button {
    all: unset;
    cursor: pointer;
    position: relative;
    -webkit-tap-highlight-color: rgba(0,0,0,0);
    pointer-events: auto;
    z-index: 3;
    background: linear-gradient(
      -75deg,
      rgba(255,255,255,0.05),
      rgba(255,255,255,0.2),
      rgba(255,255,255,0.05)
    );
    border-radius: 999vw;
    box-shadow:
      inset 0 0.125em 0.125em rgba(0,0,0,0.05),
      inset 0 -0.125em 0.125em rgba(255,255,255,0.5),
      0 0.25em 0.125em -0.125em rgba(0,0,0,0.2),
      0 0 0.1em 0.25em inset rgba(255,255,255,0.2),
      0 0 0 0 rgba(255,255,255,1);
    backdrop-filter: blur(clamp(1px, 0.125em, 4px));
    -webkit-backdrop-filter: blur(clamp(1px, 0.125em, 4px));
    transition: all var(--anim--hover-time) var(--anim--hover-ease);
  }

  button:hover {
    transform: scale(0.975);
    backdrop-filter: blur(0.01em);
    -webkit-backdrop-filter: blur(0.01em);
    box-shadow:
      inset 0 0.125em 0.125em rgba(0,0,0,0.05),
      inset 0 -0.125em 0.125em rgba(255,255,255,0.5),
      0 0.15em 0.05em -0.1em rgba(0,0,0,0.25),
      0 0 0.05em 0.1em inset rgba(255,255,255,0.5),
      0 0 0 0 rgba(255,255,255,1);
  }

  /* ── Main span (padding + shimmer) ── */
  button > span {
    position: relative;
    display: block;
    user-select: none;
    -webkit-user-select: none;
    letter-spacing: -0.05em;
    font-weight: 500;
    font-size: 1em;
    color: var(--btn-text-color);
    -webkit-font-smoothing: antialiased;
    text-shadow: 0em 0.25em 0.05em rgba(0,0,0,0.1);
    transition: all var(--anim--hover-time) var(--anim--hover-ease);
    padding-inline: 1.5em;
    padding-block: 0.875em;
    min-width: 7em;
    text-align: center;
  }

  button:hover > span {
    text-shadow: 0.025em 0.025em 0.025em rgba(0,0,0,0.12);
  }

  /* Shimmer overlay */
  button > span::after {
    content: "";
    display: block;
    position: absolute;
    z-index: 4;
    width: calc(100% - var(--border-width));
    height: calc(100% - var(--border-width));
    top: calc(0% + var(--border-width) / 2);
    left: calc(0% + var(--border-width) / 2);
    box-sizing: border-box;
    border-radius: 999vw;
    overflow: clip;
    background: linear-gradient(
      var(--angle-2),
      rgba(255,255,255,0) 0%,
      rgba(255,255,255,0.5) 40% 50%,
      rgba(255,255,255,0) 55%
    );
    mix-blend-mode: screen;
    pointer-events: none;
    background-size: 200% 200%;
    background-position: 0% 50%;
    background-repeat: no-repeat;
    transition:
      background-position calc(var(--anim--hover-time) * 1.25) var(--anim--hover-ease),
      --angle-2 calc(var(--anim--hover-time) * 1.25) var(--anim--hover-ease);
  }

  button:hover > span::after  { background-position: 25% 50%; }
  button:active > span::after { background-position: 50% 15%; --angle-2: -15deg; }

  /* ── Rotating conic border ── */
  button::after {
    content: "";
    position: absolute;
    z-index: 1;
    inset: 0;
    border-radius: 999vw;
    width: calc(100% + var(--border-width));
    height: calc(100% + var(--border-width));
    top: calc(0% - var(--border-width) / 2);
    left: calc(0% - var(--border-width) / 2);
    padding: var(--border-width);
    box-sizing: border-box;
    background:
      conic-gradient(
        from var(--angle-1) at 50% 50%,
        rgba(0,0,0,0.5),
        rgba(0,0,0,0) 5% 40%,
        rgba(0,0,0,0.5) 50%,
        rgba(0,0,0,0) 60% 95%,
        rgba(0,0,0,0.5)
      ),
      linear-gradient(180deg, rgba(255,255,255,0.5), rgba(255,255,255,0.5));
    mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
    mask-composite: exclude;
    transition:
      all var(--anim--hover-time) var(--anim--hover-ease),
      --angle-1 500ms ease;
    box-shadow: inset 0 0 0 calc(var(--border-width) / 2) rgba(255,255,255,0.5);
  }

  button:hover::after  { --angle-1: -125deg; }
  button:active::after { --angle-1: -75deg;  }

  /* ── Shadow hover / active ── */
  .button-wrap:has(button:hover) .button-shadow {
    filter: blur(clamp(2px, 0.0625em, 6px));
    transition: filter var(--anim--hover-time) var(--anim--hover-ease);
  }
  .button-wrap:has(button:hover) .button-shadow::after {
    top: calc(var(--shadow-cuttoff-fix) - 0.875em);
    opacity: 1;
  }

  .button-wrap:has(button:active) {
    transform: rotate3d(1, 0, 0, 25deg);
  }
  .button-wrap:has(button:active) button {
    box-shadow:
      inset 0 0.125em 0.125em rgba(0,0,0,0.05),
      inset 0 -0.125em 0.125em rgba(255,255,255,0.5),
      0 0.125em 0.125em -0.125em rgba(0,0,0,0.2),
      0 0 0.1em 0.25em inset rgba(255,255,255,0.2),
      0 0.225em 0.05em 0 rgba(0,0,0,0.05),
      0 0.25em 0 0 rgba(255,255,255,0.75),
      inset 0 0.25em 0.05em 0 rgba(0,0,0,0.15);
  }
  .button-wrap:has(button:active) .button-shadow {
    filter: blur(clamp(2px, 0.125em, 12px));
  }
  .button-wrap:has(button:active) .button-shadow::after {
    top: calc(var(--shadow-cuttoff-fix) - 0.5em);
    opacity: 0.75;
  }
  .button-wrap:has(button:active) button > span {
    text-shadow: 0.025em 0.25em 0.05em rgba(0,0,0,0.12);
  }

  /* ── Letter animation ── */
  .btn-text {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2;
  }

  .letter {
    display: inline-block;
    opacity: 1;
    transform: translateY(0) scale(1);
    transition: opacity 0.22s ease, transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .btn-text.hide .letter {
    opacity: 0;
    transform: translateY(16px) scale(0.45);
  }

  /* ── Arrow animation ── */
  .btn-arrow {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2;
  }

  /* Burger group - rotated 90deg so the right-arrow morph points down */
  .burger {
    --bsize: 1.15em;
    --bclr: var(--btn-arrow-color);
    position: relative;
    width: var(--bsize);
    height: calc(0.7 * var(--bsize));
    transform: rotate(90deg);
  }

  .burger span {
    display: block;
    position: absolute;
    width: 100%;
    border-radius: 0.25em;
    border: 0.08em solid var(--bclr);
    background-color: var(--bclr);
    opacity: 0;
    transition: 0.30s ease-in-out;
  }

  .burger span:nth-of-type(1) {
    top: 0;
    right: 0;
    transform-origin: right center;
  }
  .burger span:nth-of-type(2) {
    top: 50%;
    transform: translateY(-50%);
  }
  .burger span:nth-of-type(3) {
    top: 100%;
    right: 0;
    transform-origin: right center;
    transform: translateY(-100%);
  }

  /* Shown (hovered) - collapse the outer lines into an arrowhead */
  .btn-arrow.show .burger span {
    opacity: 1;
  }
  .btn-arrow.show .burger span:nth-of-type(1) {
    transform: translateY(-30%) rotate(40deg);
    width: 50%;
    top: 50%;
  }
  .btn-arrow.show .burger span:nth-of-type(3) {
    transform: translateY(-70%) rotate(-40deg);
    width: 50%;
    top: 50%;
  }
`;

export default ExploreButton;
