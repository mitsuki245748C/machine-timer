"use client";

import { AppHeader } from "@/components/AppHeader";
import { Stopwatch } from "./stopwatch/Stopwatch";

export default function Home() {
  return (
    <div className="home">
      <AppHeader />
      <main className="machine-panel" aria-label="Perfect Muscle">
        
        <Stopwatch />
      </main>
    </div>
  );
}