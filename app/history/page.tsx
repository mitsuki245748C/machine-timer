"use client";

import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { useStopwatches } from "../stopwatch/use-stopwatches";
import { isPositiveId, parseSets, type Exercise, type HistoryData, type SetInput, type LatestWorkout } from "@/lib/workouts";
import styles from "./history.module.css";

function formatTime(seconds: number): string {
  return `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
}

async function responseData(response: Response) {
  if (response.redirected) throw new Error("ログインし直してから再試行してください。");
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? "処理に失敗しました。再試行してください。");
  return body;
}

function HistoryForm({ machineId }: { machineId: number }) {
  const router = useRouter();
  const { data: timerData, error: timerError } = useStopwatches();
  const timer = timerData?.machines.find(({ id }) => id === machineId)?.state;
  const [history, setHistory] = useState<HistoryData | null>(null);
  const [loadError, setLoadError] = useState("");
  const [reload, setReload] = useState(0);
  const [exerciseId, setExerciseId] = useState("");
  const [sets, setSets] = useState<SetInput[]>([{ weight: "", reps: "" }]);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [retryBody, setRetryBody] = useState<string | null>(null);
  const [latest, setLatest] = useState<LatestWorkout | null>(null); 
  const inFlight = useRef(false);
  const addingInFlight = useRef(false);

  // 器具の情報・利用状態・種目リストを読み込む。
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(`/api/records?machineId=${machineId}`, {
          cache: "no-store", signal: controller.signal,
        });
        const next: HistoryData = await responseData(response);
        if (controller.signal.aborted) return;
        setHistory(next);
        if (next.exercises.length === 1) setExerciseId(String(next.exercises[0].id));
        setLoadError("");
      } catch (error) {
        if (!controller.signal.aborted) {
          setLoadError(error instanceof Error ? error.message : "種目を取得できませんでした。");
        }
      }
    }
    void load();
    return () => controller.abort();
  }, [machineId, reload]);

  // 選択中の種目が変わったら、その種目の前回の記録を取りに行く。
    useEffect(() => {
    const controller = new AbortController();
    async function loadLatest() {
      if (!exerciseId) { setLatest(null); return; }
      try {
        const response = await fetch(`/api/records/latest?machineId=${machineId}&exerciseId=${exerciseId}`, {
          cache: "no-store", signal: controller.signal,
        });
        const body = await responseData(response);
        if (!controller.signal.aborted) setLatest(body.latest ?? null);
      } catch {
        if (!controller.signal.aborted) setLatest(null);
      }
    }
    void loadLatest();
    return () => controller.abort();
  }, [machineId, exerciseId]);

  async function addExercise(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (addingInFlight.current || inFlight.current || retryBody || !name.trim()) return;
    addingInFlight.current = true;
    setAdding(true);
    setAddError("");
    setNotice("");
    try {
      const response = await fetch("/api/exercises", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ machineId, name: name.trim() }),
      });
      const { exercise }: { exercise: Exercise } = await responseData(response);
      setHistory((current) => current ? {
        ...current,
        exercises: current.exercises.some(({ id }) => id === exercise.id)
          ? current.exercises : [...current.exercises, exercise],
      } : current);
      setExerciseId(String(exercise.id));
      setName("");
      setShowAdd(false);
      setNotice(`「${exercise.name}」を追加しました。`);
    } catch (error) {
      setAddError(error instanceof Error ? error.message : "種目を追加できませんでした。");
    } finally {
      addingInFlight.current = false;
      setAdding(false);
    }
  }

  async function saveWorkout(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || addingInFlight.current || !history?.usageId) return;
    if (!retryBody && (!exerciseId || !parseSets(sets))) {
      setSaveError("種目を選び、全セットの重量と回数を入力してください。");
      return;
    }
    const body = retryBody ?? JSON.stringify({ machineId, usageId: history.usageId, exerciseId: Number(exerciseId), sets });
    inFlight.current = true;
    setSaving(true);
    setSaveError("");
    try {
      const response = await fetch("/api/records", {
        method: "POST", headers: { "Content-Type": "application/json" }, body,
      });
      if (!response.ok || response.redirected) {
        // 明示的な失敗応答なら編集可能に戻す。DB処理は全体がロールバックされる。
        setRetryBody(null);
        await responseData(response);
        throw new Error("保存できませんでした。ログイン状態を確認してください。");
      }
      // 保存済みの応答を確認してから移動する。
      await responseData(response);
      router.push("/");
      router.refresh();
    } catch (error) {
      // 通信が途切れた場合は同一の利用ID・内容で再試行し、DB側で重複を防ぐ。
      if (error instanceof TypeError || error instanceof SyntaxError) {
        setRetryBody(body);
        setSaveError("保存結果を確認できませんでした。同じ内容で再試行してください。記録は重複しません。");
      } else {
        setSaveError(error instanceof Error ? error.message : "保存できませんでした。");
      }
      inFlight.current = false;
      setSaving(false);
    }
  }

  function changeSet(index: number, field: keyof SetInput, value: string) {
    setSets((current) => current.map((set, i) => i === index ? { ...set, [field]: value } : set));
  }

  const locked = saving || adding || retryBody !== null;

  return (
    <main className={styles.main}>
      <Link className={styles.back} href="/">‹ 器具一覧</Link>
      <header className={styles.heading}>
        <h1>{history?.machine.name ?? "トレーニング記録"}</h1>
      </header>

      {!history && !loadError && <p role="status">種目を読み込んでいます…</p>}
      {loadError && <div className={styles.message}>
        <p role="alert">{loadError}</p>
        <button type="button" className={styles.secondary} onClick={() => { setLoadError(""); setReload((value) => value + 1); }}>再読み込み</button>
        <Link className={styles.back} href="/login">ログインを確認する</Link>
      </div>}

      {history && <>
        {history.usageId && <section className={styles.timer} aria-label="器具の利用時間">
          <strong>{timer?.startedByMe ? formatTime(timer.seconds) : "--:--"}</strong>
          {timer?.startedByMe && timer.isReserved && <p>次の予約あり</p>}
        </section>}
        {timerError && <p role="status" className={styles.muted}>{timerError}</p>}
        {!history.usageId && <p className={styles.message}>器具一覧から利用を開始してください。</p>}

        <section className={styles.exercise} aria-label="種目">
          <label className={styles.srOnly} htmlFor="exercise">種目を選択</label>
          <select id="exercise" form="workout-form" value={exerciseId} onChange={(event) => { setExerciseId(event.target.value); setNotice(""); }} required disabled={locked || !history.usageId || history.exercises.length === 0}>
            <option value="">{history.exercises.length ? "種目を選択" : "種目なし"}</option>
            {history.exercises.map((exercise) => <option key={exercise.id} value={exercise.id}>{exercise.name}</option>)}
          </select>
          {!showAdd ? <button className={styles.addExercise} type="button" disabled={locked} onClick={() => { setShowAdd(true); setNotice(""); }}>＋ 種目を追加</button> : (
            <form className={styles.addForm} onSubmit={addExercise}>
              <label className={styles.srOnly} htmlFor="exercise-name">種目名</label>
              <input id="exercise-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={100} required disabled={locked} placeholder="種目名" />
              {addError && <p role="alert" className={styles.error}>{addError}</p>}
              <div className={styles.addActions}>
                <button className={styles.secondary} type="button" disabled={locked} onClick={() => { setShowAdd(false); setAddError(""); }}>キャンセル</button>
                <button className={styles.primary} type="submit" disabled={locked || !name.trim()}>{adding ? "追加中…" : "追加"}</button>
              </div>
            </form>
          )}
          <span role="status" className={styles.srOnly}>{notice}</span>
        </section>

        {latest && (
          <section className={styles.lastWorkout} aria-label="前回の記録">
            <h2>前回の記録（{new Date(latest.performed_at).toLocaleDateString("ja-JP")}）</h2>
            <ul>
              {latest.sets.map((set, index) => (
                <li key={index}>{index + 1}セット目：{set.weight_kg}kg × {set.reps}回</li>
              ))}
            </ul>
          </section>
        )}

        {history.usageId && <form id="woÏrkout-form" className={styles.workout} onSubmit={saveWorkout}>
          {sets.map((set, index) => <fieldset key={index} className={styles.set} disabled={locked}>
            <legend>{index + 1}セット目</legend>
            <div className={styles.setFields}>
              <div><label htmlFor={`weight-${index}`}>重量（kg）</label><input id={`weight-${index}`} type="number" inputMode="decimal" min="0" max="999.99" step="0.01" required value={set.weight} onChange={(event) => changeSet(index, "weight", event.target.value)} placeholder="20" /></div>
              <div><label htmlFor={`reps-${index}`}>回数（回）</label><input id={`reps-${index}`} type="number" inputMode="numeric" min="1" max="2147483647" step="1" required value={set.reps} onChange={(event) => changeSet(index, "reps", event.target.value)} placeholder="10" /></div>
            </div>
            {sets.length > 1 && <button type="button" className={styles.remove} aria-label={`${index + 1}セット目を削除`} onClick={() => setSets((current) => current.filter((_, i) => i !== index))}>削除</button>}
          </fieldset>)}
          <button type="button" className={styles.secondary} disabled={locked || sets.length >= 100} onClick={() => setSets((current) => [...current, { weight: "", reps: "" }])}>＋ セットを追加</button>
          <div className={styles.saveArea}>
            {saveError && <p role="alert" className={styles.error}>{saveError}</p>}
            <button type="submit" className={styles.primary} disabled={saving || adding || !exerciseId}>{saving ? "保存しています…" : retryBody ? "同じ内容で再試行" : "保存して終了"}</button>
          </div>
        </form>}
      </>}
    </main>
  );
}

function HistoryContent() {
  const machineId = Number(useSearchParams().get("machineId"));
  if (!isPositiveId(machineId)) return <main className={styles.main}><h1>器具を選択してください</h1><p>器具一覧から利用を開始してください。</p><Link className={styles.back} href="/">器具一覧へ戻る</Link></main>;
  return <HistoryForm key={machineId} machineId={machineId} />;
}

export default function History() {
  return <div className={styles.page} lang="ja"><div className={styles.banner}>Machine Timer</div><Suspense fallback={<p className={styles.main}>読み込んでいます…</p>}><HistoryContent /></Suspense></div>;
}
