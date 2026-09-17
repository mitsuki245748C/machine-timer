"use client";

import { Stopwatch } from "./stopwatch/Stopwatch";

export default function Home() {
  return (
    <div className="home">
      <header className="banner">Machine Timer</header>
      <main className="machine-panel" aria-label="Machine Timer">
        <h1>Machine Timer</h1>
        <Stopwatch />
      </main>
    </div>
  );
}
