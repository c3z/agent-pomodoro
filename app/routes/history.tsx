import { SessionList } from "~/components/SessionList";

export default function HistoryPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-mono font-bold text-white">
        Session History
      </h1>

      <div className="bg-surface-light rounded-xl p-6">
        <p className="text-gray-500 font-mono text-sm mb-4">
          Connect Convex + Clerk to see your session history.
        </p>
        <SessionList sessions={[]} />
      </div>
    </div>
  );
}
