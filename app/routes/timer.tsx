import { Timer } from "~/components/Timer";

export default function TimerPage() {
  return (
    <div className="flex flex-col items-center pt-8">
      <Timer
        onSessionStart={(type, duration) => {
          console.log(`[pomodoro] Session started: ${type} ${duration}min`);
        }}
        onSessionComplete={(type) => {
          console.log(`[pomodoro] Session completed: ${type}`);
        }}
        onSessionInterrupt={() => {
          console.log("[pomodoro] Session interrupted");
        }}
      />
    </div>
  );
}
