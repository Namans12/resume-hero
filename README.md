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

## Related Repositories

| Repo | Relationship |
|---|---|
| [`Portfolio_resume`](https://github.com/Namans12/Portfolio_resume) | Full portfolio site; shares an earlier `HangingLamp` |
| [`projects-library`](https://github.com/Namans12/projects-library) | Scroll-driven animation experiment in the same spirit |
| [`Alpenglow`](https://github.com/Namans12/Alpenglow) | Real-time day/night SVG landscape — closest sibling conceptually |
