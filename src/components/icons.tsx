import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

export function IconFutbol(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...props}>
      <circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 6.5l4 2.9-1.5 4.7h-5L8 9.4z" fill="currentColor" />
    </svg>
  );
}

export function IconVoley(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...props}>
      <circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M3.5 10.5c4 2 13 2 17 0M5.2 16.5c3.8-3 9.8-3 13.6 0M7 5.3c2 3.6 2 10.8 0 14.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

export function IconBasquet(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...props}>
      <circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 2.5v19M2.5 12h19M4.5 5.8c3.4 3.4 3.4 9 0 12.4M19.5 5.8c-3.4 3.4-3.4 9 0 12.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

export function IconSun(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...props}>
      <circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconMoon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...props}>
      <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4 7 7 0 0 0 20 14.5z" fill="currentColor" />
    </svg>
  );
}

export function IconStar(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...props}>
      <path
        d="M12 2.5l2.9 6 6.6.7-4.9 4.5 1.3 6.5L12 16.9 6.1 20.2l1.3-6.5-4.9-4.5 6.6-.7z"
        fill="currentColor"
      />
    </svg>
  );
}

export function IconHome(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...props}>
      <path
        d="M4 11.5 12 4l8 7.5M6 10v9h12v-9"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconTable(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...props}>
      <rect x="3.5" y="4.5" width="17" height="15" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3.5 10h17M9 4.5v15" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

export function IconBracket(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...props}>
      <path
        d="M4 6h5M4 18h5M9 6v5h4M9 18v-5h4M13 10.5h7M13 13.5h7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconFollow(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...props}>
      <path d="M4 6.5h8M4 11.5h5M4 16.5h3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function IconGol(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...props}>
      <path d="M3 6h18M3 6v9h4M21 6v9h-4M7 15h10" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="10" r="2.6" fill="currentColor" />
    </svg>
  );
}

export function IconCard(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...props}>
      <rect x="6" y="3" width="12" height="18" rx="1.5" fill="currentColor" />
    </svg>
  );
}

export function IconSub(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...props}>
      <path d="M4 9h13M13 4l4 5-4 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20 15H7M11 10l-4 5 4 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconPenal(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...props}>
      <circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="2" fill="currentColor" />
      <path d="M12 4.5v3M12 16.5v3M4.5 12h3M16.5 12h3" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

export function IconIncidencia(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...props}>
      <path d="M12 3.5 21 19H3z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M12 10v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="12" cy="16.7" r="0.9" fill="currentColor" />
    </svg>
  );
}

export function IconUndo(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...props}>
      <path
        d="M6 8H4v6h6M4 11c1.6-4 5-6 8.5-6a8 8 0 1 1-7 11.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconSync(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...props}>
      <path
        d="M20 11a8 8 0 0 0-14.2-4.3M4 13a8 8 0 0 0 14.2 4.3M4 4v5h5M20 20v-5h-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconGoalOwn(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...props}>
      <path d="M3 6h18M3 6v9h4M21 6v9h-4M7 15h10" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M9 8.5 15 13M15 8.5 9 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function LogoMark(props: IconProps) {
  const shieldPath = "M23 1 44 7v18C44 39 35 48 23 51 11 48 2 39 2 25V7z";
  return (
    <svg viewBox="0 0 46 52" {...props}>
      <defs>
        <clipPath id="bosco-logo-clip">
          <path d={shieldPath} />
        </clipPath>
      </defs>
      <g clipPath="url(#bosco-logo-clip)">
        <rect x="0" y="0" width="46" height="18" style={{ fill: "var(--color-futbol)" }} />
        <rect x="0" y="18" width="46" height="17" style={{ fill: "var(--color-voley)" }} />
        <rect x="0" y="35" width="46" height="17" style={{ fill: "var(--color-basquet)" }} />
      </g>
      <path d={shieldPath} fill="none" style={{ stroke: "var(--color-bg)" }} strokeWidth="2.2" />
      <path
        d="M23 14.5l3.3 6.8 7.4.9-5.4 5.1 1.4 7.3L23 31l-6.7 3.6 1.4-7.3-5.4-5.1 7.4-.9z"
        style={{ fill: "var(--color-win)" }}
      />
    </svg>
  );
}

export function Shield({ fill, ...rest }: IconProps & { fill: string }) {
  return (
    <svg viewBox="0 0 46 52" {...rest}>
      <path d="M23 1 44 7v18C44 39 35 48 23 51 11 48 2 39 2 25V7z" fill={fill} />
    </svg>
  );
}
