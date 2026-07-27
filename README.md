# resume-hero

An animated hero section with a hanging desk lamp that switches the scene between day and night.

> **Note:** the previous README was the unmodified `create-vite` React + TypeScript template — it documented Vite's ESLint configuration and never mentioned this project.

## Overview

A focused front-end experiment: one hero section, done carefully. A pull-cord lamp hangs over a desk scene, and pulling it crossfades between hand-made day and night artwork with motion driven by Framer Motion.

Small by design — two components and two images. It is a study of a single interaction rather than a full site.

## Features

- Interactive hanging lamp with a pull cord
- Day/night scene transition between two artwork states
- Framer Motion animation
- Responsive layout
- Tailwind CSS v4 via the Vite plugin — no PostCSS config

## Tech Stack

React 19 · TypeScript · Vite · Tailwind CSS 4 (`@tailwindcss/vite`) · Framer Motion 12 · ESLint 10

## Prerequisites

- Node.js 18+ and npm

## Installation

```bash
git clone https://github.com/Namans12/resume-hero.git
cd resume-hero
npm install
```

## Usage

```bash
npm run dev
```

| Command | Does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Type-check (`tsc -b`) then build |
| `npm run preview` | Serve the build |
| `npm run lint` | ESLint |

## Project Structure

```
src/
  main.tsx              entry point
  App.tsx               mounts the hero
  components/
    HeroSection.tsx     scene layout and day/night state
    HangingLamp.tsx     lamp and pull-cord interaction
  assets/
  index.css             Tailwind entry
hero-desk-day.png       day artwork
hero-desk-night.png     night artwork
```

## Notes

- **Tailwind v4** is configured through `@tailwindcss/vite`, not `postcss.config.js`. There is no `tailwind.config.js` — v4 takes configuration in CSS
- **Artwork is raster.** The two desk images are the largest assets and set the visual ceiling; swapping them changes the whole scene
- **`HangingLamp.tsx` also appears in [`Portfolio_resume`](https://github.com/Namans12/Portfolio_resume)**. The two copies have drifted — this is the later version

## Branches

The default branch (`master`) is an early state. **Thirteen branches sit unmerged on top of it in a single linear chain**, taking the project from a hero experiment to a complete portfolio site. The head is `svg3` (2026-07-06, +38 commits).

```bash
git checkout svg3
```

| Branch | Date | Ahead | What it adds |
|---|---|---|---|
| `dots-bg` | 2026-06-25 | +1 | `DottedBackground.tsx` polka-dot backdrop; `PortfolioSection` and `ScrollToExplore` appear |
| `dot-cursor` | 2026-06-25 | +2 | Dots cluster interactively around the cursor |
| `animated-avatar` | 2026-06-26 | +3 | Animated avatar — `src/assets/avatar-typing.mp4`, coding and solving a cube |
| `hero-final` | 2026-06-26 | +6 | Explore button, arrow fix, plants framing the scene |
| `about-section` | 2026-06-27 | +7 | About section structure; `circle-bg.svg` |
| `Resume-built` | 2026-06-28 | +9 | All sections populated from `Resume.pdf` — the site becomes an actual resume |
| `final-v1` | 2026-06-28 | +10 | First complete version |
| `final-v2` | 2026-06-28 | +11 | Glitch fixes |
| `final-v3` | 2026-06-29 | +14 | Textual pass; `LICENSE` added |
| `final-v4` | 2026-06-29 | +17 | Scroll path work |
| `svg` | 2026-07-03 | +18 | `art/` — hand-drawn SVG diagrams per section (about, achievements, certifications, …) |
| `svg2` | 2026-07-04 | +36 | **Pen-traced diagrams** with mask-stroke ink reveals, stop-exact ink/dot sync, pacing retune, play button |
| `svg3` | 2026-07-06 | +38 | **Head.** SVG fixes and the final scrolling behaviour — 103 files, +8251 lines vs `master` |

### What the last three branches actually do

`svg`→`svg3` are the substantial ones. They add an `art/` directory of SVG illustrations that are revealed by a **pen-synced trace mask** — as you scroll, a pen appears to draw each diagram, with the ink reveal locked to scroll position rather than played on a timer. `svg2`'s commits ("stop-exact ink/dot sync + pacing retune", "reveal mechanism is now the pen-synced trace mask") are where that mechanism was worked out.

If you return to this project, start from `svg3` — `master` predates almost all of it.

## Related Repositories

| Repo | Relationship |
|---|---|
| [`Portfolio_resume`](https://github.com/Namans12/Portfolio_resume) | Full portfolio site; shares an earlier `HangingLamp` |
| [`projects-library`](https://github.com/Namans12/projects-library) | Scroll-driven animation experiment in the same spirit |
| [`Alpenglow`](https://github.com/Namans12/Alpenglow) | Real-time day/night SVG landscape — closest sibling conceptually |
