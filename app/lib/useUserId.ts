import { useUser } from "@clerk/react-router";

const HAS_CLERK = !!(
  typeof window !== "undefined" &&
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY
);

function useClerkUserId(): string | null {
  const { user, isLoaded } = useUser();
  if (!isLoaded) return null;
  return user?.id ?? null;
}

function useDevUserId(): string | null {
  return "dev-user";
}

export const useUserId = HAS_CLERK ? useClerkUserId : useDevUserId;
