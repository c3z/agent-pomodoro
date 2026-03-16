import { useState, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { SessionList } from "~/components/SessionList";
import { useUserId } from "~/lib/useUserId";

const PAGE_SIZE = 50;

export default function HistoryPage() {
  const userId = useUserId();
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const sessions = useQuery(
    api.sessions.listByUser,
    userId ? { userId, limit: limit + 1 } : "skip"
  );

  const hasMore = sessions && sessions.length > limit;
  const allSessions = hasMore ? sessions.slice(0, limit) : (sessions ?? []);

  // Extract unique tags from loaded sessions
  const uniqueTags = useMemo(() => {
    const tagSet = new Set<string>();
    for (const s of allSessions) {
      if (s.tags) {
        for (const tag of s.tags) {
          tagSet.add(tag);
        }
      }
    }
    return Array.from(tagSet).sort();
  }, [allSessions]);

  // Filter sessions by selected tag
  const displaySessions = useMemo(() => {
    if (!selectedTag) return allSessions;
    return allSessions.filter(
      (s) => s.tags && s.tags.includes(selectedTag)
    );
  }, [allSessions, selectedTag]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-mono font-bold text-white">
        Session History
      </h1>

      {/* Tag filter pills */}
      {uniqueTags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedTag(null)}
            className={`px-3 py-1 rounded-full font-mono text-xs transition-colors ${
              selectedTag === null
                ? "bg-pomored text-white"
                : "bg-surface-lighter text-gray-400 hover:text-white"
            }`}
          >
            All
          </button>
          {uniqueTags.map((tag) => (
            <button
              key={tag}
              onClick={() => setSelectedTag(tag === selectedTag ? null : tag)}
              className={`px-3 py-1 rounded-full font-mono text-xs transition-colors ${
                selectedTag === tag
                  ? "bg-pomored text-white"
                  : "bg-surface-lighter text-gray-400 hover:text-white"
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      <div className="bg-surface-light rounded-xl p-6">
        {sessions === undefined ? (
          <p className="text-gray-500 font-mono text-sm">Loading...</p>
        ) : (
          <>
            <SessionList sessions={displaySessions} />
            {hasMore && !selectedTag && (
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
