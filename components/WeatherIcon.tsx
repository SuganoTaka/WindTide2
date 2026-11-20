interface Props {
  code: number | null;
  size?: number;
  className?: string;
  night?: boolean;
}

const STROKE = "currentColor";

function Sun({ size }: { size: number }) {
  return (
    <g>
      <circle cx="12" cy="12" r="4.2" fill="none" stroke={STROKE} strokeWidth="1.4" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
        <line
          key={deg}
          x1={12 + Math.cos((deg * Math.PI) / 180) * 6.4}
          y1={12 + Math.sin((deg * Math.PI) / 180) * 6.4}
          x2={12 + Math.cos((deg * Math.PI) / 180) * 8.6}
          y2={12 + Math.sin((deg * Math.PI) / 180) * 8.6}
          stroke={STROKE}
          strokeWidth="1.3"
          strokeLinecap="round"
        />
      ))}
      <title>{size}</title>
    </g>
  );
}

function Cloud({ y = 0 }: { y?: number }) {
  return (
    <path
      transform={`translate(0 ${y})`}
      d="M7.2 17.2h8.6a3.4 3.4 0 0 0 .3-6.8 4.6 4.6 0 0 0-8.8-1.1 3.9 3.9 0 0 0-.1 7.9z"
      fill="none"
      stroke={STROKE}
      strokeWidth="1.4"
      strokeLinejoin="round"
    />
  );
}

function Rain({ heavy }: { heavy?: boolean }) {
  return (
    <g stroke={STROKE} strokeWidth="1.3" strokeLinecap="round">
      <line x1="8" y1="19" x2="7" y2={heavy ? 22 : 21} />
      <line x1="12" y1="19" x2="11" y2={heavy ? 22.5 : 21.4} />
      <line x1="16" y1="19" x2="15" y2={heavy ? 22 : 21} />
    </g>
  );
}

function Snow() {
  return (
    <g stroke={STROKE} strokeWidth="1.2" strokeLinecap="round">
      <line x1="8" y1="20" x2="8" y2="22" />
      <line x1="12" y1="20" x2="12" y2="22.4" />
      <line x1="16" y1="20" x2="16" y2="22" />
    </g>
  );
}

function Bolt() {
  return (
    <path
      d="M13 15.5l-3.4 4.2h2.6l-1.5 3.6 4-4.8h-2.4l1.3-3z"
      fill={STROKE}
      stroke="none"
    />
  );
}

function Fog() {
  return (
    <g stroke={STROKE} strokeWidth="1.3" strokeLinecap="round">
      <line x1="5" y1="16" x2="19" y2="16" />
      <line x1="7" y1="19" x2="17" y2="19" />
      <line x1="6" y1="22" x2="18" y2="22" />
    </g>
  );
}

export function weatherLabel(code: number | null): string {
  if (code == null) return "—";
  if (code === 0) return "快晴";
  if (code === 1) return "晴れ";
  if (code === 2) return "晴れ時々曇り";
  if (code === 3) return "曇り";
  if (code === 45 || code === 48) return "霧";
  if (code >= 51 && code <= 57) return "霧雨";
  if (code >= 61 && code <= 65) return "雨";
  if (code === 66 || code === 67) return "みぞれ";
  if (code >= 71 && code <= 77) return "雪";
  if (code >= 80 && code <= 82) return "にわか雨";
  if (code === 85 || code === 86) return "にわか雪";
  if (code === 95) return "雷雨";
  if (code === 96 || code === 99) return "雷雨(ひょう)";
  return "—";
}

export default function WeatherIcon({ code, size = 24, className = "" }: Props) {
  const stroke = className || "text-ink";
  let body: React.ReactNode = <Cloud />;

  if (code == null) body = <Cloud />;
  else if (code === 0) body = <Sun size={size} />;
  else if (code === 1 || code === 2)
    body = (
      <g>
        <g transform="translate(4.5 -1.5) scale(0.62)">
          <Sun size={size} />
        </g>
        <Cloud y={2.2} />
      </g>
    );
  else if (code === 3) body = <Cloud />;
  else if (code === 45 || code === 48) body = <Fog />;
  else if (code >= 51 && code <= 57)
    body = (
      <g>
        <Cloud y={-1.4} />
        <Rain />
      </g>
    );
  else if (code >= 61 && code <= 65)
    body = (
      <g>
        <Cloud y={-1.6} />
        <Rain heavy={code >= 63} />
      </g>
    );
  else if (code === 66 || code === 67)
    body = (
      <g>
        <Cloud y={-1.6} />
        <Rain />
        <Snow />
      </g>
    );
  else if (code >= 71 && code <= 77)
    body = (
      <g>
        <Cloud y={-1.6} />
        <Snow />
      </g>
    );
  else if (code >= 80 && code <= 82)
    body = (
      <g>
        <Cloud y={-1.4} />
        <Rain heavy={code === 82} />
      </g>
    );
  else if (code === 85 || code === 86)
    body = (
      <g>
        <Cloud y={-1.6} />
        <Snow />
      </g>
    );
  else if (code >= 95)
    body = (
      <g>
        <Cloud y={-1.6} />
        <Rain />
        <Bolt />
      </g>
    );

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={`${stroke} shrink-0`}
      aria-hidden="true"
      role="img"
    >
      {body}
    </svg>
  );
}
