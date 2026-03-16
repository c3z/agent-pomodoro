import { useState, useEffect, useRef } from "react";
import { playCompletionSound, playStartSound, playResetSound } from "~/lib/sounds";
import { AccountabilityBadge } from "~/components/AccountabilityBadge";
import { loadTimerSettings, type TimerConfig } from "~/lib/timerSettings";

type TimerMode = "work" | "break" | "longBreak";

const TIMER_STATE_KEY = "apom_timer_state";

interface PersistedTimerState {
  mode: TimerMode;
  endTime: number; // 0 if not running
  isRunning: boolean;
  isPaused: boolean;
  completedPomodoros: number;
  startedRef: boolean;
  completedRef: boolean;
  secondsLeft: number;
}

function persistTimerState(state: PersistedTimerState) {
  try {
    localStorage.setItem(TIMER_STATE_KEY, JSON.stringify(state));
  } catch {}
}

function loadTimerState(): PersistedTimerState | null {
  try {
    const raw = localStorage.getItem(TIMER_STATE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PersistedTimerState;
  } catch {
    return null;
  }
}

function clearTimerState() {
  try {
    localStorage.removeItem(TIMER_STATE_KEY);
  } catch {}
}

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
  currentTask?: string;
}

interface TimerProps {
  onSessionStart?: (type: TimerMode, durationMinutes: number) => void;
  onSessionComplete?: (type: TimerMode, notes?: string, tags?: string[]) => void;
  onSessionInterrupt?: (reason?: string) => void;
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
  // Load user-configured timer durations (localStorage with defaults)
  const configRef = useRef<TimerConfig>(loadTimerSettings());
  const config = configRef.current;

  // Hydrate from localStorage if available
  const savedState = useRef(loadTimerState());

  const [mode, setMode] = useState<TimerMode>(
    savedState.current?.mode ?? "work"
  );
  const [secondsLeft, setSecondsLeft] = useState(() => {
    const s = savedState.current;
    if (!s) return config.work * 60;
    if (s.isRunning && s.endTime > 0) {
      // Timer was running — calculate remaining from wall clock
      const remaining = Math.max(0, Math.ceil((s.endTime - Date.now()) / 1000));
      return remaining;
    }
    return s.secondsLeft;
  });
  const [isRunning, setIsRunning] = useState(() => {
    const s = savedState.current;
    if (!s) return false;
    if (s.isRunning && s.endTime > 0) {
      // Only restore running if time hasn't expired
      return s.endTime > Date.now();
    }
    return false;
  });
  const [isPaused, setIsPaused] = useState(
    savedState.current?.isPaused ?? false
  );
  const [completedPomodoros, setCompletedPomodoros] = useState(
    savedState.current?.completedPomodoros ?? 0
  );
  const [showCompletion, setShowCompletion] = useState(false);
  const [completionNotes, setCompletionNotes] = useState("");
  const [completionTags, setCompletionTags] = useState<string[]>([]);

  // Interruption reason modal
  const [showInterruptModal, setShowInterruptModal] = useState(false);

  // Break enforcement: track if last completed session was work
  const [lastCompletedWasWork, setLastCompletedWasWork] = useState(false);

