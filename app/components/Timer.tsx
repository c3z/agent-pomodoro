import { useState, useEffect, useCallback, useRef } from "react";

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

interface TimerProps {
  onSessionStart?: (type: TimerMode, durationMinutes: number) => void;
  onSessionComplete?: (type: TimerMode) => void;
  onSessionInterrupt?: () => void;
}

export function Timer({
  onSessionStart,
  onSessionComplete,
  onSessionInterrupt,
}: TimerProps) {
  const [mode, setMode] = useState<TimerMode>("work");
  const [secondsLeft, setSecondsLeft] = useState(DEFAULT_CONFIG.work * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [completedPomodoros, setCompletedPomodoros] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedRef = useRef(false);

  const totalSeconds = DEFAULT_CONFIG[mode] * 60;
  const progress = ((totalSeconds - secondsLeft) / totalSeconds) * 100;

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const handleComplete = useCallback(() => {
    setIsRunning(false);
    if (intervalRef.current) clearInterval(intervalRef.current);

    if (mode === "work") {
      const newCount = completedPomodoros + 1;
      setCompletedPomodoros(newCount);
      onSessionComplete?.(mode);

      // Auto-switch to break
      const nextMode =
        newCount % DEFAULT_CONFIG.longBreakInterval === 0
          ? "longBreak"
          : "break";
      setMode(nextMode);
      setSecondsLeft(DEFAULT_CONFIG[nextMode] * 60);
    } else {
      onSessionComplete?.(mode);
      setMode("work");
      setSecondsLeft(DEFAULT_CONFIG.work * 60);
    }
    startedRef.current = false;

    // Audio notification
    try {
      const audio = new Audio(
        "data:audio/wav;base64,UklGRl9vT19teleWQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQ=="
      );
      audio.play().catch(() => {});
    } catch {}
  }, [mode, completedPomodoros, onSessionComplete]);

  useEffect(() => {
    if (isRunning && secondsLeft > 0) {
      intervalRef.current = setInterval(() => {
        setSecondsLeft((prev) => {
          if (prev <= 1) {
            handleComplete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning, handleComplete]);

  const start = () => {
    if (!startedRef.current) {
      startedRef.current = true;
      onSessionStart?.(mode, DEFAULT_CONFIG[mode]);
    }
    setIsRunning(true);
  };

  const pause = () => {
    setIsRunning(false);
  };

  const stop = () => {
    setIsRunning(false);
    if (startedRef.current) {
      onSessionInterrupt?.();
      startedRef.current = false;
    }
    setSecondsLeft(DEFAULT_CONFIG[mode] * 60);
  };

  const switchMode = (newMode: TimerMode) => {
    if (isRunning) return;
    if (startedRef.current) {
      onSessionInterrupt?.();
      startedRef.current = false;
    }
    setMode(newMode);
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
        <svg className="w-64 h-64 -rotate-90" viewBox="0 0 120 120">
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
            className={`${MODE_COLORS[mode]} transition-all duration-1000`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-5xl font-mono font-bold ${MODE_COLORS[mode]}`}>
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
            {startedRef.current ? "Resume" : "Start"}
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
    </div>
  );
}
