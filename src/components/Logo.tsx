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
      {/* HPA text - italic */}
      <text
        x="50"
        y="46"
        fontSize="32"
        fontFamily="'Helvetica Neue',Helvetica,Arial,sans-serif"
        fontWeight="800"
        fontStyle="italic"
        fill="#ffffff"
        textAnchor="middle"
        letterSpacing="2"
      >
        HPA
      </text>
      {/* Accent line */}
      <line x1="30" y1="50" x2="70" y2="50" stroke="#333333" strokeWidth="0.8" strokeLinecap="round" />
      {/* Centered car silhouette */}
      <path
        d="M18 70 L24 64 L36 62 L64 62 L76 64 L82 70 L84 74 Q84 78 80 78 L75 78 Q73 78 73 75 Q73 72 70 72 Q67 72 67 75 Q67 78 65 78 L35 78 Q33 78 33 75 Q33 72 30 72 Q27 72 27 75 Q27 78 25 78 L20 78 Q16 78 16 74 Z"
        fill="#ffffff"
        opacity={0.95}
      />
      {/* Windows */}
      <path d="M28 68 L33 64 L47 63 L47 68 Z" fill="#111111" opacity={0.8} />
      <path d="M53 68 L53 63 L67 64 L72 68 Z" fill="#111111" opacity={0.8} />
      {/* Speed lines */}
      <line x1="6" y1="68" x2="14" y2="68" stroke="#444444" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="8" y1="73" x2="14" y2="73" stroke="#333333" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}
