import { useRef, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Timer } from "~/components/Timer";
import { useUserId } from "~/lib/useUserId";
import { enqueue, getQueue, removeItem } from "~/lib/retryQueue";
import type { Id } from "../../convex/_generated/dataModel";

export default function TimerPage() {
  const userId = useUserId();
  const startSession = useMutation(api.sessions.start);
  const completeSession = useMutation(api.sessions.complete);
  const interruptSession = useMutation(api.sessions.interrupt);
  const hasClerk = !!import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
  const activeSession = useQuery(
    api.sessions.activeSession,
    hasClerk && userId ? { userId } : "skip"
  );
  const sessionIdRef = useRef<Id<"pomodoroSessions"> | null>(null);

  // Flush retry queue when online
  useEffect(() => {
    if (!userId) return;
    let flushing = false;

    const flush = async () => {
      if (flushing) return;
      flushing = true;
      try {
      const queue = getQueue();
      if (queue.length === 0) return;

      for (let i = queue.length - 1; i >= 0; i--) {
        const item = queue[i];
        try {
          if (item.action === "start") {
            await startSession(item.args as Parameters<typeof startSession>[0]);
          } else if (item.action === "complete") {
            await completeSession(item.args as Parameters<typeof completeSession>[0]);
          } else if (item.action === "interrupt") {
            await interruptSession(item.args as Parameters<typeof interruptSession>[0]);
          }
          removeItem(i);
        } catch {
          // Still offline or failed — leave in queue
        }
      }
      } finally {
        flushing = false;
      }
    };

    flush();
    window.addEventListener("online", flush);
    return () => window.removeEventListener("online", flush);
  }, [userId, startSession, completeSession, interruptSession]);

  return (
    <div className="flex flex-col items-center pt-8">
      <Timer
        remoteSession={activeSession ?? null}
        onRemoteSessionSync={(sessionId) => {
          sessionIdRef.current = sessionId as Id<"pomodoroSessions">;
        }}
        onSessionStart={async (type, duration) => {
          if (!userId) return;
          const args = { userId, type, durationMinutes: duration };
          try {
            const id = await startSession(args);
            sessionIdRef.current = id;
          } catch (e) {
            console.warn("[pomodoro] Failed to save session start:", e);
            enqueue({ action: "start", args });
          }
        }}
        onSessionComplete={async (_type, notes, tags) => {
          if (sessionIdRef.current) {
            const args = {
              sessionId: sessionIdRef.current,
              userId: userId!,
              notes,
              tags,
            };
            try {
              await completeSession(args);
            } catch (e) {
              console.warn("[pomodoro] Failed to save session complete:", e);
              enqueue({ action: "complete", args });
            }
            sessionIdRef.current = null;
          }
        }}
        onSessionInterrupt={async () => {
          if (sessionIdRef.current) {
            const args = { sessionId: sessionIdRef.current, userId: userId! };
            try {
              await interruptSession(args);
            } catch (e) {
              console.warn("[pomodoro] Failed to save interruption:", e);
              enqueue({ action: "interrupt", args });
            }
            sessionIdRef.current = null;
          }
        }}
      />
    </div>
  );
}
