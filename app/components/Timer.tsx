import { useState, useEffect, useRef } from "react";
import { playCompletionSound } from "~/lib/sounds";

type TimerMode = "work" | "break" | "longBreak";

interface TimerConfig {
  work: number;
  break: number;
  longBreak: number;
  longBreakInterval: number;
}

const DEFAULT_CONFIG: TimerConfig = {
  work: 25,
  break: 5,
  longBreak: 15,
  longBreakInterval: 4,
};

const MODE_LABELS: Record<TimerMode, string> = {
  work: "FOCUS",
  break: "BREAK",
  longBreak: "LONG BREAK",
};

const MODE_COLORS: Record<TimerMode, string> = {
  work: "text-pomored",
  break: "text-breakgreen",
  longBreak: "text-blue-400",
};

function sendNotification(mode: TimerMode) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  const title = mode === "work" ? "Focus session complete!" : "Break is over!";
  const body =
    mode === "work"
      ? "Time for a break."
      : "Ready to focus again.";
  new Notification(title, { body, icon: "/favicon.ico" });
}

interface RemoteSession {
  _id: string;
  type: TimerMode;
  durationMinutes: number;
  startedAt: number;
}

interface TimerProps {
  onSessionStart?: (type: TimerMode, durationMinutes: number) => void;
  onSessionComplete?: (type: TimerMode, notes?: string, tags?: string[]) => void;
  onSessionInterrupt?: () => void;
  remoteSession?: RemoteSession | null;
  onRemoteSessionSync?: (sessionId: string) => void;
}

