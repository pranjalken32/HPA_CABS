export default function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg
      className="shrink-0"
      width={size}
      height={size}
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="100" height="100" rx="22" fill="#111111" />
      {/* Speed lines */}
      <line x1="8" y1="38" x2="22" y2="38" stroke="#333333" strokeWidth="2" strokeLinecap="round" />
      <line x1="12" y1="44" x2="28" y2="44" stroke="#444444" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="8" y1="50" x2="20" y2="50" stroke="#333333" strokeWidth="1.5" strokeLinecap="round" />
      {/* HPA text */}
      <text
        x="58"
        y="52"
        fontSize="30"
        fontFamily="system-ui,-apple-system,Helvetica,Arial,sans-serif"
        fontWeight="900"
        fill="#ffffff"
        textAnchor="middle"
        letterSpacing="-1"
      >
        HPA
      </text>
      {/* Car silhouette */}
      <path
        d="M22 68 L28 62 L42 60 L58 60 L68 62 L78 68 L80 72 Q80 76 76 76 L72 76 Q70 76 70 73 Q70 70 67 70 Q64 70 64 73 Q64 76 62 76 L38 76 Q36 76 36 73 Q36 70 33 70 Q30 70 30 73 Q30 76 28 76 L24 76 Q20 76 20 72 Z"
        fill="#ffffff"
        opacity={0.9}
      />
      {/* Windows */}
      <path d="M32 66 L36 62 L48 61 L48 66 Z" fill="#111111" opacity={0.8} />
      <path d="M50 66 L50 61 L62 62 L66 66 Z" fill="#111111" opacity={0.8} />
      {/* Headlight */}
      <circle cx="76" cy="70" r="1.5" fill="#ffffff" opacity={0.6} />
    </svg>
  )
}
