import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useUserId } from "~/lib/useUserId";
import {
  loadTimerSettings,
  saveTimerSettings,
  DEFAULT_CONFIG,
  type TimerConfig,
} from "~/lib/timerSettings";
import { loadWorkdayHours, saveWorkdayHours } from "~/lib/accountability";
import { isSoundMuted, setSoundMuted } from "~/lib/sounds";

async function generateApiKey(): Promise<string> {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `apom_${hex}`;
}

async function hashKey(key: string): Promise<string> {
  const encoded = new TextEncoder().encode(key);
  const buf = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString("pl-PL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatRelative(ts: number) {
  const diff = Date.now() - ts;
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function Settings() {
  const userId = useUserId();
  const keys = useQuery(api.apiKeys.listByUser, userId ? { userId } : "skip");
  const createKey = useMutation(api.apiKeys.create);
  const revokeKey = useMutation(api.apiKeys.revoke);

  const [newKeyName, setNewKeyName] = useState("");
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Timer settings state
  const [timerConfig, setTimerConfig] = useState<TimerConfig>(DEFAULT_CONFIG);
  const [timerSaved, setTimerSaved] = useState(false);

  useEffect(() => {
    setTimerConfig(loadTimerSettings());
  }, []);

  const handleTimerSave = () => {
    saveTimerSettings(timerConfig);
    setTimerSaved(true);
    setTimeout(() => setTimerSaved(false), 2000);
  };

  const handleTimerReset = () => {
    setTimerConfig({ ...DEFAULT_CONFIG });
    saveTimerSettings(DEFAULT_CONFIG);
    setTimerSaved(true);
    setTimeout(() => setTimerSaved(false), 2000);
  };

  const updateTimerField = (field: keyof TimerConfig, value: string) => {
    const num = parseInt(value, 10);
    if (isNaN(num)) return;
    setTimerConfig((prev) => ({ ...prev, [field]: num }));
  };

  // Workday hours
  const [workdayStart, setWorkdayStart] = useState(() => loadWorkdayHours().start);
  const [workdayEnd, setWorkdayEnd] = useState(() => loadWorkdayHours().end);
  const [workdayError, setWorkdayError] = useState<string | null>(null);
  const [workdaySaved, setWorkdaySaved] = useState(false);

  // Sound mute
  const [muted, setMuted] = useState(() => isSoundMuted());

  useEffect(() => {
    if (!revealedKey) return;
    const timer = setTimeout(() => setRevealedKey(null), 60_000);
    return () => clearTimeout(timer);
  }, [revealedKey]);

  const handleCreate = async () => {
    if (!userId || !newKeyName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const plainKey = await generateApiKey();
      const keyHash = await hashKey(plainKey);
      const keyPrefix = plainKey.slice(0, 12) + "...";
      await createKey({ userId, name: newKeyName.trim(), keyHash, keyPrefix });
      setRevealedKey(plainKey);
      setNewKeyName("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create API key");
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = async () => {
    if (!revealedKey) return;
    await navigator.clipboard.writeText(revealedKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRevoke = async (keyId: Parameters<typeof revokeKey>[0]["keyId"]) => {
    if (!userId) return;
    await revokeKey({ keyId, userId });
  };

  const handleSaveWorkday = () => {
    const start = Math.max(0, Math.min(23, workdayStart));
    const end = Math.max(0, Math.min(23, workdayEnd));
    if (end <= start) {
      setWorkdayError("End hour must be after start hour");
      return;
    }
    setWorkdayError(null);
    setWorkdayStart(start);
    setWorkdayEnd(end);
    saveWorkdayHours(start, end);
    setWorkdaySaved(true);
    setTimeout(() => setWorkdaySaved(false), 2000);
  };

  const handleToggleMute = () => {
    const next = !muted;
    setMuted(next);
    setSoundMuted(next);
  };

  const activeKeys = keys?.filter((k) => !k.revoked) ?? [];
  const revokedKeys = keys?.filter((k) => k.revoked) ?? [];

  return (
    <div className="space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold font-mono text-white">Settings</h1>
        <p className="text-gray-500 font-mono text-sm">
          Preferences and API keys
        </p>
      </div>

      {/* Timer Settings */}
      <div className="bg-surface-light rounded-xl p-6 space-y-4">
        <h2 className="text-lg font-mono font-bold text-gray-400">
          Timer Durations
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-gray-400 text-xs font-mono block mb-1">
              Focus (min)
            </label>
            <input
              type="number"
              min={1}
              max={120}
              value={timerConfig.work}
              onChange={(e) => updateTimerField("work", e.target.value)}
              className="w-full bg-surface rounded-lg px-4 py-2 font-mono text-sm text-white border border-surface-lighter focus:border-pomored focus:outline-none"
            />
          </div>
          <div>
            <label className="text-gray-400 text-xs font-mono block mb-1">
              Break (min)
            </label>
            <input
              type="number"
              min={1}
              max={60}
              value={timerConfig.break}
              onChange={(e) => updateTimerField("break", e.target.value)}
              className="w-full bg-surface rounded-lg px-4 py-2 font-mono text-sm text-white border border-surface-lighter focus:border-pomored focus:outline-none"
            />
          </div>
          <div>
            <label className="text-gray-400 text-xs font-mono block mb-1">
              Long break (min)
            </label>
            <input
              type="number"
              min={1}
              max={60}
              value={timerConfig.longBreak}
              onChange={(e) => updateTimerField("longBreak", e.target.value)}
              className="w-full bg-surface rounded-lg px-4 py-2 font-mono text-sm text-white border border-surface-lighter focus:border-pomored focus:outline-none"
            />
          </div>
          <div>
            <label className="text-gray-400 text-xs font-mono block mb-1">
              Long break every
            </label>
            <input
              type="number"
              min={1}
              max={10}
              value={timerConfig.longBreakInterval}
              onChange={(e) => updateTimerField("longBreakInterval", e.target.value)}
              className="w-full bg-surface rounded-lg px-4 py-2 font-mono text-sm text-white border border-surface-lighter focus:border-pomored focus:outline-none"
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleTimerSave}
            className="px-6 py-2 bg-pomored hover:bg-pomored-dark text-white rounded-lg font-mono text-sm font-bold transition-colors"
          >
            Save
          </button>
          <button
            onClick={handleTimerReset}
            className="px-6 py-2 bg-surface hover:bg-surface-lighter text-gray-400 rounded-lg font-mono text-sm transition-colors"
          >
            Reset to defaults
          </button>
          {timerSaved && (
            <span className="text-breakgreen font-mono text-xs">
              Saved!
            </span>
          )}
        </div>
        <p className="text-gray-600 font-mono text-xs">
          Changes apply on next timer start. Reload the timer page to pick up
          new durations.
        </p>
      </div>

      {/* Work Schedule */}
      <div className="bg-surface-light rounded-xl p-6 space-y-4">
        <h2 className="text-lg font-mono font-bold text-gray-400">
          Work Schedule
        </h2>
        <p className="text-gray-600 font-mono text-xs">
          Accountability scoring uses these hours as your workday window.
        </p>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <label className="block text-gray-500 font-mono text-xs mb-1">
              Start hour
            </label>
            <input
              type="number"
              min={0}
              max={23}
              value={workdayStart}
              onChange={(e) => setWorkdayStart(Number(e.target.value))}
              className="w-full bg-surface rounded-lg px-4 py-2 font-mono text-sm text-white border border-surface-lighter focus:border-pomored focus:outline-none"
            />
          </div>
          <div className="flex-1">
            <label className="block text-gray-500 font-mono text-xs mb-1">
              End hour
            </label>
            <input
              type="number"
              min={0}
              max={23}
              value={workdayEnd}
              onChange={(e) => setWorkdayEnd(Number(e.target.value))}
              className="w-full bg-surface rounded-lg px-4 py-2 font-mono text-sm text-white border border-surface-lighter focus:border-pomored focus:outline-none"
            />
          </div>
          <div className="flex-none pt-5">
            <button
              onClick={handleSaveWorkday}
              className="px-6 py-2 bg-pomored hover:bg-pomored-dark text-white rounded-lg font-mono text-sm font-bold transition-colors"
            >
              {workdaySaved ? "Saved!" : "Save"}
            </button>
          </div>
        </div>
        {workdayError && (
          <p className="text-red-400 font-mono text-xs">{workdayError}</p>
        )}
      </div>

      {/* Sound */}
      <div className="bg-surface-light rounded-xl p-6 space-y-4">
        <h2 className="text-lg font-mono font-bold text-gray-400">Sound</h2>
        <label className="flex items-center gap-3 cursor-pointer">
          <button
            type="button"
            role="switch"
            aria-checked={!muted}
            onClick={handleToggleMute}
            className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors ${
              muted ? "bg-surface-lighter" : "bg-breakgreen"
            }`}
          >
            <span
              className={`inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform mt-0.5 ${
                muted ? "translate-x-0.5" : "translate-x-[22px]"
              }`}
            />
          </button>
          <span className="font-mono text-sm text-gray-300">
            {muted ? "Sounds muted" : "Sounds enabled"}
          </span>
        </label>
      </div>

      {/* New key revealed banner */}
      {revealedKey && (
        <div className="bg-breakgreen/10 border border-breakgreen/30 rounded-xl p-4 space-y-3">
          <p className="text-breakgreen font-mono text-sm font-bold">
            API key created — copy it now, it won't be shown again
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-surface-light rounded-lg p-3 text-xs font-mono text-white break-all select-all">
              {revealedKey}
            </code>
            <button
              onClick={handleCopy}
              className="shrink-0 px-4 py-3 bg-breakgreen text-black rounded-lg font-mono text-xs font-bold hover:bg-breakgreen/80 transition-colors"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <button
            onClick={() => setRevealedKey(null)}
            className="text-gray-500 font-mono text-xs hover:text-gray-300"
          >
            Dismiss
          </button>
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
          <p className="text-red-400 font-mono text-sm">{error}</p>
        </div>
      )}

      {/* Create new key */}
      <div className="bg-surface-light rounded-xl p-6 space-y-4">
        <h2 className="text-lg font-mono font-bold text-gray-400">
          Create API Key
        </h2>
        <div className="flex gap-2">
          <input
            type="text"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            placeholder="Key name (e.g. atropa-agent)"
            className="flex-1 bg-surface rounded-lg px-4 py-2 font-mono text-sm text-white placeholder-gray-600 border border-surface-lighter focus:border-pomored focus:outline-none"
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            maxLength={50}
          />
          <button
            onClick={handleCreate}
            disabled={creating || !newKeyName.trim()}
            className="px-6 py-2 bg-pomored hover:bg-pomored-dark disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-mono text-sm font-bold transition-colors"
          >
            {creating ? "..." : "Create"}
          </button>
        </div>
        <p className="text-gray-600 font-mono text-xs">
          Use API keys to access your pomodoro data via REST API.
          <br />
          Endpoint:{" "}
          <code className="text-gray-500">
            GET /api/status -H "Authorization: Bearer apom_xxx"
          </code>
        </p>
      </div>

      {/* Active keys */}
      {activeKeys.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-mono font-bold text-gray-400">
            Active Keys ({activeKeys.length})
          </h2>
          {activeKeys.map((key) => (
            <div
              key={key._id}
              className="bg-surface-light rounded-xl p-4 flex items-center justify-between gap-4"
            >
              <div className="min-w-0">
                <p className="font-mono text-sm text-white font-bold truncate">
                  {key.name}
                </p>
                <p className="font-mono text-xs text-gray-500">
                  {key.keyPrefix} · Created {formatDate(key.createdAt)}
                  {key.lastUsedAt && ` · Last used ${formatRelative(key.lastUsedAt)}`}
                </p>
              </div>
              <button
                onClick={() => handleRevoke(key._id)}
                className="shrink-0 px-3 py-1.5 text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-lg font-mono text-xs transition-colors"
              >
                Revoke
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Revoked keys */}
      {revokedKeys.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-mono font-bold text-gray-400 opacity-50">
            Revoked ({revokedKeys.length})
          </h2>
          {revokedKeys.map((key) => (
            <div
              key={key._id}
              className="bg-surface-light/50 rounded-xl p-4 opacity-50"
            >
              <p className="font-mono text-sm text-gray-500 line-through">
                {key.name}
              </p>
              <p className="font-mono text-xs text-gray-600">
                {key.keyPrefix} · Created {formatDate(key.createdAt)}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* API docs section */}
      <div className="bg-surface-light rounded-xl p-6 space-y-4">
        <h2 className="text-lg font-mono font-bold text-gray-400">
          API Reference
        </h2>
        <div className="space-y-3 font-mono text-xs">
          <div className="bg-surface rounded-lg p-3">
            <p className="text-breakgreen">GET /api/status</p>
            <p className="text-gray-500 mt-1">Agent summary — today, week, streak</p>
          </div>
          <div className="bg-surface rounded-lg p-3">
            <p className="text-breakgreen">GET /api/stats?days=7</p>
            <p className="text-gray-500 mt-1">
              Detailed statistics for the last N days
            </p>
          </div>
          <div className="bg-surface rounded-lg p-3">
            <p className="text-breakgreen">GET /api/sessions/today</p>
            <p className="text-gray-500 mt-1">Today's pomodoro sessions</p>
          </div>
          <div className="bg-surface rounded-lg p-3">
            <p className="text-breakgreen">GET /api/sessions?limit=50</p>
            <p className="text-gray-500 mt-1">Recent sessions (max 200)</p>
          </div>
        </div>
        <p className="text-gray-600 font-mono text-xs">
          All endpoints require{" "}
          <code className="text-gray-500">Authorization: Bearer apom_xxx</code>{" "}
          header.
        </p>
      </div>
    </div>
  );
}