  // Wall-clock anchor: when the timer should end
  const endTimeRef = useRef<number>(savedState.current?.endTime ?? 0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedRef = useRef(savedState.current?.startedRef ?? false);

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

  // On mount: handle restored state
  useEffect(() => {
    const s = savedState.current;
    if (!s) return;
    // Timer was running but expired while we were away
    if (s.isRunning && s.endTime > 0 && s.endTime <= Date.now()) {
      // secondsLeft = 0, isRunning = false, completedRef = true
      // The completion detection effect will handle the rest
      playCompletionSound(s.mode);
      clearTimerState();
      startedRef.current = false;
    }
    // Timer is still actively running — re-acquire wake lock
    if (s.isRunning && s.endTime > Date.now()) {
      requestWakeLock();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    const newEndTime = Date.now() + remaining * 1000;
    endTimeRef.current = newEndTime;
    startedRef.current = true;
    completedRef.current = true;
    setIsRunning(true);
    setIsPaused(false);
    requestWakeLock();
    onRemoteSessionSync?.(remoteSession._id);
    persistTimerState({
      mode: remoteSession.type,
      endTime: newEndTime,
      isRunning: true,
      isPaused: false,
      completedPomodoros,
      startedRef: true,
      completedRef: true,
      secondsLeft: remaining,
    });
  }, [remoteSession]);

  // Detect remote session completion/interruption/expiry
  const prevRemoteRef = useRef<typeof remoteSession>(undefined);
  const localCompletionRef = useRef(false);

  useEffect(() => {
    if (remoteSession === undefined) return;
    const prev = prevRemoteRef.current;
    prevRemoteRef.current = remoteSession;
    if (prev === undefined) return;

    // Session vanished from backend (completed/interrupted elsewhere, or expired)
    if (prev && !remoteSession) {
      if (localCompletionRef.current) {
        localCompletionRef.current = false;
        return;
      }
      // Remote action — reset local timer silently
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setIsRunning(false);
      setIsPaused(false);
      setShowCompletion(false);
      setShowInterruptModal(false);
      releaseWakeLock();
      endTimeRef.current = 0;
      startedRef.current = false;
      completedRef.current = false;
      syncedSessionRef.current = null;
      setMode("work");
      setSecondsLeft(config.work * 60);
      clearTimerState();
    }
  }, [remoteSession]);

  // Stable refs for callbacks to avoid useEffect dependency issues
  const onCompleteRef = useRef(onSessionComplete);
  onCompleteRef.current = onSessionComplete;
  const onInterruptRef = useRef(onSessionInterrupt);
  onInterruptRef.current = onSessionInterrupt;
  const onStartRef = useRef(onSessionStart);
  onStartRef.current = onSessionStart;

  const totalSeconds = config[mode] * 60;
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
        clearTimerState();
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
  const completedRef = useRef(savedState.current?.completedRef ?? false);
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
      localCompletionRef.current = true;
      onCompleteRef.current?.(currentMode);
      setLastCompletedWasWork(false); // Break completed, allow work again
      setMode("work");
      setSecondsLeft(config.work * 60);
      persistTimerState({
        mode: "work",
        endTime: 0,
        isRunning: false,
        isPaused: false,
        completedPomodoros,
        startedRef: false,
        completedRef: false,
        secondsLeft: config.work * 60,
      });
    }
  }, [secondsLeft, isRunning]);

  const advanceAfterCompletion = (notes?: string, tags?: string[]) => {
    localCompletionRef.current = true;
    onCompleteRef.current?.("work", notes, tags);
    setShowCompletion(false);
    setCompletionNotes("");
    setCompletionTags([]);
    setLastCompletedWasWork(true);

    const newCount = completedPomodoros + 1;
    setCompletedPomodoros(newCount);
    const nextMode =
      newCount % config.longBreakInterval === 0
        ? "longBreak"
        : "break";
    setMode(nextMode);
    const nextSeconds = config[nextMode] * 60;
    setSecondsLeft(nextSeconds);
    persistTimerState({
      mode: nextMode,
      endTime: 0,
      isRunning: false,
      isPaused: false,
      completedPomodoros: newCount,
      startedRef: false,
      completedRef: false,
      secondsLeft: nextSeconds,
    });
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
      onStartRef.current?.(mode, config[mode]);
    }
    const newEndTime = Date.now() + secondsLeft * 1000;
    endTimeRef.current = newEndTime;
    setIsRunning(true);
    setIsPaused(false);
    playStartSound();
    requestWakeLock();
    persistTimerState({
      mode,
      endTime: newEndTime,
      isRunning: true,
      isPaused: false,
      completedPomodoros,
      startedRef: startedRef.current,
      completedRef: completedRef.current,
      secondsLeft,
    });
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
    persistTimerState({
      mode,
      endTime: 0,
      isRunning: false,
      isPaused: true,
      completedPomodoros,
      startedRef: startedRef.current,
      completedRef: completedRef.current,
      secondsLeft: remaining,
    });
  };

  const stop = () => {
    // If interrupt modal is already showing, dismiss it (Escape key path)
    if (showInterruptModal) {
      confirmInterrupt();
      return;
    }
    if (startedRef.current) {
      // Show interrupt reason modal instead of immediately stopping
      setShowInterruptModal(true);
      return;
    }
    setIsRunning(false);
    setIsPaused(false);
    releaseWakeLock();
    endTimeRef.current = 0;
    setSecondsLeft(config[mode] * 60);
    clearTimerState();
  };

  const confirmInterrupt = (reason?: string) => {
    localCompletionRef.current = true;
    setShowInterruptModal(false);
    setIsRunning(false);
    setIsPaused(false);
    releaseWakeLock();
    endTimeRef.current = 0;
    playResetSound();
    onInterruptRef.current?.(reason);
    startedRef.current = false;
    completedRef.current = false;
    setSecondsLeft(config[mode] * 60);
    clearTimerState();
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
    setSecondsLeft(config[newMode] * 60);
    // Clear break enforcement when switching to break mode
    if (newMode === "break" || newMode === "longBreak") {
      setLastCompletedWasWork(false);
    }
    clearTimerState();
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
          {remoteSession?.currentTask && (
            <span className="text-gray-600 text-xs font-mono mt-1 max-w-[180px] sm:max-w-[220px] truncate text-center">
              {remoteSession.currentTask}
            </span>
          )}
        </div>
      </div>

      {/* Break Enforcement Banner */}
      {config.enforceBreaks && lastCompletedWasWork && mode === "work" && !isRunning && !isPaused && (
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl px-4 py-3 text-center max-w-sm">
          <p className="text-blue-400 font-mono text-sm font-bold">Take your break first</p>
          <p className="text-blue-400/70 font-mono text-xs mt-1">
            Switch to Break mode or complete a break timer
          </p>
        </div>
      )}

      {/* Controls */}
      <div className="flex gap-4">
        {!isRunning ? (
          <button
            onClick={start}
            disabled={config.enforceBreaks && lastCompletedWasWork && mode === "work"}
            className="px-8 py-3 bg-pomored hover:bg-pomored-dark disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl font-bold text-lg transition-colors"
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

      {/* Accountability Badge */}
      <AccountabilityBadge />

      {/* Pomodoro Counter */}
      <div className="flex gap-2 items-center">
        {Array.from({ length: config.longBreakInterval }).map(
          (_, i) => (
            <div
              key={i}
              className={`w-3 h-3 rounded-full ${
                i < completedPomodoros % config.longBreakInterval
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

      {/* Interruption Reason Modal */}
      {showInterruptModal && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
          onKeyDown={(e) => {
            if (e.key === "Escape") confirmInterrupt();
          }}
        >
          <div className="bg-surface rounded-2xl p-6 w-full max-w-sm space-y-4">
            <h3 className="text-lg font-mono font-bold text-red-400 text-center">
              Why are you stopping?
            </h3>
            <div className="flex flex-wrap gap-2 justify-center">
              {["distraction", "emergency", "meeting", "wrong task", "other"].map((reason) => (
                <button
                  key={reason}
                  onClick={() => confirmInterrupt(reason)}
                  className="px-4 py-2 bg-surface-lighter hover:bg-surface-light text-gray-300 hover:text-white rounded-full text-sm font-mono transition-colors"
                >
                  {reason}
                </button>
              ))}
            </div>
            <button
              onClick={() => confirmInterrupt()}
              className="w-full px-4 py-2 text-gray-600 hover:text-gray-400 font-mono text-xs transition-colors"
            >
              Skip <span className="text-gray-700 text-[10px]">Esc</span>
            </button>
          </div>
        </div>
      )}

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
