import type { CSSProperties } from "react";

/**
 * Canchas dibujadas en /mapa-canchas.webp (1386×1135). La zona tocable va en
 * % de la imagen; las de vóley son más anchas que el dibujo para que se
 * puedan tocar con el dedo en el celular.
 */
export const CANCHAS_MAPA = [
  { id: "f1", nombre: "Cancha 1 (Fútbol)", corto: "Cancha 1", deporte: "futbol", box: { left: 19.8, top: 28.6, width: 16.6, height: 17.6 } },
  { id: "f2", nombre: "Cancha 2 (Fútbol)", corto: "Cancha 2", deporte: "futbol", box: { left: 19.8, top: 46.3, width: 16.6, height: 17.6 } },
  { id: "f3", nombre: "Cancha 3 (Fútbol)", corto: "Cancha 3", deporte: "futbol", box: { left: 52.5, top: 65.2, width: 25.7, height: 13.9 } },
  { id: "v1", nombre: "Vóley 1", corto: "Vóley 1", deporte: "voley", box: { left: 50.6, top: 50.2, width: 9.6, height: 14.4 } },
  { id: "v2", nombre: "Vóley 2", corto: "Vóley 2", deporte: "voley", box: { left: 63.2, top: 50.2, width: 9.6, height: 14.4 } }
] as const;

export type CanchaMapa = (typeof CANCHAS_MAPA)[number];

export function MapaCanchas({
  seleccionada,
  enVivo,
  onSelect
}: {
  /** Nombre de la cancha elegida (como está en la base), o null. */
  seleccionada: string | null;
  /** Canchas con un partido en juego ahora. */
  enVivo: Set<string>;
  onSelect: (nombre: string | null) => void;
}) {
  const toggle = (nombre: string) => onSelect(seleccionada === nombre ? null : nombre);
  return (
    <div className="mapa">
      <div className="mapa-img">
        <img src="/mapa-canchas.webp" alt="Mapa del Instituto Salesiano Pío X con las canchas del torneo" width={1386} height={1135} />
        {CANCHAS_MAPA.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`mapa-zona ${c.deporte} ${seleccionada === c.nombre ? "on" : ""}`}
            style={{ left: `${c.box.left}%`, top: `${c.box.top}%`, width: `${c.box.width}%`, height: `${c.box.height}%` } as CSSProperties}
            aria-pressed={seleccionada === c.nombre}
            aria-label={`${c.nombre}: ver sus partidos`}
            onClick={() => toggle(c.nombre)}
          >
            {enVivo.has(c.nombre) && <span className="live-dot" />}
          </button>
        ))}
      </div>
      <div className="mapa-chips" role="group" aria-label="Elegir cancha">
        {CANCHAS_MAPA.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`chip-option mapa-chip ${c.deporte} ${seleccionada === c.nombre ? "active" : ""}`}
            aria-pressed={seleccionada === c.nombre}
            onClick={() => toggle(c.nombre)}
          >
            {enVivo.has(c.nombre) && <span className="live-dot" />}
            {c.deporte === "futbol" ? "⚽" : "🏐"} {c.corto}
          </button>
        ))}
      </div>
    </div>
  );
}
