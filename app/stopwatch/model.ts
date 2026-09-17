export type StopwatchAction = "start" | "stop" | "reset";

export type StopwatchState = {
  isRunning: boolean;
  seconds: number;
};

export type StopwatchResponse = {
  machines: { id: number; state: StopwatchState }[];
};
