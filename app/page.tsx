"use client";

import { useEffect, useState } from "react";

type Machine = {
  id: number;
  name: string;
  status: string;
};

type MachinesResponse = {
  machines?: Machine[];
  error?: string;
};

export default function Home() {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function fetchMachines() {
      try {
        const response = await fetch("/api/machines");
        const data = (await response.json()) as MachinesResponse;

        if (!response.ok) {
          throw new Error(data.error ?? "器具一覧の取得に失敗しました。");
        }

        setMachines(data.machines ?? []);
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "器具一覧の取得に失敗しました。",
        );
      } finally {
        setIsLoading(false);
      }
    }

    fetchMachines();
  }, []);

  return (
    <div className="home">
      <header className="banner">Machine Timer</header>
      <main className="machine-panel" aria-label="Machine Timer">
        <h1>Machine Timer</h1>

        {isLoading && <p className="machine-message">Loading machines...</p>}

        {!isLoading && errorMessage && (
          <p className="machine-message machine-message-error">
            {errorMessage}
          </p>
        )}

        {!isLoading && !errorMessage && machines.length === 0 && (
          <p className="machine-message">器具がまだ登録されていません。</p>
        )}

        <div className="machine-list">
          {machines.map((machine) => (
            <div key={machine.id} className="machine">
              <h2>{machine.name}</h2>
              <p>Status: {machine.status}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
