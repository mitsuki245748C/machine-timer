export type Exercise = { id: number; name: string };
export type SetInput = { weight: string; reps: string };
export type WorkoutSet = { weight_kg: number; reps: number };
export type LatestWorkout = {
  performed_at: string;
  sets: WorkoutSet[];
};
export type HistoryData = {
  machine: { id: number; name: string };
  usageId: number | null;
  exercises: Exercise[];
};

export function isPositiveId(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

// numeric(5, 2) / PostgreSQL int の範囲に合わせる。空欄を 0 に変換しない。
export function parseSets(value: unknown): WorkoutSet[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > 100) return null;
  const result: WorkoutSet[] = [];
  for (const set of value) {
    if (!set || typeof set !== "object") return null;
    const { weight, reps } = set;
    if (typeof weight !== "string" || !/^\d+(?:\.\d{1,2})?$/.test(weight)) return null;
    if (typeof reps !== "string" || !/^\d+$/.test(reps)) return null;
    const weightNumber = Number(weight);
    const repsNumber = Number(reps);
    if (!Number.isFinite(weightNumber) || weightNumber > 999.99) return null;
    if (!Number.isSafeInteger(repsNumber) || repsNumber < 1 || repsNumber > 2147483647) return null;
    result.push({ weight_kg: weightNumber, reps: repsNumber });
  }
  return result;
}
