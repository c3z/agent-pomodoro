const QUEUE_KEY = "pomodoro-retry-queue";

interface QueuedMutation {
  action: "start" | "complete" | "interrupt";
  args: Record<string, unknown>;
  timestamp: number;
}

export function enqueue(mutation: Omit<QueuedMutation, "timestamp">) {
  const queue = getQueue();
  queue.push({ ...mutation, timestamp: Date.now() });
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export function getQueue(): QueuedMutation[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]");
  } catch {
    return [];
  }
}

export function clearQueue() {
  localStorage.removeItem(QUEUE_KEY);
}

export function removeItem(index: number) {
  const queue = getQueue();
  queue.splice(index, 1);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}
