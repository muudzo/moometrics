interface MooMetricsLogoProps {
  className?: string;
  size?: number;
}

export function MooMetricsLogo({ className = '', size = 32 }: MooMetricsLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Artistic cow head with geometric African-inspired patterns */}

      {/* Head base */}
      <path
        d="M50 15 C35 15, 25 25, 25 40 L25 55 C25 65, 30 70, 35 72 L35 75 C35 78, 37 80, 40 80 L60 80 C63 80, 65 78, 65 75 L65 72 C70 70, 75 65, 75 55 L75 40 C75 25, 65 15, 50 15 Z"
        fill="currentColor"
        className="text-primary"
      />

      {/* Left ear */}
      <ellipse
        cx="28"
        cy="30"
        rx="8"
        ry="14"
        fill="currentColor"
        className="text-primary"
        transform="rotate(-25 28 30)"
      />

      {/* Right ear */}
      <ellipse
        cx="72"
        cy="30"
        rx="8"
        ry="14"
        fill="currentColor"
        className="text-primary"
        transform="rotate(25 72 30)"
      />

      {/* Inner left ear */}
      <ellipse
        cx="28"
        cy="30"
        rx="4"
        ry="9"
        fill="currentColor"
        className="text-secondary"
        transform="rotate(-25 28 30)"
      />

      {/* Inner right ear */}
      <ellipse
        cx="72"
        cy="30"
        rx="4"
        ry="9"
        fill="currentColor"
        className="text-secondary"
        transform="rotate(25 72 30)"
      />

      {/* Left horn - geometric */}
      <path
        d="M23 25 L18 15 L20 22 L23 25 Z"
        fill="currentColor"
        className="text-muted-foreground"
      />

      {/* Right horn - geometric */}
      <path
        d="M77 25 L82 15 L80 22 L77 25 Z"
        fill="currentColor"
        className="text-muted-foreground"
      />

      {/* Zimbabwe-style geometric pattern on forehead */}
      <path d="M45 25 L50 20 L55 25 L50 30 Z" fill="currentColor" className="text-accent" />
      <circle cx="42" cy="32" r="2" fill="currentColor" className="text-accent" />
      <circle cx="58" cy="32" r="2" fill="currentColor" className="text-accent" />

      {/* Eyes */}
      <circle cx="38" cy="45" r="4" fill="currentColor" className="text-primary-foreground" />
      <circle cx="62" cy="45" r="4" fill="currentColor" className="text-primary-foreground" />

      {/* Eye highlights */}
      <circle cx="39" cy="44" r="1.5" fill="currentColor" className="text-background" />
      <circle cx="63" cy="44" r="1.5" fill="currentColor" className="text-background" />

      {/* Snout/muzzle */}
      <ellipse cx="50" cy="62" rx="15" ry="12" fill="currentColor" className="text-secondary" />

      {/* Nostrils */}
      <ellipse cx="45" cy="62" rx="2.5" ry="3" fill="currentColor" className="text-primary" />
      <ellipse cx="55" cy="62" rx="2.5" ry="3" fill="currentColor" className="text-primary" />

      {/* Mouth curve */}
      <path
        d="M42 68 Q50 71, 58 68"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        className="text-primary"
        strokeLinecap="round"
      />

      {/* African-inspired decorative marks on cheeks */}
      <line
        x1="32"
        y1="52"
        x2="35"
        y2="52"
        stroke="currentColor"
        strokeWidth="1.5"
        className="text-accent"
        strokeLinecap="round"
      />
      <line
        x1="32"
        y1="55"
        x2="36"
        y2="55"
        stroke="currentColor"
        strokeWidth="1.5"
        className="text-accent"
        strokeLinecap="round"
      />
      <line
        x1="32"
        y1="58"
        x2="35"
        y2="58"
        stroke="currentColor"
        strokeWidth="1.5"
        className="text-accent"
        strokeLinecap="round"
      />

      <line
        x1="68"
        y1="52"
        x2="65"
        y2="52"
        stroke="currentColor"
        strokeWidth="1.5"
        className="text-accent"
        strokeLinecap="round"
      />
      <line
        x1="68"
        y1="55"
        x2="64"
        y2="55"
        stroke="currentColor"
        strokeWidth="1.5"
        className="text-accent"
        strokeLinecap="round"
      />
      <line
        x1="68"
        y1="58"
        x2="65"
        y2="58"
        stroke="currentColor"
        strokeWidth="1.5"
        className="text-accent"
        strokeLinecap="round"
      />
    </svg>
  );
}
