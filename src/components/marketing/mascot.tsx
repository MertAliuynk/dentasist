// Dentasist's mascot — a friendly, animated tooth character. Pure inline SVG
// + CSS keyframes (see globals.css), no external image assets: keeps the
// bundle light, needs no licensing, and adapts to light/dark automatically
// since every color is either a theme token or a fixed white/ivory that
// reads fine in both. Respects prefers-reduced-motion (animations disabled
// via a media query in globals.css, not here).
export function Mascot({ className = "" }: { className?: string }) {
  return (
    <div className={`relative inline-block ${className}`} aria-hidden="true">
      <div className="mascot-float">
        <svg viewBox="0 0 200 220" className="h-full w-full drop-shadow-xl">
          {/* soft ground shadow */}
          <ellipse cx="100" cy="205" rx="46" ry="9" className="fill-foreground/10" />

          {/* waving arm */}
          <g className="mascot-wave">
            <path
              d="M150 110 Q182 100 178 72"
              fill="none"
              stroke="#fde8e8"
              strokeWidth="14"
              strokeLinecap="round"
            />
            <circle cx="178" cy="70" r="11" fill="#fde8e8" />
          </g>

          {/* tooth body */}
          <path
            d="M100 14
               C 46 14 30 54 33 92
               C 35 122 47 140 55 172
               C 60 194 74 200 82 178
               C 87 164 93 156 100 156
               C 107 156 113 164 118 178
               C 126 200 140 194 145 172
               C 153 140 165 122 167 92
               C 170 54 154 14 100 14 Z"
            fill="#ffffff"
            stroke="#e7e2da"
            strokeWidth="3"
          />
          {/* rosy cheeks */}
          <ellipse cx="62" cy="108" rx="10" ry="7" className="fill-primary/25" />
          <ellipse cx="138" cy="108" rx="10" ry="7" className="fill-primary/25" />

          {/* eyes (blink) */}
          <g className="mascot-blink">
            <circle cx="80" cy="88" r="7" fill="#2a2a2a" />
            <circle cx="120" cy="88" r="7" fill="#2a2a2a" />
            <circle cx="82.5" cy="85.5" r="2" fill="#ffffff" />
            <circle cx="122.5" cy="85.5" r="2" fill="#ffffff" />
          </g>

          {/* smile */}
          <path
            d="M78 118 Q100 136 122 118"
            fill="none"
            stroke="#2a2a2a"
            strokeWidth="4.5"
            strokeLinecap="round"
          />

          {/* little dentist mirror in the other hand */}
          <g>
            <path d="M50 108 Q26 118 20 96" fill="none" stroke="#fde8e8" strokeWidth="13" strokeLinecap="round" />
            <circle cx="19" cy="94" r="9" fill="none" stroke="currentColor" className="text-primary" strokeWidth="3" />
          </g>
        </svg>
      </div>

      {/* sparkles */}
      <svg viewBox="0 0 24 24" className="mascot-sparkle absolute -right-2 top-2 size-6 text-primary" style={{ animationDelay: "0.3s" }} fill="currentColor">
        <path d="M12 0 L14 10 L24 12 L14 14 L12 24 L10 14 L0 12 L10 10 Z" />
      </svg>
      <svg viewBox="0 0 24 24" className="mascot-sparkle absolute -left-3 top-16 size-4 text-primary" style={{ animationDelay: "1.1s" }} fill="currentColor">
        <path d="M12 0 L14 10 L24 12 L14 14 L12 24 L10 14 L0 12 L10 10 Z" />
      </svg>
      <svg viewBox="0 0 24 24" className="mascot-sparkle absolute right-4 bottom-6 size-3.5 text-primary" style={{ animationDelay: "1.8s" }} fill="currentColor">
        <path d="M12 0 L14 10 L24 12 L14 14 L12 24 L10 14 L0 12 L10 10 Z" />
      </svg>
    </div>
  );
}
