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

const FALLBACK_ERROR_MESSAGE = "器具一覧の取得に失敗しました。";
type UpdateMachineStatusResponse = {
  machine?: Machine;
  error?: string;
};

export default function Home() {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [updatingMachineId, setUpdatingMachineId] = useState<number | null>(
    null,
  );

  useEffect(() => {
    async function fetchMachines() {
      try {
        const response = await fetch("/api/machines");
        const data = (await response.json()) as MachinesResponse;

        if (!response.ok) {
          setErrorMessage(data.error ?? FALLBACK_ERROR_MESSAGE);
          return;
        }

        setMachines(data.machines ?? []);
      } catch (error) {
        console.error(error);
        setErrorMessage(FALLBACK_ERROR_MESSAGE);
      } finally {
        setIsLoading(false);
      }
    }

    fetchMachines();
  }, []);

  async function handleStatusButtonClick(machine: Machine) {
    const nextStatus = machine.status === "使用中" ? "空き" : "使用中";

    setErrorMessage("");
    setUpdatingMachineId(machine.id);

    try {
      const response = await fetch(`/api/machines/${machine.id}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = (await response.json()) as UpdateMachineStatusResponse;

      if (!response.ok || !data.machine) {
        throw new Error(data.error ?? "ステータスの更新に失敗しました。");
      }

      setMachines((currentMachines) =>
        currentMachines.map((currentMachine) =>
          currentMachine.id === data.machine?.id ? data.machine : currentMachine,
        ),
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "ステータスの更新に失敗しました。",
      );
    } finally {
      setUpdatingMachineId(null);
    }
  }

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
              <button
                className="machine-button"
                disabled={updatingMachineId === machine.id}
                type="button"
                onClick={() => handleStatusButtonClick(machine)}
              >
                {updatingMachineId === machine.id
                  ? "更新中..."
                  : machine.status === "使用中"
                    ? "使用終了"
                    : "使用開始"}
              </button>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
