import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { SessionList } from "~/components/SessionList";
import { useUserId } from "~/lib/useUserId";

export default function HistoryPage() {
  const userId = useUserId();
  const sessions = useQuery(
    api.sessions.listByUser,
    userId ? { userId, limit: 100 } : "skip"
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-mono font-bold text-white">
        Session History
      </h1>

      <div className="bg-surface-light rounded-xl p-6">
        {sessions === undefined ? (
          <p className="text-gray-500 font-mono text-sm">Loading...</p>
        ) : (
          <SessionList sessions={sessions} />
        )}
      </div>
    </div>
  );
}
