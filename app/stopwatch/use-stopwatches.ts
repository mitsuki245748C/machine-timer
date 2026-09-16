"use client";

import { useEffect, useRef, useState } from "react";
import type { StopwatchAction, StopwatchResponse } from "./model";

async function requestState(options: RequestInit): Promise<StopwatchResponse> {
  const response = await fetch("/api/stopwatch", { ...options, cache: "no-store" });
  if (!response.ok) {
    throw new Error(`通信に失敗しました（${response.status}）。`);
  }
  return response.json();
}

export function useStopwatches() {
  const [data, setData] = useState<StopwatchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);
  const actionInFlight = useRef(false);
  const revision = useRef(0);

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
        // A GET started before an action must not overwrite its result.
        if (!controller.signal.aborted && requestedRevision === revision.current) {
          setData(next);
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
    // Keep polling while stopped so actions from other browsers are reflected.
    const intervalId = setInterval(() => void refresh(), 1000);
    return () => {
      clearInterval(intervalId);
      controller.abort();
    };
  }, []);

  async function sendAction(action: StopwatchAction, machineId: number) {
    const controller = controllerRef.current;
    if (!controller || controller.signal.aborted || actionInFlight.current) return;

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
      if (!controller.signal.aborted) setData(next);
    } catch {
      if (!controller.signal.aborted) {
        setError("操作結果を確認できませんでした。最新の状態をご確認ください。");
      }
    } finally {
      actionInFlight.current = false;
      if (!controller.signal.aborted) setPending(false);
    }
  }

  return { data, error, pending, sendAction };
}
