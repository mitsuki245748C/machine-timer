"use client";

import { AppHeader } from "@/components/AppHeader";
import { Stopwatch } from "./stopwatch/Stopwatch";

export default function Home() {
  return (
    <div className="home">
      <AppHeader />
      <main className="machine-panel" aria-label="Perfect Muscle">
        <h1>Perfect Muscle</h1>
        <Stopwatch />
      </main>
    </div>
  );
}