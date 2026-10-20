import type { CSSProperties, ReactNode } from "react";

interface Option<T extends string> {
  id: T;
  label: ReactNode;
}

/** Control segmentado con una "pastilla" que se desliza hasta la opción activa. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = "md",
  accent,
  label
}: {
  options: Option<T>[];
  value: T;
  onChange: (id: T) => void;
  size?: "md" | "sm";
  /** Color de la pastilla activa (por defecto, superficie elevada). */
  accent?: string;
  label: string;
}) {
  const index = Math.max(
    0,
    options.findIndex((o) => o.id === value)
  );
  const style = { "--n": options.length, "--i": index, ...(accent ? { "--seg-accent": accent } : {}) } as CSSProperties;

  return (
    <div className={`seg seg-${size} ${accent ? "seg-accented" : ""}`} role="tablist" aria-label={label} style={style}>
      <span className="seg-thumb" aria-hidden="true" />
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="tab"
          aria-selected={o.id === value}
          className={o.id === value ? "active" : ""}
          onClick={() => onChange(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
