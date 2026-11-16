const MINUTE = 60 * 1000;

// 予約が入ったとき、利用開始から何分未満なら「開始から20分」を期限にするか
const SHORT_USAGE = 15 * MINUTE;
const SHORT_USAGE_LIMIT = 20 * MINUTE;
// 長く使っている人には、予約が入ってから5分を期限にする
const LONG_USAGE_GRACE = 5 * MINUTE;

// 期限の何分前に知らせるか / 期限後に何分ごとに知らせ直すか
const BEFORE_DEADLINE = 5 * MINUTE;
const REPEAT_INTERVAL = 5 * MINUTE;

export type Notice = "before" | "deadline" | "overdue";

// 予約が入った時点での利用終了の期限
export function computeDeadline(startedAt: Date, reservedAt: Date): Date {
  const elapsed = reservedAt.getTime() - startedAt.getTime();
  return elapsed < SHORT_USAGE
    ? new Date(startedAt.getTime() + SHORT_USAGE_LIMIT)
    : new Date(reservedAt.getTime() + LONG_USAGE_GRACE);
}

// いま送るべき通知。なければ null。
// lastNotifiedAt は最後に通知した時刻（予約時の通知も含む）
export function nextNotice(
  deadline: Date,
  lastNotifiedAt: Date | null,
  now: Date,
): Notice | null {
  const last = lastNotifiedAt?.getTime() ?? -Infinity;
  const deadlineMs = deadline.getTime();

  if (now.getTime() >= deadlineMs) {
    if (last < deadlineMs) return "deadline";
    return now.getTime() - last >= REPEAT_INTERVAL ? "overdue" : null;
  }

  const beforeMs = deadlineMs - BEFORE_DEADLINE;
  return now.getTime() >= beforeMs && last < beforeMs ? "before" : null;
}
