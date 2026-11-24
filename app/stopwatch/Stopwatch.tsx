"use client";

import { ClipboardListIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useStopwatches } from "./use-stopwatches";
import { useRouter } from "next/navigation";
import { RESERVATION_HOLD_SECONDS } from "./model";

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

function formatRemaining(seconds: number): string {
  return `${Math.floor(seconds / 60)}分${(seconds % 60).toString().padStart(2, "0")}秒`;
}

const HOLD_MINUTES = RESERVATION_HOLD_SECONDS / 60;

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

  async function handleRecordButtonClick(machineId: number, isRunning: boolean) {
    setStatusError("");
    setUpdatingMachineId(machineId);

    try {
      // 利用中ならそのまま記録画面へ。開始時のエラーは useStopwatches 側で表示する。
      if (isRunning || (await sendAction("start", machineId))) {
        router.push(`/history?machineId=${machineId}`);
      }
    } finally {
      setUpdatingMachineId(null);
    }
  }

  async function handleReservationButtonClick(machineId: number, action: "reserve" | "cancel") {
    setStatusError("");
    await sendAction(action, machineId);
  }

  // 管理者が、終了されずに残っている他人の利用を終了する
  async function handleForceEndButtonClick(machine: Machine) {
    if (!window.confirm(`${machine.name}の利用を強制終了しますか？`)) return;
    setStatusError("");
    await sendAction("reset", machine.id);
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
          const hold = state?.hold ?? null;
          const myReservation = data?.myReservationMachineId ?? null;
          const hasOtherReservation = myReservation !== null && myReservation !== machine.id;
          const waitingForOthers = !isRunning && hold !== null && !hold.forMe;
          const canControl = (!isRunning && !waitingForOthers) || startedByMe;
          const canForceEnd = (data?.isAdmin ?? false) && isRunning;

          return (
            <section
              key={machine.id}
              className="machine"
              aria-labelledby={`machine-${machine.id}`}
            >
              {/* この器具で行った種目の記録へ（記録画面の検索に器具名を入れて開く） */}
              <Link
                href={`/records?q=${encodeURIComponent(machine.name)}`}
                className="machine-records-link"
                aria-label={`${machine.name}の記録を見る`}
              >
                <ClipboardListIcon aria-hidden size={16} />
                記録
              </Link>
              <h2 id={`machine-${machine.id}`}>{machine.name}</h2>
              <p>
                Status:{" "}
                {!data
                  ? "--"
                  : isRunning
                    ? "使用中"
                    : hold
                      ? hold.forMe
                        ? "あなたの番です"
                        : "予約した人の順番"
                      : "空き"}
              </p>
              <div className="stopwatch">
                <p>{data ? formatTime(state?.seconds ?? 0) : "--:--"}</p>

                {isRunning && startedByMe && isReserved && (
                  <p className="machine-notice">
                    予約されています。長時間の利用はおやめください。
                  </p>
                )}
                {hold?.forMe && (
                  <p className="machine-notice">
                    予約していた器具が空きました。あと{formatRemaining(hold.secondsLeft)}の間は、あなただけが開始できます。
                  </p>
                )}

                <div className="stopwatch-controls">
                  {waitingForOthers ? (
                    <>
                      <p className="machine-reserved">予約した人の順番です</p>
                      <p className="machine-notice">
                        あと{formatRemaining(hold.secondsLeft)}で、誰でも使えるようになります
                      </p>
                    </>
                  ) : canControl ? (
                    <>
                      <button
                        className="machine-button"
                        onClick={() => void handleRecordButtonClick(machine.id, isRunning)}
                        disabled={disabled}
                      >
                        {isUpdating ? "更新中..." : isRunning ? "記録に戻る" : "開始する"}
                      </button>
                      {hold?.forMe && (
                        <button
                          className="machine-button-danger"
                          onClick={() => void handleReservationButtonClick(machine.id, "cancel")}
                          disabled={disabled}
                        >
                          予約をキャンセル
                        </button>
                      )}
                    </>
                  ) : reservedByMe ? (
                    <>
                      <p className="machine-reserved">あなたが予約しています</p>
                      <p className="machine-notice">
                        空いたらメールでお知らせします。空いてから{HOLD_MINUTES}分間は、あなただけが開始できます。
                      </p>
                      <button
                        className="machine-button-danger"
                        onClick={() => void handleReservationButtonClick(machine.id, "cancel")}
                        disabled={disabled}
                      >
                        予約をキャンセル
                      </button>
                    </>
                  ) : isReserved ? (
                    <>
                      <p className="machine-reserved">ほかの人が予約しています</p>
                    </>
                  ) : hasOtherReservation ? (
                    <>
                      <button className="machine-button-reserve" disabled>
                        予約できません
                      </button>
                      <p className="machine-notice">
                        予約は1人1つまでです
                      </p>
                    </>
                  ) : (
                    <button
                      className="machine-button-reserve"
                      onClick={() => void handleReservationButtonClick(machine.id, "reserve")}
                      disabled={disabled}
                    >
                      {isUpdating ? "更新中..." : "予約する"}
                    </button>
                  )}
                  {canForceEnd && (
                    <button
                      className="machine-button-danger"
                      onClick={() => void handleForceEndButtonClick(machine)}
                      disabled={disabled}
                    >
                      強制終了
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
