import { useRef } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Timer } from "~/components/Timer";
import { useUserId } from "~/lib/useUserId";
import type { Id } from "../../convex/_generated/dataModel";

export default function TimerPage() {
  const userId = useUserId();
  const startSession = useMutation(api.sessions.start);
  const completeSession = useMutation(api.sessions.complete);
  const interruptSession = useMutation(api.sessions.interrupt);
  const sessionIdRef = useRef<Id<"pomodoroSessions"> | null>(null);

  return (
    <div className="flex flex-col items-center pt-8">
      <Timer
        onSessionStart={async (type, duration) => {
          if (!userId) return;
          try {
            sessionIdRef.current = await startSession({
              userId,
              type,
              durationMinutes: duration,
            });
          } catch (e) {
            console.warn("[pomodoro] Failed to save session start:", e);
          }
        }}
        onSessionComplete={async () => {
          if (!sessionIdRef.current) return;
          try {
            await completeSession({ sessionId: sessionIdRef.current });
          } catch (e) {
            console.warn("[pomodoro] Failed to save session complete:", e);
          }
          sessionIdRef.current = null;
        }}
        onSessionInterrupt={async () => {
          if (!sessionIdRef.current) return;
          try {
            await interruptSession({ sessionId: sessionIdRef.current });
          } catch (e) {
            console.warn("[pomodoro] Failed to save interruption:", e);
          }
          sessionIdRef.current = null;
        }}
      />
    </div>
  );
}
