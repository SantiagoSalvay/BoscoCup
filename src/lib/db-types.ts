export type Rol = "admin" | "veedor";
export type DeporteDb = "futbol" | "voley" | "basquet";
export type Rama = "Masculino" | "Femenino" | "Mixto" | "Único";
export type PartidoEstado =
  | "programado"
  | "en_juego"
  | "entretiempo"
  | "finalizado"
  | "suspendido"
  | "postergado"
  | "walkover";

export interface Profile {
  id: string;
  nombre: string;
  rol: Rol;
  activo: boolean;
  created_at: string;
}

export interface Categoria {
  id: string;
  torneo_id: string;
  deporte: DeporteDb;
  rama: Rama;
  formato: string;
  cantidad_clasifican_por_grupo: number;
  puntos_victoria: number;
  puntos_empate: number;
  puntos_derrota: number;
}

export interface EquipoRow {
  id: string;
  categoria_id: string;
  nombre: string;
  escudo_url: string | null;
  color_primario: string;
  color_secundario: string | null;
  delegado_nombre: string | null;
  delegado_contacto: string | null;
}

export interface JugadorRow {
  id: string;
  equipo_id: string;
  nombre: string;
  numero: number | null;
  posicion: string | null;
  dni: string | null;
}

export interface CanchaRow {
  id: string;
  torneo_id: string;
  nombre: string;
  deportes_compatibles: DeporteDb[];
  disponible_desde: string;
  disponible_hasta: string;
  estado: "disponible" | "fuera_de_servicio";
}

export interface PartidoRow {
  id: string;
  categoria_id: string;
  grupo_id: string | null;
  ronda_eliminatoria: string | null;
  equipo_local_id: string;
  equipo_visitante_id: string | null;
  cancha_id: string | null;
  fecha_hora_programada: string | null;
  estado: PartidoEstado;
  resultado_local: number | null;
  resultado_visitante: number | null;
  penales_local: number | null;
  penales_visitante: number | null;
  created_at?: string;
}

export interface GrupoRow {
  id: string;
  categoria_id: string;
  nombre: string;
}

export interface AsignacionVeedor {
  id: string;
  partido_id: string;
  veedor_id: string;
  bloqueado_en: string | null;
}

export type EventoTipo =
  | "gol"
  | "gol_en_contra"
  | "penal_convertido"
  | "penal_errado"
  | "tarjeta_amarilla"
  | "tarjeta_roja"
  | "doble_amarilla"
  | "cambio"
  | "incidencia";

export interface EventoPartidoRow {
  id: string;
  partido_id: string;
  tipo: EventoTipo;
  equipo_id: string | null;
  jugador_id: string | null;
  jugador_asistencia_id: string | null;
  minuto: number | null;
  detalle: Record<string, unknown>;
  anulado: boolean;
  creado_en: string;
}

export interface FormacionRow {
  id: string;
  partido_id: string;
  equipo_id: string;
  jugador_id: string;
  titular: boolean;
}
