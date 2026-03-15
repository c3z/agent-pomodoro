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
          const id = await startSession({
            userId,
            type,
            durationMinutes: duration,
          });
          sessionIdRef.current = id;
        }}
        onSessionComplete={async () => {
          if (sessionIdRef.current) {
            await completeSession({ sessionId: sessionIdRef.current });
            sessionIdRef.current = null;
          }
        }}
        onSessionInterrupt={async () => {
          if (sessionIdRef.current) {
            await interruptSession({ sessionId: sessionIdRef.current });
            sessionIdRef.current = null;
          }
        }}
      />
    </div>
  );
}
