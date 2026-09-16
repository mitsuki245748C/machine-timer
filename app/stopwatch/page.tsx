"use client";

import { useEffect, useState } from "react";
import { machines } from "./model";
import { useStopwatches } from "./use-stopwatches";

type Machine = {
  id: number;
  name: string;
  status: string;
};

type MachinesResponse = {
  machines?: Machine[];
  error?: string;
};

type UpdateMachineStatusResponse = {
  machine?: Machine;
  error?: string;
};

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${minutes.toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
}

export default function StopwatchPage() {
  const { data, error, pending, sendAction } = useStopwatches();
  const [machineStatuses, setMachineStatuses] = useState<
    Record<number, string>
  >({});
  const [statusError, setStatusError] = useState("");
  const [updatingMachineId, setUpdatingMachineId] = useState<number | null>(
    null,
  );

  useEffect(() => {
    async function fetchMachineStatuses() {
      try {
        const response = await fetch("/api/machines");
        const data = (await response.json()) as MachinesResponse;

        if (!response.ok) {
          setStatusError(data.error ?? "器具の状態を取得できませんでした。");
          return;
        }

        const nextStatuses = Object.fromEntries(
          (data.machines ?? []).map((machine) => [machine.id, machine.status]),
        );
        setMachineStatuses(nextStatuses);
      } catch (error) {
        console.error(error);
        setStatusError("器具の状態を取得できませんでした。");
      }
    }

    fetchMachineStatuses();
  }, []);

  async function updateMachineStatus(machineId: number, status: string) {
    const response = await fetch(`/api/machines/${machineId}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status }),
    });
    const data = (await response.json()) as UpdateMachineStatusResponse;

    if (!response.ok || !data.machine) {
      throw new Error(data.error ?? "ステータスの更新に失敗しました。");
    }

    const updatedMachine = data.machine;
    setMachineStatuses((currentStatuses) => ({
      ...currentStatuses,
      [updatedMachine.id]: updatedMachine.status,
    }));
  }

  async function handleStartButtonClick(machineId: number) {
    setStatusError("");
    setUpdatingMachineId(machineId);

    try {
      await updateMachineStatus(machineId, "使用中");
      await sendAction("start", machineId);
    } catch (error) {
      setStatusError(
        error instanceof Error
          ? error.message
          : "ステータスの更新に失敗しました。",
      );
    } finally {
      setUpdatingMachineId(null);
    }
  }

  async function handleResetButtonClick(machineId: number) {
    setStatusError("");
    setUpdatingMachineId(machineId);

    try {
      await updateMachineStatus(machineId, "空き");
      await sendAction("reset", machineId);
    } catch (error) {
      setStatusError(
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
        {error && <p role="alert" style={{ color: "#ffffff" }}>{error}</p>}
        {statusError && (
          <p role="alert" style={{ color: "#fda4af" }}>{statusError}</p>
        )}
        <div className="machine-list">
          {machines.map((machine) => {
            const state = data?.machines.find(({ id }) => id === machine.id)?.state;
            const isUpdating = updatingMachineId === machine.id;
            const disabled = !state || pending || isUpdating;
            const status =
              machineStatuses[machine.id] ??
              (state ? (state.isRunning ? "使用中" : "空き") : "読み込み中…");

            return (
              <section key={machine.id} className="machine" aria-labelledby={`machine-${machine.id}`}>
                <h2 id={`machine-${machine.id}`}>{machine.name}</h2>
                <p>Status: {status}</p>
                <div className="stopwatch">
                  <p>{state ? formatTime(state.seconds) : "--:--"}</p>
                  <div className="stopwatch-controls">
                    <button
                      onClick={() => void handleStartButtonClick(machine.id)}
                      disabled={disabled || state?.isRunning}
                    >
                      {isUpdating ? "更新中..." : "Start"}
                    </button>
                    <button
                      onClick={() => void handleResetButtonClick(machine.id)}
                      disabled={disabled}
                    >
                      {isUpdating ? "更新中..." : "Reset"}
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
