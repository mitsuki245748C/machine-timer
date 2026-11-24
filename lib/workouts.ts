export type Exercise = { id: number; name: string };
export type SetInput = { weight: string; reps: string };
export type WorkoutSet = { weight_kg: number; reps: number };

export type LatestWorkout = {
  performed_at: string;
  sets: WorkoutSet[];
};
// 前記録参照用（形はlatestWorkoutと同じ）
export type WorkoutSession = {
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

// 種目のメインの部位（DB の exercises.body_part と同じ値）
export const BODY_PARTS = [
  { id: "chest", label: "胸" },
  { id: "back", label: "背中" },
  { id: "shoulders", label: "肩" },
  { id: "arms", label: "腕" },
  { id: "legs", label: "脚" },
  { id: "abs", label: "腹" },
  { id: "other", label: "その他" },
] as const;
export type BodyPart = (typeof BODY_PARTS)[number]["id"];

export function isBodyPart(value: unknown): value is BodyPart {
  return BODY_PARTS.some(({ id }) => id === value);
}

export function bodyPartLabel(value: string): string {
  return BODY_PARTS.find(({ id }) => id === value)?.label ?? "その他";
}

// 記録画面（/records）用：記録のある 器具×種目
export type RecordExercise = {
  machine_id: number;
  machine_name: string;
  exercise_id: number;
  exercise_name: string;
  body_part: BodyPart;
  last_performed_at: string;
  session_count: number;
  best_weight_kg: number | null;
};

export type RecordSession = {
  performed_at: string;
  machine_id: number | null;
  machine_name: string | null;
  exercise_id: number;
  exercise_name: string;
  body_part: BodyPart;
  sets: WorkoutSet[];
};
