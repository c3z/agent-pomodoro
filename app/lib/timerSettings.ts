export interface TimerConfig {
  work: number;
  break: number;
  longBreak: number;
  longBreakInterval: number;
}

export const DEFAULT_CONFIG: TimerConfig = {
  work: 25,
  break: 5,
  longBreak: 15,
  longBreakInterval: 4,
};

const SETTINGS_KEY = "apom_timer_settings";

export function loadTimerSettings(): TimerConfig {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_CONFIG;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_CONFIG, ...parsed };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function saveTimerSettings(config: TimerConfig) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(config));
}
