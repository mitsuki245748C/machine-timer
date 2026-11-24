"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { StopwatchAction, StopwatchResponse } from "./model";

// サーバーに最新の状態を問い合わせる間隔。正しい状態は DB にあり、この間隔で取り直す
const POLL_INTERVAL_MS = 5000;
// 画面の秒数を進める間隔。サーバーには問い合わせず、ブラウザだけで数える
const TICK_INTERVAL_MS = 1000;

type Snapshot = {
  data: StopwatchResponse;
  // 受け取った時刻（performance.now）。端末の時計がずれていても影響しない
  receivedAt: number;
};

async function requestState(options: RequestInit = {}): Promise<StopwatchResponse> {
  const response = await fetch("/api/stopwatch", { ...options, cache: "no-store" });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error ?? `通信に失敗しました（${response.status}）。`);
  }
  return response.json();
}

// 受け取ってから経った秒数だけ、経過時間を進め、予約者の残り時間を減らす。
// 次の問い合わせでサーバーの値に合わせ直すので、ずれは最大でも問い合わせ間隔ぶん
function advance(data: StopwatchResponse, elapsedSeconds: number): StopwatchResponse {
  if (elapsedSeconds <= 0) return data;
  return {
    ...data,
    machines: data.machines.map((machine) => {
      const { state } = machine;
      return {
        ...machine,
        state: {
          ...state,
          seconds: state.isRunning ? state.seconds + elapsedSeconds : state.seconds,
          // 0 になった後の「空き」への切り替えはサーバーが判断する（次の問い合わせまで 1 秒で止める）
          hold: state.hold && {
            ...state.hold,
            secondsLeft: Math.max(1, state.hold.secondsLeft - elapsedSeconds),
          },
        },
      };
    }),
  };
}

export function useStopwatches() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [now, setNow] = useState(() => performance.now());
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);
  const actionInFlight = useRef(false);
  const revision = useRef(0);

  function receive(data: StopwatchResponse) {
    const receivedAt = performance.now();
    setSnapshot({ data, receivedAt });
    setNow(receivedAt);
  }

  useEffect(() => {
    const controller = new AbortController();
    controllerRef.current = controller;
    let fetching = false;

    async function refresh() {
      if (fetching || actionInFlight.current) return;
      fetching = true;
      const requestedRevision = revision.current;
      try {
        const next = await requestState({ signal: controller.signal });
        if (!controller.signal.aborted && requestedRevision === revision.current) {
          receive(next);
          setError(null);
        }
      } catch {
        if (!controller.signal.aborted && requestedRevision === revision.current) {
          setError("状態を取得できませんでした。自動的に再試行します。");
        }
      } finally {
        fetching = false;
      }
    }

    void refresh();
    const pollId = setInterval(() => void refresh(), POLL_INTERVAL_MS);
    const tickId = setInterval(() => setNow(performance.now()), TICK_INTERVAL_MS);
    return () => {
      clearInterval(pollId);
      clearInterval(tickId);
      controller.abort();
    };
  }, []);

  const data = useMemo(() => {
    if (!snapshot) return null;
    const elapsedSeconds = Math.floor((now - snapshot.receivedAt) / 1000);
    return advance(snapshot.data, elapsedSeconds);
  }, [snapshot, now]);

  async function sendAction(action: StopwatchAction, machineId: number): Promise<boolean> {
    const controller = controllerRef.current;
    if (!controller || controller.signal.aborted || actionInFlight.current) return false;

    actionInFlight.current = true;
    revision.current += 1;
    setPending(true);
    setError(null);
    try {
      const next = await requestState({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, machineId }),
        signal: controller.signal,
      });
      if (!controller.signal.aborted) receive(next);
      return true;
    } catch (err) {
      if (!controller.signal.aborted) {
        setError(err instanceof Error ? err.message : "操作結果を確認できませんでした。最新の状態をご確認ください。");
      }
      return false;
    } finally {
      actionInFlight.current = false;
      if (!controller.signal.aborted) setPending(false);
    }
  }

  return { data, error, pending, sendAction };
}
