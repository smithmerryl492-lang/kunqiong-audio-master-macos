export interface TimedTask {
  id: string;
  startTime: string;
  duration: string;
  endTime: string;
  audioSource: string;
  outputFormat: string;
  status: "waiting" | "recording" | "completed" | "error";
  durationType: "duration" | "endTime";
}
