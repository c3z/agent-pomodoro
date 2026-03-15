import {
  SignedIn,
  SignedOut,
  SignInButton,
  UserButton,
} from "@clerk/clerk-react";

const HAS_CLERK = !!import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

export function AuthGate({ children }: { children: React.ReactNode }) {
  if (!HAS_CLERK) {
    return <>{children}</>;
  }

  return (
    <>
      <SignedIn>{children}</SignedIn>
      <SignedOut>
        <div className="flex flex-col items-center justify-center pt-24 gap-6">
          <h1 className="text-3xl font-bold font-mono text-white">
            🍅 Agent Pomodoro
          </h1>
          <p className="text-gray-500 font-mono text-sm text-center max-w-md">
            Focus tracking for humans supervised by AI agents.
            <br />
            Sign in to start.
          </p>
          <SignInButton mode="modal">
            <button className="px-8 py-3 bg-pomored hover:bg-pomored-dark text-white rounded-xl font-bold text-lg transition-colors font-mono">
              Sign In
            </button>
          </SignInButton>
        </div>
      </SignedOut>
    </>
  );
}

export function AuthNav() {
  if (!HAS_CLERK) {
    return null;
  }

  return (
    <div className="flex items-center">
      <SignedIn>
        <UserButton />
      </SignedIn>
      <SignedOut>
        <SignInButton mode="modal">
          <button className="font-mono text-sm px-3 py-1.5 rounded-lg bg-pomored text-white hover:bg-pomored-dark transition-colors">
            Sign In
          </button>
        </SignInButton>
      </SignedOut>
    </div>
  );
}
