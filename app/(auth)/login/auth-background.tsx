// Decorative only (aria-hidden) -- a network of route lines and location
// dots, pulsing/flowing via CSS keyframes defined in app/globals.css. Pure
// SVG + CSS, no client JS: this renders identically on the server, so it
// stays a plain (non "use client") component.

const DOTS: { cx: number; cy: number; r: number; delay: number; duration: number }[] = [
  { cx: 120, cy: 140, r: 2.4, delay: 0, duration: 4.2 },
  { cx: 300, cy: 90, r: 1.8, delay: 0.6, duration: 3.8 },
  { cx: 460, cy: 220, r: 2.8, delay: 1.4, duration: 4.6 },
  { cx: 640, cy: 110, r: 2, delay: 2.1, duration: 4 },
  { cx: 820, cy: 180, r: 2.6, delay: 0.3, duration: 4.4 },
  { cx: 980, cy: 90, r: 1.8, delay: 1.8, duration: 3.6 },
  { cx: 1100, cy: 220, r: 2.4, delay: 0.9, duration: 4.8 },
  { cx: 90, cy: 380, r: 2, delay: 2.6, duration: 4.2 },
  { cx: 260, cy: 420, r: 2.8, delay: 0.2, duration: 4.6 },
  { cx: 430, cy: 360, r: 1.8, delay: 1.5, duration: 3.8 },
  { cx: 600, cy: 430, r: 2.6, delay: 2.9, duration: 4.4 },
  { cx: 760, cy: 370, r: 2, delay: 0.7, duration: 4 },
  { cx: 920, cy: 440, r: 2.8, delay: 1.9, duration: 4.8 },
  { cx: 1080, cy: 400, r: 1.8, delay: 0.4, duration: 3.6 },
  { cx: 180, cy: 600, r: 2.4, delay: 2.3, duration: 4.2 },
  { cx: 380, cy: 640, r: 2, delay: 1.1, duration: 4.6 },
  { cx: 560, cy: 580, r: 2.8, delay: 0.5, duration: 4 },
  { cx: 740, cy: 630, r: 1.8, delay: 2.7, duration: 3.8 },
  { cx: 900, cy: 590, r: 2.6, delay: 1.3, duration: 4.4 },
  { cx: 1060, cy: 650, r: 2, delay: 0.1, duration: 4.8 },
];

const LINES: { d: string; delay: number; duration: number }[] = [
  { d: "M120,140 Q300,40 460,220", delay: 0, duration: 16 },
  { d: "M460,220 Q640,320 820,180", delay: 2, duration: 14 },
  { d: "M820,180 Q980,260 1100,220", delay: 4, duration: 18 },
  { d: "M90,380 Q260,300 430,360", delay: 1, duration: 15 },
  { d: "M430,360 Q600,280 760,370", delay: 3, duration: 17 },
  { d: "M760,370 Q920,320 1080,400", delay: 5, duration: 13 },
  { d: "M300,90 Q260,250 260,420", delay: 1.5, duration: 19 },
  { d: "M640,110 Q600,270 600,430", delay: 3.5, duration: 15 },
  { d: "M980,90 Q920,260 920,440", delay: 0.5, duration: 17 },
  { d: "M180,600 Q380,520 560,580", delay: 2.5, duration: 14 },
  { d: "M560,580 Q740,660 900,590", delay: 4.5, duration: 16 },
  { d: "M900,590 Q1000,540 1060,650", delay: 1.2, duration: 18 },
];

export function AuthBackground() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden bg-background">
      <svg
        viewBox="0 0 1200 700"
        preserveAspectRatio="xMidYMid slice"
        className="h-full w-full text-foreground"
      >
        {LINES.map((line, i) => (
          <path
            key={i}
            d={line.d}
            fill="none"
            stroke="currentColor"
            strokeWidth={1}
            strokeLinecap="round"
            className="auth-bg-line opacity-[0.12]"
            style={{ animationDelay: `${line.delay}s`, animationDuration: `${line.duration}s` }}
          />
        ))}
        {DOTS.map((dot, i) => (
          <circle
            key={i}
            cx={dot.cx}
            cy={dot.cy}
            r={dot.r}
            fill="currentColor"
            className="auth-bg-dot"
            style={{ animationDelay: `${dot.delay}s`, animationDuration: `${dot.duration}s` }}
          />
        ))}
      </svg>
      {/* Fades the network toward the edges so it reads as atmosphere behind
          the card rather than a hard-edged graphic. */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,var(--background)_85%)]" />
    </div>
  );
}
