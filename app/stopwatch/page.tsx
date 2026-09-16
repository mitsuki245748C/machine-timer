"use client";

import { machines } from "./model";
import { useStopwatches } from "./use-stopwatches";

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${minutes.toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
}

export default function StopwatchPage() {
  const { data, error, pending, sendAction } = useStopwatches();

  return (
    <div className="home">
      <header className="banner">Machine Timer</header>
      <main className="machine-panel" aria-label="Machine Timer">
        <h1>Machine Timer</h1>
        {error && <p role="alert" style={{ color: "#ffffff" }}>{error}</p>}
        <div className="machine-list">
          {machines.map((machine) => {
            const state = data?.machines.find(({ id }) => id === machine.id)?.state;
            const disabled = !state || pending;

            return (
              <section key={machine.id} className="machine" aria-labelledby={`machine-${machine.id}`}>
                <h2 id={`machine-${machine.id}`}>{machine.name}</h2>
                <p>Status: {state ? (state.isRunning ? "使用中" : "空き") : "読み込み中…"}</p>
                <div className="stopwatch">
                  <p>{state ? formatTime(state.seconds) : "--:--"}</p>
                  <div className="stopwatch-controls">
                    <button
                      onClick={() => void sendAction("start", machine.id)}
                      disabled={disabled || state?.isRunning}
                    >
                      Start
                    </button>
                    <button
                      onClick={() => void sendAction("stop", machine.id)}
                      disabled={disabled || !state?.isRunning}
                    >
                      Stop
                    </button>
                    <button
                      onClick={() => void sendAction("reset", machine.id)}
                      disabled={disabled}
                    >
                      Reset
                    </button>
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      </main>
    </div>
  );
}
