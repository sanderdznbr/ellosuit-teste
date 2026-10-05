import React from "react";

interface RadialGlowOrbProps {
  size?: number;
  color?: string;
  className?: string;
}

/**
 * Futuristic radial spline glow orb.
 * Pure SVG + CSS, no deps. Used as the assistant avatar in the AI chatbot builder chat.
 */
const RadialGlowOrb: React.FC<RadialGlowOrbProps> = ({
  size = 28,
  color = "#374DA4",
  className = "",
}) => {
  const id = React.useId().replace(/:/g, "");
  return (
    <div
      className={`relative inline-flex shrink-0 ${className}`}
      style={{ width: size, height: size }}
      aria-hidden
    >
      {/* outer halo */}
      <div
        className="absolute inset-0 rounded-full animate-pulse"
        style={{
          background: `radial-gradient(circle, ${color}55 0%, transparent 70%)`,
          filter: "blur(6px)",
        }}
      />
      <svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        className="relative"
      >
        <defs>
          <radialGradient id={`core-${id}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
            <stop offset="35%" stopColor={color} stopOpacity="0.95" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`ring-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={color} stopOpacity="0" />
            <stop offset="50%" stopColor={color} stopOpacity="1" />
            <stop offset="100%" stopColor="#A78BFA" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* glowing core */}
        <circle cx="50" cy="50" r="22" fill={`url(#core-${id})`} />

        {/* rotating spline rings */}
        <g style={{ transformOrigin: "50px 50px" }} className="orb-spin-fast">
          <ellipse
            cx="50"
            cy="50"
            rx="42"
            ry="14"
            fill="none"
            stroke={`url(#ring-${id})`}
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </g>
        <g style={{ transformOrigin: "50px 50px", transform: "rotate(60deg)" }} className="orb-spin-slow-rev">
          <ellipse
            cx="50"
            cy="50"
            rx="42"
            ry="14"
            fill="none"
            stroke={`url(#ring-${id})`}
            strokeWidth="1.2"
            strokeLinecap="round"
            opacity="0.8"
          />
        </g>
        <g style={{ transformOrigin: "50px 50px", transform: "rotate(-55deg)" }} className="orb-spin-mid">
          <ellipse
            cx="50"
            cy="50"
            rx="42"
            ry="14"
            fill="none"
            stroke={`url(#ring-${id})`}
            strokeWidth="1"
            strokeLinecap="round"
            opacity="0.55"
          />
        </g>

        {/* tiny orbiting node */}
        <g style={{ transformOrigin: "50px 50px" }} className="orb-spin-fast">
          <circle cx="92" cy="50" r="2" fill="#ffffff">
            <animate attributeName="opacity" values="0.3;1;0.3" dur="1.6s" repeatCount="indefinite" />
          </circle>
        </g>
      </svg>

      <style>{`
        @keyframes orb-spin-fast { to { transform: rotate(360deg); } }
        @keyframes orb-spin-mid  { to { transform: rotate(-360deg); } }
        @keyframes orb-spin-slow-rev { from { transform: rotate(60deg); } to { transform: rotate(-300deg); } }
        .orb-spin-fast { animation: orb-spin-fast 4s linear infinite; }
        .orb-spin-mid  { animation: orb-spin-mid  7s linear infinite; }
        .orb-spin-slow-rev { animation: orb-spin-slow-rev 11s linear infinite; }
      `}</style>
    </div>
  );
};

export default RadialGlowOrb;