import type { StandingRow, Team, ZoneStandings } from "@/types";
import type { PodioManual } from "@/lib/db-types";
import { Shield } from "@/components/icons";
import { Trofeo } from "@/components/BracketView";
import { estanEmpatados } from "@/lib/standings";

/**
 * Podio de las categorías sin playoff (fútbol femenino y vóley): campeón,
 * subcampeón y 3er puesto salen de la tabla. Se fija recién con todos los
 * partidos jugados; mientras tanto muestra quién va primero. Un puesto
 * empatado (mismos puntos, DG, tantos y tarjetas) queda "A definir".
 */
export function PodioTabla({
  zones,
  femenino,
  manual,
  onTeam
}: {
  zones: ZoneStandings[];
  /** Rótulos en femenino ("Campeona") o masculino genérico ("Campeón"). */
  femenino: boolean;
  /** Puestos fijados por la organización: se muestran aunque la tabla diga otra cosa. */
  manual?: PodioManual;
  onTeam: (t: Team) => void;
}) {
  const zona = zones.find((z) => z.rows.length > 0);
  if (!zona) return null;
  const filas = zona.rows;
  const fijos = [manual?.campeon, manual?.subcampeon, manual?.tercero];
  // Los puestos libres se completan con la tabla, sin repetir a los equipos ya fijados.
  const resto = filas.filter((r) => !fijos.includes(r.team.id));
  const definido = (i: number): StandingRow | null => {
    const r = resto[i];
    if (!zona.completa || !r || r.played === 0) return null;
    return estanEmpatados(r, resto[i - 1]) || estanEmpatados(r, resto[i + 1]) ? null : r;
  };
  let siguiente = 0;
  const [campeon, sub, tercero] = fijos.map((id) => (id ? filas.find((r) => r.team.id === id) ?? null : definido(siguiente++)));
  // Con la campeona ya fijada por la organización no tiene sentido mostrar quién "va primera".
  const lider = !manual?.campeon && !zona.completa && filas[0]?.played > 0 ? filas[0] : null;

  const nombre = (r: StandingRow | null, clase: string) =>
    r ? (
      <button type="button" className={clase} onClick={() => onTeam(r.team)}>
        <Shield className="mini-shield" fill={r.team.shieldColor} />
        {r.team.name}
      </button>
    ) : (
      <span className={`${clase} tbd`}>A definir</span>
    );

  return (
    <div className="podio">
      <img className="bk-logo only-light" src="/logo-bosco-cup.png" alt="Bosco Cup" />
      <img className="bk-logo only-dark" src="/logo-bosco-cup-dark.png" alt="Bosco Cup" />
      <div className={`bk-champ ${campeon ? "set" : ""}`}>
        <Trofeo className="bk-trophy" />
        <span className="bk-champ-label">{femenino ? "Campeona" : "Campeón"}</span>
        {nombre(campeon, "bk-champ-name")}
      </div>
      <div className="podio-resto">
        <div className={`bk-runner ${sub ? "set" : ""}`}>
          <span className="bk-runner-label">{femenino ? "Subcampeona" : "Subcampeón"}</span>
          {nombre(sub, "bk-runner-name")}
        </div>
        <div className={`bk-runner ${tercero ? "set" : ""}`}>
          <span className="bk-runner-label">3er puesto</span>
          {nombre(tercero, "bk-runner-name")}
        </div>
      </div>
      {lider && (
        <p className="podio-lider">
          Va primer{femenino ? "a" : "o"}: <b>{lider.team.name}</b> · {lider.points} pts. El podio se define con todos los partidos jugados.
        </p>
      )}
      {zona.completa && !campeon && (
        <p className="podio-lider">Hay un empate total arriba: hace falta un desempate para definir el podio.</p>
      )}
    </div>
  );
}
