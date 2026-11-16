export type StopwatchAction = "start" | "reset" | "reserve" | "cancel";

// 予約していた器具が空いてから、予約した人だけが使える時間（秒）
export const RESERVATION_HOLD_SECONDS = 3 * 60;

// 予約していた器具が空いた直後の「予約者の順番」の状態
export type ReservationHold = {
  forMe: boolean;
  secondsLeft: number;
};

export type StopwatchState = {
  isRunning: boolean;
  seconds: number;
  startedByMe: boolean;
  isReserved: boolean;
  reservedByMe: boolean;
  // 空いていて予約者の順番のときだけ値が入る
  hold: ReservationHold | null;
};

export type StopwatchResponse = {
  isAdmin: boolean;
  // 自分が予約している（または順番が来ている）器具。予約は1人1つまで
  myReservationMachineId: number | null;
  machines: { id: number; state: StopwatchState }[];
};
