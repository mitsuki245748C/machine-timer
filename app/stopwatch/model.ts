export type StopwatchAction = "start" | "reset" | "reserve";

export type StopwatchState = {
  isRunning: boolean;
  seconds: number;
  startedByMe: boolean;
  isReserved: boolean;
  reservedByMe: boolean;
};

export type StopwatchResponse = {
  machines: { id: number; state: StopwatchState }[];
};
