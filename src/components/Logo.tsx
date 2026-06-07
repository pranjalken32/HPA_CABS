export default function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg
      className="shrink-0"
      width={size}
      height={size}
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="100" height="100" rx="20" fill="#111111" />
      <rect x="3" y="3" width="94" height="94" rx="18" fill="none" stroke="#222222" strokeWidth="1" />
      <text
        x="50"
        y="58"
        fontSize="34"
        fontFamily="system-ui,-apple-system,Helvetica,Arial,sans-serif"
        fontWeight="900"
        fill="#ffffff"
        textAnchor="middle"
        letterSpacing="-1"
      >
        HPA
      </text>
      <line x1="25" y1="70" x2="75" y2="70" stroke="#333333" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="32" y1="78" x2="42" y2="78" stroke="#333333" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="47" y1="78" x2="53" y2="78" stroke="#333333" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="58" y1="78" x2="68" y2="78" stroke="#333333" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}
