"use client";

import { AppHeader } from "@/components/AppHeader";
import { Stopwatch } from "./stopwatch/Stopwatch";

export default function Home() {
  return (
    <div className="home">
      <AppHeader />
      <main className="machine-panel" aria-label="Machine Timer">
        <h1>Machine Timer</h1>
        <Stopwatch />
      </main>
    </div>
  );
}