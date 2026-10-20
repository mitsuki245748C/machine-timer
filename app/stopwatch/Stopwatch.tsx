"use client";

import { useEffect, useState } from "react";
import { useStopwatches } from "./use-stopwatches";
import { useRouter } from "next/navigation";

type Machine = {
  id: number;
  name: string;
};

type MachinesResponse = {
  machines?: Machine[];
  error?: string;
};

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${minutes.toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
}

export function Stopwatch() {
  const router = useRouter();
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

  async function handleStartButtonClick(machineId: number) {
    setStatusError("");
    setUpdatingMachineId(machineId);

    try {
      // 失敗時のエラー表示は useStopwatches 側で行う
      if (await sendAction("start", machineId)) {
        router.push(`/history?machineId=${machineId}`);
      }
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
              <p>Status: {data ? (isRunning ? "使用中" : "空き") : "--"}</p>
              <div className="stopwatch">
                <p>{data ? formatTime(state?.seconds ?? 0) : "--:--"}</p>

                {isRunning && startedByMe && isReserved && (
                  <p className="machine-notice">
                    予約されています。長時間の利用はおやめください。
                  </p>
                )}

                <div className="stopwatch-controls">
                  {canControl ? (
                    <button
                      className="machine-button"
                      onClick={() => void handleStartButtonClick(machine.id)}
                      disabled={disabled || isRunning}
                    >
                      {isUpdating ? "更新中..." : "開始する"}
                    </button>
                  ) : reservedByMe ? (
                    <p className="machine-reserved">予約しています</p>
                  ) : isReserved ? (
                    <p className="machine-reserved">予約済みです</p>
                  ) : (
                    <button
                      className="machine-button-reserve"
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
