import { useEffect, useRef, useState } from "react";
import type { LiveMatch, Sport } from "@/types";
import { IconBasquet, IconFutbol, IconVoley } from "@/components/icons";

const SPORT_ICON: Record<Sport, typeof IconFutbol> = {
  futbol: IconFutbol,
  voley: IconVoley,
  basquet: IconBasquet
};

export function LiveCarousel({ matches }: { matches: LiveMatch[] }) {
  const [index, setIndex] = useState(0);
  const timerRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    setIndex((i) => (matches.length === 0 ? 0 : i % matches.length));
  }, [matches.length]);

  useEffect(() => {
    window.clearInterval(timerRef.current);
    if (matches.length <= 1) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    timerRef.current = window.setInterval(() => {
      setIndex((i) => (i + 1) % matches.length);
    }, 4500);
    return () => window.clearInterval(timerRef.current);
  }, [matches.length]);

  if (matches.length === 0) return null;

  const n = matches.length;

  return (
    <div className="carousel">
      <div
        className="carousel-track"
        style={{ width: `${n * 100}%`, transform: `translateX(-${(index / n) * 100}%)` }}
      >
        {matches.map((m) => {
          const Icon = SPORT_ICON[m.sport];
          return (
            <div className="carousel-slide" style={{ width: `${100 / n}%` }} key={m.id}>
              <div className="live-card">
                <span className="sticker">{m.statusLabel}</span>
                <div className="carousel-sport">
                  <Icon />
                  {m.ramaLabel}
                </div>
                <div className="lc-row">
                  <span>{m.home.name}</span>
                  <span className="sc tnum">{m.homeScore}</span>
                </div>
                <div className="lc-row">
                  <span>{m.away.name}</span>
                  <span className="sc tnum">{m.awayScore}</span>
                </div>
                {m.court && <div className="lc-min">{m.court}</div>}
              </div>
            </div>
          );
        })}
      </div>

      {matches.length > 1 && (
        <div className="carousel-dots">
          {matches.map((m, i) => (
            <button
              key={m.id}
              type="button"
              className={`carousel-dot ${i === index ? "active" : ""}`}
              aria-label={`Ver partido ${i + 1}`}
              onClick={() => setIndex(i)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
