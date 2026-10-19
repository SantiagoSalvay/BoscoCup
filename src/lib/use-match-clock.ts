import { useEffect, useState } from "react";

type Periodo = "1T" | "ET" | "2T";

interface ClockState {
  periodo: Periodo;
  startedAt: number | null;
  baseMs: number;
}

function key(partidoId: string) {
  return `boscocup-clock-${partidoId}`;
}

function readState(partidoId: string): ClockState {
  try {
    const raw = localStorage.getItem(key(partidoId));
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return { periodo: "1T", startedAt: null, baseMs: 0 };
}

function writeState(partidoId: string, state: ClockState) {
  localStorage.setItem(key(partidoId), JSON.stringify(state));
}

export function useMatchClock(partidoId: string) {
  const [state, setState] = useState<ClockState>(() => readState(partidoId));
  const [, tick] = useState(0);

  useEffect(() => {
    if (!state.startedAt) return;
    const interval = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(interval);
  }, [state.startedAt]);

  function persist(next: ClockState) {
    setState(next);
    writeState(partidoId, next);
  }

  function iniciar1T() {
    persist({ periodo: "1T", startedAt: Date.now(), baseMs: 0 });
  }
  function entretiempo() {
    const elapsed = state.startedAt ? Date.now() - state.startedAt : 0;
    persist({ periodo: "ET", startedAt: null, baseMs: state.baseMs + elapsed });
  }
  function iniciar2T() {
    persist({ periodo: "2T", startedAt: Date.now(), baseMs: 45 * 60 * 1000 });
  }
  function detener() {
    const elapsed = state.startedAt ? Date.now() - state.startedAt : 0;
    persist({ ...state, startedAt: null, baseMs: state.baseMs + elapsed });
  }

  const elapsedMs = state.baseMs + (state.startedAt ? Date.now() - state.startedAt : 0);
  const totalSeconds = Math.floor(elapsedMs / 1000);
  const minuto = Math.floor(totalSeconds / 60);
  const seg = totalSeconds % 60;
  const label = `${minuto}:${seg.toString().padStart(2, "0")}`;
  const running = state.startedAt !== null;

  return { periodo: state.periodo, minuto, label, running, iniciar1T, entretiempo, iniciar2T, detener };
}
