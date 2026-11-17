"use client";

import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, SearchIcon, XIcon } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { BODY_PARTS, bodyPartLabel, type BodyPart, type RecordExercise, type RecordSession, type WorkoutSession, type WorkoutSet } from "@/lib/workouts";
import styles from "./records.module.css";

const VIEWS = [
  { id: "part", label: "部位別" },
  { id: "calendar", label: "カレンダー" },
] as const;
type View = (typeof VIEWS)[number]["id"];

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

type HistoryTarget = { machineId: number; exerciseId: number; title: string };

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { cache: "no-store", signal });
  if (response.redirected) throw new Error("ログインし直してから再試行してください。");
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? "記録を取得できませんでした。");
  return body;
}

// 端末のタイムゾーンでの日付キー（YYYY-MM-DD）
function dayKey(date: Date): string {
  const pad = (value: number) => value.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function keyToDate(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatDay(date: Date): string {
  return `${date.getMonth() + 1}/${date.getDate()}（${WEEKDAYS[date.getDay()]}）`;
}

function formatFullDay(date: Date): string {
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}（${WEEKDAYS[date.getDay()]}）`;
}

// 同じ重量・回数が続くセットは「60kg × 10回 ×3」のようにまとめる
function summarizeSets(sets: WorkoutSet[]): string[] {
  const groups: { set: WorkoutSet; count: number }[] = [];
  for (const set of sets) {
    const last = groups.at(-1);
    if (last && last.set.weight_kg === set.weight_kg && last.set.reps === set.reps) last.count += 1;
    else groups.push({ set, count: 1 });
  }
  return groups.map(({ set, count }) =>
    `${set.weight_kg}kg × ${set.reps}回${count > 1 ? ` ×${count}` : ""}`);
}

function groupByDay(sessions: RecordSession[]) {
  const days: { key: string; date: Date; sessions: RecordSession[] }[] = [];
  for (const session of sessions) {
    const date = new Date(session.performed_at);
    const key = dayKey(date);
    const last = days.at(-1);
    if (last?.key === key) last.sessions.push(session);
    else days.push({ key, date, sessions: [session] });
  }
  return days;
}

// その日に鍛えた部位（BODY_PARTS の順）
function partsOf(sessions: RecordSession[]) {
  return BODY_PARTS.filter(({ id }) => sessions.some(({ body_part }) => body_part === id));
}

function PartChips({ sessions }: { sessions: RecordSession[] }) {
  return <span className={styles.partChips}>{partsOf(sessions).map(({ id, label }) => <span key={id} className={styles.partChip} data-part={id}>{label}</span>)}</span>;
}

function SessionList({ sessions, onOpen }: { sessions: RecordSession[]; onOpen: (target: HistoryTarget) => void }) {
  return (
    <ul className={styles.sessionList}>
      {sessions.map((session) => {
        const machineId = session.machine_id;
        const title = `${session.exercise_name}${session.machine_name ? `（${session.machine_name}）` : ""}`;
        const body = <>
          <span className={styles.sessionTitle}>
            <strong>{session.exercise_name}</strong>
            {session.machine_name && <span className={styles.muted}>{session.machine_name}</span>}
          </span>
          <span className={styles.sets}>{summarizeSets(session.sets).join(" / ")}</span>
        </>;
        return (
          <li key={`${session.performed_at}-${machineId}-${session.exercise_id}`}>
            {machineId
              ? <button type="button" className={styles.sessionRow} onClick={() => onOpen({ machineId, exerciseId: session.exercise_id, title })}>{body}</button>
              : <div className={styles.sessionRow}>{body}</div>}
          </li>
        );
      })}
    </ul>
  );
}

function ErrorMessage({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className={styles.message}>
      <p role="alert">{message}</p>
      <button type="button" className={styles.secondary} onClick={onRetry}>再読み込み</button>
    </div>
  );
}

// 部位別と検索で共有する「記録のある 器具×種目」の一覧
function useRecordExercises() {
  const [exercises, setExercises] = useState<RecordExercise[] | null>(null);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    getJson<{ exercises: RecordExercise[] }>("/api/records/exercises", controller.signal)
      .then((body) => { setExercises(body.exercises); setError(""); })
      .catch((e) => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "記録を取得できませんでした。"); });
    return () => controller.abort();
  }, [reload]);

  const retry = useCallback(() => { setError(""); setReload((v) => v + 1); }, []);
  return { exercises, error, retry };
}

type ExercisesState = ReturnType<typeof useRecordExercises>;

// 全角/半角・大文字/小文字・ひらがな/カタカナの違いを無視して比べる
function normalize(text: string): string {
  return text.normalize("NFKC").toLowerCase()
    .replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
    .replace(/\s+/g, "");
}

function exerciseTarget(exercise: RecordExercise): HistoryTarget {
  return {
    machineId: exercise.machine_id,
    exerciseId: exercise.exercise_id,
    title: `${exercise.exercise_name}（${exercise.machine_name}）`,
  };
}

function ExerciseCard({ exercise, showPart, onOpen }: { exercise: RecordExercise; showPart?: boolean; onOpen: (target: HistoryTarget) => void }) {
  return (
    <button type="button" className={styles.card} onClick={() => onOpen(exerciseTarget(exercise))}>
      <span className={styles.cardMain}>
        <span className={styles.sessionTitle}>
          <strong>{exercise.exercise_name}</strong>
          <span className={styles.muted}>{exercise.machine_name}</span>
          {showPart && <span className={styles.partChip} data-part={exercise.body_part}>{bodyPartLabel(exercise.body_part)}</span>}
        </span>
        <span className={styles.muted}>
          最終 {formatDay(new Date(exercise.last_performed_at))}・{exercise.session_count}回
          {exercise.best_weight_kg !== null && `・最高 ${exercise.best_weight_kg}kg`}
        </span>
      </span>
      <ChevronRightIcon aria-hidden size={20} />
    </button>
  );
}

// ── 検索 ───────────────────────────────────────────
function SearchResults({ query, state, onOpen }: { query: string; state: ExercisesState; onOpen: (target: HistoryTarget) => void }) {
  const { exercises, error, retry } = state;
  // スペース区切りで AND 検索（例：「ベンチ スミス」「胸 ダンベル」）
  const results = useMemo(() => {
    const words = query.split(/\s+/).map(normalize).filter(Boolean);
    return (exercises ?? []).filter((exercise) => {
      const text = normalize(`${exercise.exercise_name} ${exercise.machine_name} ${bodyPartLabel(exercise.body_part)}`);
      return words.every((word) => text.includes(word));
    });
  }, [exercises, query]);

  if (error) return <ErrorMessage message={error} onRetry={retry} />;
  if (!exercises) return <p role="status" className={styles.muted}>読み込んでいます…</p>;
  if (results.length === 0) return <p className={styles.empty}>「{query.trim()}」に一致する記録はありません。</p>;

  return (
    <section aria-label="検索結果">
      <p className={styles.muted} role="status">{results.length}件</p>
      <ul className={styles.cardList}>
        {results.map((exercise) => (
          <li key={`${exercise.machine_id}-${exercise.exercise_id}`}>
            <ExerciseCard exercise={exercise} showPart onOpen={onOpen} />
          </li>
        ))}
      </ul>
    </section>
  );
}

// ── 部位 → 種目 → 履歴 ─────────────────────────────
function BodyPartView({ state, onOpen }: { state: ExercisesState; onOpen: (target: HistoryTarget) => void }) {
  const { exercises, error, retry } = state;
  // 部位はすべて閉じた状態で始め、タップした部位だけ開く
  const [opened, setOpened] = useState<Set<BodyPart>>(new Set());

  if (error) return <ErrorMessage message={error} onRetry={retry} />;
  if (!exercises) return <p role="status" className={styles.muted}>読み込んでいます…</p>;
  if (exercises.length === 0) return <p className={styles.empty}>まだ記録がありません。器具を使ったあとに記録を保存するとここに表示されます。</p>;

  // 部位の並びは固定（胸 → … → その他）。記録のない部位は出さない。
  const groups = BODY_PARTS
    .map((part) => ({ ...part, exercises: exercises.filter(({ body_part }) => body_part === part.id) }))
    .filter((group) => group.exercises.length > 0);

  function toggle(id: BodyPart) {
    setOpened((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  return (
    <div className={styles.timeline}>
      {groups.map((group) => {
        const open = opened.has(group.id);
        // exercises は最終実施日の新しい順に並んでいる
        const last = group.exercises[0].last_performed_at;
        return (
          <section key={group.id} aria-label={group.label}>
            <button type="button" className={styles.partHeading} aria-expanded={open} onClick={() => toggle(group.id)}>
              <ChevronDownIcon aria-hidden size={18} className={open ? undefined : styles.collapsed} />
              <span className={styles.partDot} data-part={group.id} aria-hidden />
              <strong>{group.label}</strong>
              <span className={styles.muted}>{group.exercises.length}種目・最終 {formatDay(new Date(last))}</span>
            </button>
            {open && (
              <ul className={styles.cardList}>
                {group.exercises.map((exercise) => (
                  <li key={`${exercise.machine_id}-${exercise.exercise_id}`}>
                    <ExerciseCard exercise={exercise} onOpen={onOpen} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

// ── カレンダー＋日別詳細 ───────────────────────────
type Adjacent = { anchor: string; prev: string | null; next: string | null };

function CalendarView({ onOpen }: { onOpen: (target: HistoryTarget) => void }) {
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [result, setResult] = useState<{ month: number; sessions: RecordSession[] } | null>(null);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [part, setPart] = useState<BodyPart | null>(null);
  const [adjacent, setAdjacent] = useState<Adjacent | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const next = new Date(month.getFullYear(), month.getMonth() + 1, 1);
    const url = `/api/records/sessions?limit=500&from=${encodeURIComponent(month.toISOString())}&before=${encodeURIComponent(next.toISOString())}`;
    getJson<{ sessions: RecordSession[] }>(url, controller.signal)
      .then((body) => { setResult({ month: month.getTime(), sessions: body.sessions }); setError(""); })
      .catch((e) => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "記録を取得できませんでした。"); });
    return () => controller.abort();
  }, [month, reload]);

  const sessions = result?.month === month.getTime() ? result.sessions : null;
  // 部位で絞り込んだ記録を日ごとにまとめる（新しい日が先）
  const byDay = useMemo(() => {
    const map = new Map<string, RecordSession[]>();
    const filtered = (sessions ?? []).filter(({ body_part }) => !part || body_part === part);
    for (const day of groupByDay(filtered)) map.set(day.key, day.sessions);
    return map;
  }, [sessions, part]);

  // 選択日が今月にない場合は、今日（今月なら）か、記録のある最新日を表示する
  const todayKey = dayKey(new Date());
  const activeKey = selectedKey && selectedKey.startsWith(dayKey(month).slice(0, 7))
    ? selectedKey
    : byDay.has(todayKey) ? todayKey : byDay.keys().next().value ?? null;
  const activeDate = activeKey ? keyToDate(activeKey) : null;
  const activeSessions = activeKey ? byDay.get(activeKey) ?? [] : [];

  // 「前の記録日」「次の記録日」の基準：選択日（なければ表示中の月）の前後
  const prevAt = (activeDate ?? month).toISOString();
  const nextAt = (activeDate
    ? new Date(activeDate.getFullYear(), activeDate.getMonth(), activeDate.getDate() + 1)
    : new Date(month.getFullYear(), month.getMonth() + 1, 1)).toISOString();
  const anchor = `${prevAt}|${nextAt}|${part ?? ""}`;
  const loaded = sessions !== null;

  useEffect(() => {
    if (!loaded) return;
    const controller = new AbortController();
    const query = (dir: "prev" | "next", at: string) =>
      getJson<{ performed_at: string | null }>(
        `/api/records/adjacent?dir=${dir}&at=${encodeURIComponent(at)}${part ? `&part=${part}` : ""}`, controller.signal)
        .then((body) => body.performed_at);
    Promise.all([query("prev", prevAt), query("next", nextAt)])
      .then(([prev, next]) => setAdjacent({ anchor, prev, next }))
      .catch(() => { if (!controller.signal.aborted) setAdjacent({ anchor, prev: null, next: null }); });
    return () => controller.abort();
  }, [loaded, anchor, prevAt, nextAt, part]);

  const current = adjacent?.anchor === anchor ? adjacent : null;

  function jumpTo(performedAt: string) {
    const date = new Date(performedAt);
    const target = new Date(date.getFullYear(), date.getMonth(), 1);
    if (target.getTime() !== month.getTime()) setMonth(target);
    setSelectedKey(dayKey(date));
  }

  function moveMonth(diff: number) {
    setMonth((value) => new Date(value.getFullYear(), value.getMonth() + diff, 1));
    setSelectedKey(null);
  }

  function changePart(next: BodyPart | null) {
    setPart(next);
    // 絞り込みを変えたら、その部位の記録がある日を選び直す
    setSelectedKey(null);
  }

  const cells: (Date | null)[] = [];
  for (let i = 0; i < month.getDay(); i++) cells.push(null);
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(month.getFullYear(), month.getMonth(), d));
  const partName = part ? bodyPartLabel(part) : "トレーニング";

  return (
    <div>
      <div className={styles.partFilter} role="group" aria-label="部位で絞り込み">
        <button type="button" aria-pressed={part === null} onClick={() => changePart(null)}>すべて</button>
        {BODY_PARTS.map(({ id, label }) => (
          <button key={id} type="button" aria-pressed={part === id} data-part={id}
            onClick={() => changePart(part === id ? null : id)}>
            <span className={styles.partDot} aria-hidden />{label}
          </button>
        ))}
      </div>

      <div className={styles.monthNav}>
        <button type="button" aria-label="前の月" onClick={() => moveMonth(-1)}><ChevronLeftIcon aria-hidden size={20} /></button>
        <h2>{month.getFullYear()}年{month.getMonth() + 1}月</h2>
        <button type="button" aria-label="次の月" onClick={() => moveMonth(1)}><ChevronRightIcon aria-hidden size={20} /></button>
      </div>
      <div className={styles.calendar} role="grid" aria-busy={!sessions}>
        {WEEKDAYS.map((label) => <span key={label} className={styles.weekday} role="columnheader">{label}</span>)}
        {cells.map((date, index) => {
          if (!date) return <span key={`blank-${index}`} />;
          const key = dayKey(date);
          const daySessions = byDay.get(key) ?? [];
          const parts = partsOf(daySessions);
          const className = [
            styles.day,
            daySessions.length > 0 && styles.hasRecord,
            key === activeKey && styles.selected,
            key === todayKey && styles.today,
          ].filter(Boolean).join(" ");
          return (
            <button key={key} type="button" role="gridcell" className={className}
              aria-label={`${formatDay(date)}${parts.length ? ` ${parts.map(({ label }) => label).join("・")}` : " 記録なし"}`}
              aria-selected={key === activeKey} onClick={() => setSelectedKey(key)}>
              <span>{date.getDate()}</span>
              {parts.length > 0 && (
                <span className={styles.dots} aria-hidden>
                  {parts.map(({ id }) => <span key={id} className={styles.partDot} data-part={id} />)}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <p className={styles.muted}>
        {sessions ? `この月の${partName}：${byDay.size}日` : "読み込んでいます…"}
      </p>

      {error && <ErrorMessage message={error} onRetry={() => { setError(""); setReload((v) => v + 1); }} />}

      <div className={styles.dayNav}>
        <button type="button" disabled={!current?.prev} onClick={() => current?.prev && jumpTo(current.prev)}>
          <ChevronLeftIcon aria-hidden size={18} />前の記録日
        </button>
        <button type="button" disabled={!current?.next} onClick={() => current?.next && jumpTo(current.next)}>
          次の記録日<ChevronRightIcon aria-hidden size={18} />
        </button>
      </div>

      {sessions && activeDate && (
        <section aria-label={`${formatFullDay(activeDate)}の記録`}>
          <h2 className={styles.dayHeading}>{formatFullDay(activeDate)}<PartChips sessions={activeSessions} /></h2>
          {activeSessions.length
            ? <SessionList sessions={activeSessions} onOpen={onOpen} />
            : <p className={styles.empty}>この日の{part ? `${partName}の` : ""}記録はありません。</p>}
        </section>
      )}
      {sessions && !activeDate && <p className={styles.empty}>この月の{part ? `${partName}の` : ""}記録はありません。</p>}
    </div>
  );
}

// ── 種目ごとの全履歴モーダル ───────────────────────
function HistoryModal({ target, onClose }: { target: HistoryTarget; onClose: () => void }) {
  const [history, setHistory] = useState<WorkoutSession[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    getJson<{ history: WorkoutSession[] }>(
      `/api/records/history?machineId=${target.machineId}&exerciseId=${target.exerciseId}`, controller.signal)
      .then((body) => setHistory(body.history))
      .catch((e) => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "履歴を取得できませんでした。"); });
    return () => controller.abort();
  }, [target.machineId, target.exerciseId]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const best = history?.reduce<number | null>((max, session) =>
    session.sets.reduce((m, set) => (m === null || set.weight_kg > m ? set.weight_kg : m), max), null);

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="history-title" onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHead}>
          <h2 id="history-title">{target.title}</h2>
          <button type="button" className={styles.modalClose} aria-label="閉じる" onClick={onClose}>✕</button>
        </div>
        <div className={styles.modalBody}>
          {error && <p role="alert" className={styles.error}>{error}</p>}
          {!error && history === null && <p className={styles.muted}>読み込んでいます…</p>}
          {history?.length === 0 && <p className={styles.muted}>まだ記録がありません。</p>}
          {history && history.length > 0 && (
            <p className={styles.muted}>{history.length}回・最高 {best}kg</p>
          )}
          {history?.map((session) => (
            <div key={session.performed_at} className={styles.historySession}>
              <h3>{formatFullDay(new Date(session.performed_at))}</h3>
              <ul>
                {session.sets.map((set, j) => (
                  <li key={j}>{j + 1}セット目：{set.weight_kg}kg × {set.reps}回</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function RecordsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const param = searchParams.get("view");
  const view: View = VIEWS.some(({ id }) => id === param) ? (param as View) : "part";
  const [target, setTarget] = useState<HistoryTarget | null>(null);
  const [query, setQuery] = useState(() => searchParams.get("q") ?? "");
  const closeModal = useCallback(() => setTarget(null), []);
  const exercisesState = useRecordExercises();
  const searching = query.trim() !== "";

  return (
    <main className={styles.main}>
      <h1 className={styles.title}>記録</h1>
      <div className={styles.search}>
        <SearchIcon aria-hidden size={18} />
        <label htmlFor="record-search" className={styles.srOnly}>種目・器具・部位を検索</label>
        <input id="record-search" type="search" value={query} placeholder="種目・器具・部位を検索"
          enterKeyHint="search" autoComplete="off"
          onChange={(event) => setQuery(event.target.value)} />
        {query && (
          <button type="button" aria-label="検索をクリア" onClick={() => setQuery("")}>
            <XIcon aria-hidden size={18} />
          </button>
        )}
      </div>
      {searching
        ? <SearchResults query={query} state={exercisesState} onOpen={setTarget} />
        : <>
      <div className={styles.tabs} role="tablist" aria-label="表示切り替え">
        {VIEWS.map(({ id, label }) => (
          <button key={id} type="button" role="tab" aria-selected={view === id}
            className={view === id ? styles.activeTab : undefined}
            onClick={() => router.replace(`/records?view=${id}`, { scroll: false })}>
            {label}
          </button>
        ))}
      </div>
      <div role="tabpanel">
        {view === "part" && <BodyPartView state={exercisesState} onOpen={setTarget} />}
        {view === "calendar" && <CalendarView onOpen={setTarget} />}
      </div>
      </>}
      {target && <HistoryModal target={target} onClose={closeModal} />}
    </main>
  );
}

export default function RecordsPage() {
  return (
    <div className={styles.page} lang="ja">
      <AppHeader />
      <Suspense fallback={<p className={styles.main}>読み込んでいます…</p>}>
        <RecordsContent />
      </Suspense>
    </div>
  );
}
