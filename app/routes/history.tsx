import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { SessionList } from "~/components/SessionList";
import { useUserId } from "~/lib/useUserId";

const PAGE_SIZE = 50;

export default function HistoryPage() {
  const userId = useUserId();
  const [limit, setLimit] = useState(PAGE_SIZE);
  const sessions = useQuery(
    api.sessions.listByUser,
    userId ? { userId, limit: limit + 1 } : "skip"
  );

  const hasMore = sessions && sessions.length > limit;
  const displaySessions = hasMore ? sessions.slice(0, limit) : (sessions ?? []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-mono font-bold text-white">
        Session History
      </h1>

      <div className="bg-surface-light rounded-xl p-6">
        {sessions === undefined ? (
          <p className="text-gray-500 font-mono text-sm">Loading...</p>
        ) : (
          <>
            <SessionList sessions={displaySessions} />
            {hasMore && (
              <div className="text-center mt-6">
                <button
                  onClick={() => setLimit((prev) => prev + PAGE_SIZE)}
                  className="px-6 py-2 bg-surface-lighter text-gray-400 hover:text-white rounded-lg font-mono text-sm transition-colors"
                >
                  Load more
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
