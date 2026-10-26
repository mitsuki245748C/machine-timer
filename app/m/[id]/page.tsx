"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { useStopwatches } from "../../stopwatch/use-stopwatches";

type Machine = {
  id: number;
  name: string;
};

export default function MachineScanPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const machineId = Number(params.id);
  const isValidId = Number.isInteger(machineId) && machineId > 0;

  const { data, error, pending, sendAction } = useStopwatches();
  const [machine, setMachine] = useState<Machine | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [statusError, setStatusError] = useState("");
  const [isStarting, setIsStarting] = useState(false);
  // 自動で行った操作が失敗したとき、どの操作かを覚えておく（エラー文はフックの error に出る）
  const [failedAction, setFailedAction] = useState<"start" | "reserve" | null>(
    null,
  );
  const autoHandled = useRef(false);

  useEffect(() => {
    async function fetchMachine() {
      try {
        const response = await fetch("/api/machines");
        const body = (await response.json()) as {
          machines?: Machine[];
          error?: string;
        };

        if (!response.ok) {
          setStatusError(body.error ?? "器具の情報を取得できませんでした。");
          return;
        }

        setMachine(body.machines?.find(({ id }) => id === machineId) ?? null);
      } catch (err) {
        console.error(err);
        setStatusError("器具の情報を取得できませんでした。");
      } finally {
        setIsLoading(false);
      }
    }

    void fetchMachine();
  }, [machineId]);

  const state = data?.machines.find(({ id }) => id === machineId)?.state;
  const isRunning = state?.isRunning ?? false;
  const startedByMe = state?.startedByMe ?? false;
  const isReserved = state?.isReserved ?? false;
  const disabled = pending || isStarting;

  async function handleStart() {
    setStatusError("");
    setFailedAction(null);
    setIsStarting(true);

    try {
      // 失敗時のエラー表示は useStopwatches 側で行う
      if (await sendAction("start", machineId)) {
        router.push(`/history?machineId=${machineId}`);
      } else {
        setFailedAction("start");
      }
    } finally {
      setIsStarting(false);
    }
  }

  // QRを読み取って開いたら、状態に応じて自動で振り分ける
  //  空き → 開始して記録画面へ / 自分が使用中 → 記録画面へ
  //  他人が使用中 → 予約してホームへ
  useEffect(() => {
    if (!isValidId || !machine || !data || autoHandled.current) return;

    if (!isRunning) {
      autoHandled.current = true;
      queueMicrotask(() => void handleStart());
    } else if (startedByMe) {
      autoHandled.current = true;
      router.replace(`/history?machineId=${machineId}`);
    } else {
      autoHandled.current = true;
      void (async () => {
        // すでに予約があるか、予約に成功したときだけホームへ戻る
        if (isReserved || (await sendAction("reserve", machineId))) {
          router.replace("/");
        } else {
          setFailedAction("reserve");
        }
      })();
    }
    // handleStart は毎回作り直されるが、autoHandled により1回しか実行しない
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isValidId, machine, data, isRunning, startedByMe]);

  return (
    <div className="home">
      <header className="banner">Machine Timer</header>
      <main className="machine-panel" aria-label="Machine Timer">
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
        {!isValidId && (
          <p className="machine-message machine-message-error">
            器具IDが不正です。
          </p>
        )}
        {isValidId && isLoading && (
          <p className="machine-message">Loading machine...</p>
        )}
        {isValidId && !isLoading && !machine && !statusError && (
          <p className="machine-message machine-message-error">
            この器具は登録されていません。
          </p>
        )}

        {machine && (
          <section className="machine" aria-labelledby="machine-name">
            <h2 id="machine-name">{machine.name}</h2>
            {failedAction === "start" || statusError ? (
              <button
                className="machine-button"
                onClick={() => void handleStart()}
                disabled={disabled}
              >
                {isStarting ? "更新中..." : "開始する"}
              </button>
            ) : failedAction === "reserve" ? (
              <button
                className="machine-button"
                onClick={() => router.replace("/")}
              >
                ホームへ戻る
              </button>
            ) : (
              <p className="machine-message">処理中...</p>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
