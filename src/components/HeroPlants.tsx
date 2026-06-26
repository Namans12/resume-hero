import React from 'react';

interface PlantSVGProps {
  blobFill: string;
  leafFill: string;
  mirrored?: boolean;
}

const PlantSVG: React.FC<PlantSVGProps> = ({ blobFill, leafFill, mirrored }) => (
  <svg
    viewBox="0 0 180 310"
    xmlns="http://www.w3.org/2000/svg"
    style={{ width: '100%', display: 'block', transform: mirrored ? 'scaleX(-1)' : undefined }}
    aria-hidden="true"
  >
    <path
      d="M 88 22 C 116 8, 152 32, 156 72 C 160 112, 148 162, 124 198 C 100 234, 62 248, 36 228 C 10 208, 6 164, 10 124 C 14 84, 28 50, 56 32 C 68 24, 79 26, 88 22 Z"
      fill={blobFill}
    />
    <path
      d="M 90 300 C 89 268, 93 234, 90 200 C 87 166, 92 130, 91 98 C 90 66, 93 50, 93 38"
      stroke={leafFill}
      strokeWidth="2.6"
      strokeLinecap="round"
      fill="none"
    />
    <path d="M 90 222 C 74 208, 47 202, 34 213 C 49 225, 74 230, 90 222 Z" fill={leafFill} />
    <path d="M 90 193 C 107 179, 132 173, 144 184 C 130 196, 107 201, 90 193 Z" fill={leafFill} />
    <path d="M 90 162 C 73 148, 48 142, 36 153 C 51 165, 74 170, 90 162 Z" fill={leafFill} />
    <path d="M 91 133 C 107 119, 130 113, 141 124 C 128 136, 106 140, 91 133 Z" fill={leafFill} />
    <path d="M 91 104 C 76 91, 53 86, 43 96 C 56 108, 77 111, 91 104 Z" fill={leafFill} />
    <path d="M 92 76 C 105 64, 124 59, 133 68 C 121 79, 104 82, 92 76 Z" fill={leafFill} />
    <path d="M 93 46 C 89 36, 84 27, 85 28 C 87 34, 91 44, 93 46 Z" fill={leafFill} />
    <path d="M 93 46 C 97 36, 102 28, 101 29 C 99 35, 94 44, 93 46 Z" fill={leafFill} />
  </svg>
);

interface PlantConfig {
  top: string;
  width: string;
  rotate: number;
  opacity: number;
}

interface HeroPlantsProps {
  isDark: boolean;
}

const HeroPlants: React.FC<HeroPlantsProps> = ({ isDark }) => {
  const leftBlob  = isDark ? 'rgba(120,182,155,0.13)' : 'rgba(160,215,188,0.38)';
  const leftLeaf  = isDark ? 'rgba(105,168,140,0.55)' : 'rgba(95,165,130,0.65)';
  const rightBlob = isDark ? 'rgba(100,150,192,0.13)' : 'rgba(162,205,228,0.38)';
  const rightLeaf = isDark ? 'rgba(90,142,184,0.55)'  : 'rgba(88,150,192,0.65)';

  const leftPlants: PlantConfig[] = [
    { top: '3%',  width: 'clamp(105px, 14vw, 195px)', rotate: -12, opacity: 0.9 },
    { top: '57%', width: 'clamp(90px,  12vw, 168px)', rotate: -12, opacity: 0.9 },
  ];

  const rightPlants: PlantConfig[] = [
    { top: '5%',  width: 'clamp(105px, 14vw, 195px)', rotate: 12, opacity: 0.9 },
    { top: '55%', width: 'clamp(90px,  12vw, 168px)', rotate: 12, opacity: 0.9 },
  ];

  return (
    <>
      {leftPlants.map((p, i) => (
        <div
          key={`lp-${i}`}
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: p.top,
            left: '-3%',
            width: p.width,
            opacity: p.opacity,
            transform: `rotate(${p.rotate}deg)`,
            transformOrigin: 'top center',
            pointerEvents: 'none',
            userSelect: 'none',
            zIndex: 0,
          }}
        >
          <PlantSVG blobFill={leftBlob} leafFill={leftLeaf} />
        </div>
      ))}

      {rightPlants.map((p, i) => (
        <div
          key={`rp-${i}`}
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: p.top,
            right: '-3%',
            width: p.width,
            opacity: p.opacity,
            transform: `rotate(${p.rotate}deg)`,
            transformOrigin: 'top center',
            pointerEvents: 'none',
            userSelect: 'none',
            zIndex: 0,
          }}
        >
          <PlantSVG blobFill={rightBlob} leafFill={rightLeaf} mirrored />
        </div>
      ))}
    </>
  );
};

export default HeroPlants;