export function Timer({
  onSessionStart,
  onSessionComplete,
  onSessionInterrupt,
  remoteSession,
  onRemoteSessionSync,
}: TimerProps) {
  const [mode, setMode] = useState<TimerMode>("work");
  const [secondsLeft, setSecondsLeft] = useState(DEFAULT_CONFIG.work * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [completedPomodoros, setCompletedPomodoros] = useState(0);
  const [showCompletion, setShowCompletion] = useState(false);
  const [completionNotes, setCompletionNotes] = useState("");
  const [completionTags, setCompletionTags] = useState<string[]>([]);

  // Wall-clock anchor: when the timer should end
  const endTimeRef = useRef<number>(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedRef = useRef(false);

  // Wake Lock — keep screen on during active timer
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  const requestWakeLock = async () => {
    if (typeof navigator === "undefined" || !("wakeLock" in navigator)) return;
    try {
      wakeLockRef.current = await navigator.wakeLock.request("screen");
    } catch {}
  };

  const releaseWakeLock = () => {
    wakeLockRef.current?.release().catch(() => {});
    wakeLockRef.current = null;
  };

  // Release wake lock on unmount (e.g. navigating away from /timer)
  useEffect(() => () => releaseWakeLock(), []);

  // Sync with remotely-started sessions (e.g. via CLI or API)
  const syncedSessionRef = useRef<string | null>(null);
  useEffect(() => {
    if (!remoteSession) {
      syncedSessionRef.current = null;
      return;
    }
    // Already synced to this session, or already running locally
    if (syncedSessionRef.current === remoteSession._id) return;
    if (startedRef.current) return;

    const elapsed = (Date.now() - remoteSession.startedAt) / 1000;
    const total = remoteSession.durationMinutes * 60;
    const remaining = Math.max(0, Math.ceil(total - elapsed));

    if (remaining <= 0) return; // Session already expired

    syncedSessionRef.current = remoteSession._id;
    setMode(remoteSession.type);
    setSecondsLeft(remaining);
    endTimeRef.current = Date.now() + remaining * 1000;
    startedRef.current = true;
    completedRef.current = true;
    setIsRunning(true);
    setIsPaused(false);
    requestWakeLock();
    onRemoteSessionSync?.(remoteSession._id);
  }, [remoteSession]);

  // Stable refs for callbacks to avoid useEffect dependency issues
  const onCompleteRef = useRef(onSessionComplete);
  onCompleteRef.current = onSessionComplete;
  const onInterruptRef = useRef(onSessionInterrupt);
  onInterruptRef.current = onSessionInterrupt;
  const onStartRef = useRef(onSessionStart);
  onStartRef.current = onSessionStart;

  const totalSeconds = DEFAULT_CONFIG[mode] * 60;
  const progress = ((totalSeconds - secondsLeft) / totalSeconds) * 100;

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // Update tab title
  useEffect(() => {
    if (isRunning) {
      document.title = `${formatTime(secondsLeft)} — ${MODE_LABELS[mode]}`;
    } else if (isPaused) {
      document.title = `⏸ ${formatTime(secondsLeft)} — ${MODE_LABELS[mode]}`;
    } else {
      document.title = "Agent Pomodoro";
    }
    return () => {
      document.title = "Agent Pomodoro";
    };
  }, [secondsLeft, isRunning, isPaused, mode]);

  // Wall-clock tick
  useEffect(() => {
    if (!isRunning) return;

    const tick = () => {
      const remaining = Math.max(
        0,
        Math.ceil((endTimeRef.current - Date.now()) / 1000)
      );
      setSecondsLeft(remaining);
      if (remaining <= 0) {
        clearInterval(intervalRef.current!);
        intervalRef.current = null;
        setIsRunning(false);
        setIsPaused(false);
        startedRef.current = false;

        playCompletionSound(modeRef.current);
        releaseWakeLock();
      }
    };

    intervalRef.current = setInterval(tick, 250);
    tick(); // immediate first tick
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isRunning]);

  // Detect completion: secondsLeft hit 0 and timer stopped
  const completedRef = useRef(false);
  const modeRef = useRef(mode);
  modeRef.current = mode;

  useEffect(() => {
    if (secondsLeft > 0 || isRunning) return;
    if (!completedRef.current) return;
    completedRef.current = false;

    const currentMode = modeRef.current;
    sendNotification(currentMode);

    if (currentMode === "work") {
      // Show completion form for work sessions
      setShowCompletion(true);
    } else {
      onCompleteRef.current?.(currentMode);
      setMode("work");
      setSecondsLeft(DEFAULT_CONFIG.work * 60);
    }
  }, [secondsLeft, isRunning]);

  const advanceAfterCompletion = (notes?: string, tags?: string[]) => {
    onCompleteRef.current?.("work", notes, tags);
    setShowCompletion(false);
    setCompletionNotes("");
    setCompletionTags([]);

    const newCount = completedPomodoros + 1;
    setCompletedPomodoros(newCount);
    const nextMode =
      newCount % DEFAULT_CONFIG.longBreakInterval === 0
        ? "longBreak"
        : "break";
    setMode(nextMode);
    setSecondsLeft(DEFAULT_CONFIG[nextMode] * 60);
  };

  const handleCompletionSubmit = () => {
    advanceAfterCompletion(
      completionNotes.trim() || undefined,
      completionTags.length > 0 ? completionTags : undefined
    );
  };

  const handleCompletionSkip = () => {
    advanceAfterCompletion();
  };

  const toggleTag = (tag: string) => {
    setCompletionTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const QUICK_TAGS = ["deep-work", "meetings", "code", "writing", "learning", "admin"];

  // Visibilitychange: recalculate when tab regains focus + re-acquire wake lock
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible" && endTimeRef.current > 0) {
        const remaining = Math.max(
          0,
          Math.ceil((endTimeRef.current - Date.now()) / 1000)
        );
        setSecondsLeft(remaining);
        // Re-acquire wake lock (released automatically on tab hide)
        if (isRunningRef.current) requestWakeLock();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  // Keyboard shortcuts — use refs to avoid re-registering on every render
  const isRunningRef = useRef(isRunning);
  isRunningRef.current = isRunning;
  const startRef = useRef<(() => void) | undefined>(undefined);
  const pauseRef = useRef<(() => void) | undefined>(undefined);
  const stopRef = useRef<(() => void) | undefined>(undefined);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;
      if (e.code === "Space") {
        e.preventDefault();
        if (isRunningRef.current) {
          pauseRef.current?.();
        } else {
          startRef.current?.();
        }
      } else if (e.code === "Escape") {
        e.preventDefault();
        stopRef.current?.();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  const start = () => {
    // Request notification permission on first start
    if (
      typeof window !== "undefined" &&
      "Notification" in window &&
      Notification.permission === "default"
    ) {
      Notification.requestPermission();
    }

    if (!startedRef.current) {
      startedRef.current = true;
      completedRef.current = true; // arm completion detection
      onStartRef.current?.(mode, DEFAULT_CONFIG[mode]);
    }
    endTimeRef.current = Date.now() + secondsLeft * 1000;
    setIsRunning(true);
    setIsPaused(false);
    requestWakeLock();
  };

  const pause = () => {
    setIsRunning(false);
    setIsPaused(true);
    releaseWakeLock();
    // Freeze remaining time from wall clock
    const remaining = Math.max(
      0,
      Math.ceil((endTimeRef.current - Date.now()) / 1000)
    );
    setSecondsLeft(remaining);
  };

  const stop = () => {
    setIsRunning(false);
    setIsPaused(false);
    releaseWakeLock();
    endTimeRef.current = 0;
    if (startedRef.current) {
      onInterruptRef.current?.();
      startedRef.current = false;
      completedRef.current = false;
    }
    setSecondsLeft(DEFAULT_CONFIG[mode] * 60);
  };

  // Keep keyboard refs current
  startRef.current = start;
  pauseRef.current = pause;
  stopRef.current = stop;

  const switchMode = (newMode: TimerMode) => {
    if (isRunning) return;
    if (startedRef.current) {
      onInterruptRef.current?.();
      startedRef.current = false;
      completedRef.current = false;
    }
    setMode(newMode);
    setIsPaused(false);
    setSecondsLeft(DEFAULT_CONFIG[newMode] * 60);
  };

  return (
    <div className="flex flex-col items-center gap-8">
      {/* Mode Selector */}
      <div className="flex gap-2">
        {(["work", "break", "longBreak"] as TimerMode[]).map((m) => (
          <button
            key={m}
            onClick={() => switchMode(m)}
            disabled={isRunning}
            className={`px-4 py-2 rounded-lg font-mono text-sm transition-colors ${
              mode === m
                ? "bg-surface-lighter text-white"
                : "text-gray-500 hover:text-gray-300 disabled:opacity-30"
            }`}
          >
            {MODE_LABELS[m]}
          </button>
        ))}
      </div>

      {/* Timer Display */}
      <div className="relative">
        {/* Progress Ring */}
        <svg
          className="w-48 h-48 sm:w-64 sm:h-64 -rotate-90"
          viewBox="0 0 120 120"
        >
          <circle
            cx="60"
            cy="60"
            r="54"
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
            className="text-surface-lighter"
          />
          <circle
            cx="60"
            cy="60"
            r="54"
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
            strokeDasharray={`${2 * Math.PI * 54}`}
            strokeDashoffset={`${2 * Math.PI * 54 * (1 - progress / 100)}`}
            strokeLinecap="round"
            className={`${MODE_COLORS[mode]} transition-all duration-300`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className={`text-4xl sm:text-5xl font-mono font-bold ${MODE_COLORS[mode]}`}
          >
            {formatTime(secondsLeft)}
          </span>
          <span className="text-gray-500 text-sm font-mono mt-1">
            {MODE_LABELS[mode]}
          </span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex gap-4">
        {!isRunning ? (
          <button
            onClick={start}
            className="px-8 py-3 bg-pomored hover:bg-pomored-dark text-white rounded-xl font-bold text-lg transition-colors"
            data-testid="start-button"
          >
            {isPaused ? "Resume" : "Start"}
          </button>
        ) : (
          <button
            onClick={pause}
            className="px-8 py-3 bg-surface-lighter hover:bg-surface-light text-white rounded-xl font-bold text-lg transition-colors"
            data-testid="pause-button"
          >
            Pause
          </button>
        )}
        <button
          onClick={stop}
          className="px-6 py-3 bg-surface-light hover:bg-surface-lighter text-gray-400 rounded-xl transition-colors"
          data-testid="stop-button"
        >
          Reset
        </button>
      </div>

      {/* Keyboard hint */}
      <div className="text-gray-600 text-xs font-mono">
        Space = start/pause · Esc = reset
      </div>

      {/* Pomodoro Counter */}
      <div className="flex gap-2 items-center">
        {Array.from({ length: DEFAULT_CONFIG.longBreakInterval }).map(
          (_, i) => (
            <div
              key={i}
              className={`w-3 h-3 rounded-full ${
                i < completedPomodoros % DEFAULT_CONFIG.longBreakInterval
                  ? "bg-pomored"
                  : "bg-surface-lighter"
              }`}
            />
          )
        )}
        <span className="text-gray-500 font-mono text-sm ml-2">
          {completedPomodoros} done
        </span>
      </div>

      {/* Completion Form */}
      {showCompletion && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
          onKeyDown={(e) => {
            if (e.key === "Escape") handleCompletionSkip();
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleCompletionSubmit();
          }}
        >
          <div className="bg-surface rounded-2xl p-6 w-full max-w-md space-y-4">
            <h3 className="text-lg font-mono font-bold text-breakgreen text-center">
              Session complete!
            </h3>

            <div>
              <label className="text-gray-400 text-xs font-mono block mb-1">
                What did you work on?
              </label>
              <textarea
                value={completionNotes}
                onChange={(e) => setCompletionNotes(e.target.value)}
                placeholder="Optional notes..."
                className="w-full bg-surface-light rounded-lg px-3 py-2 text-sm font-mono text-white placeholder-gray-600 border border-surface-lighter focus:border-pomored focus:outline-none resize-none"
                rows={2}
                maxLength={500}
                autoFocus
              />
            </div>

            <div>
              <label className="text-gray-400 text-xs font-mono block mb-2">
                Tags
              </label>
              <div className="flex flex-wrap gap-2">
                {QUICK_TAGS.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className={`px-3 py-1 rounded-full text-xs font-mono transition-colors ${
                      completionTags.includes(tag)
                        ? "bg-pomored text-white"
                        : "bg-surface-lighter text-gray-400 hover:text-white"
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={handleCompletionSkip}
                className="flex-1 px-4 py-2 bg-surface-lighter text-gray-400 rounded-lg font-mono text-sm hover:text-white transition-colors"
              >
                Skip <span className="text-gray-600 text-[10px]">Esc</span>
              </button>
              <button
                onClick={handleCompletionSubmit}
                className="flex-1 px-4 py-2 bg-pomored hover:bg-pomored-dark text-white rounded-lg font-mono text-sm font-bold transition-colors"
              >
                Save <span className="text-pomored-light text-[10px]">⌘↵</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
