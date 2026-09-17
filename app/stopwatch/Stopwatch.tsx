"use client";

import { useEffect, useState } from "react";
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

export function Stopwatch() {
  const { data, error, pending, sendAction } = useStopwatches();
  const [machines, setMachines] = useState<Machine[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusError, setStatusError] = useState("");
  const [updatingMachineId, setUpdatingMachineId] = useState<number | null>(
    null,
  );

  useEffect(() => {
    async function fetchMachines() {
      try {
        const response = await fetch("/api/machines");
        const data = (await response.json()) as MachinesResponse;

        if (!response.ok) {
          setStatusError(data.error ?? "器具の状態を取得できませんでした。");
          return;
        }

        setMachines(data.machines ?? []);
      } catch (error) {
        console.error(error);
        setStatusError("器具の状態を取得できませんでした。");
      } finally {
        setIsLoading(false);
      }
    }

    fetchMachines();
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
    setMachines((currentMachines) =>
      currentMachines.map((currentMachine) =>
        currentMachine.id === updatedMachine.id
          ? updatedMachine
          : currentMachine,
      ),
    );
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

  async function handleReserveButtonClick(machineId: number) {
    setStatusError("");
    await sendAction("reserve", machineId);
  }

  return (
    <>
      {error && (
        <p role="alert" className="machine-message">
          {error}
        </p>
      )}
      {statusError && (
        <p role="alert" className="machine-message machine-message-error">
          {statusError}
        </p>
      )}
      {isLoading && <p className="machine-message">Loading machines...</p>}
      {!isLoading && !statusError && machines.length === 0 && (
        <p className="machine-message">器具がまだ登録されていません。</p>
      )}
      <div className="machine-list">
        {machines.map((machine) => {
          const state = data?.machines.find(
            ({ id }) => id === machine.id,
          )?.state;
          const isUpdating = updatingMachineId === machine.id;
          const disabled = pending || isUpdating;
          const isRunning = state?.isRunning ?? false;
          const startedByMe = state?.startedByMe ?? false;
          const isReserved = state?.isReserved ?? false;
          const reservedByMe = state?.reservedByMe ?? false;
          const canControl = !isRunning || startedByMe;

          return (
            <section
              key={machine.id}
              className="machine"
              aria-labelledby={`machine-${machine.id}`}
            >
              <h2 id={`machine-${machine.id}`}>{machine.name}</h2>
              <p>Status: {machine.status}</p>
              <div className="stopwatch">
                <p>{state ? formatTime(state.seconds) : "--:--"}</p>

                {isRunning && startedByMe && isReserved && (
                  <p className="machine-notice">
                    予約されています。長時間の利用はおやめください。
                  </p>
                )}

                <div className="stopwatch-controls">
                  {canControl ? (
                    <>
                      <button
                        onClick={() => void handleStartButtonClick(machine.id)}
                        disabled={disabled || isRunning}
                      >
                        {isUpdating ? "更新中..." : "Start"}
                      </button>
                      <button
                        onClick={() => void handleResetButtonClick(machine.id)}
                        disabled={disabled}
                      >
                        {isUpdating ? "更新中..." : "Reset"}
                      </button>
                    </>
                  ) : reservedByMe ? (
                    <p className="machine-reserved">予約しています</p>
                  ) : isReserved ? (
                    <p className="machine-reserved">予約済みです</p>
                  ) : (
                    <button
                      onClick={() => void handleReserveButtonClick(machine.id)}
                      disabled={disabled}
                    >
                      {isUpdating ? "更新中..." : "予約する"}
                    </button>
                  )}
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
