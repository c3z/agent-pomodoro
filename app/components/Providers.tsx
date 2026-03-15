import { useAuth } from "@clerk/react-router";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ConvexReactClient } from "convex/react";
import { useMemo } from "react";

const CONVEX_URL = import.meta.env.VITE_CONVEX_URL;

export function Providers({ children }: { children: React.ReactNode }) {
  const convex = useMemo(
    () => (CONVEX_URL ? new ConvexReactClient(CONVEX_URL) : null),
    []
  );

  if (!convex) {
    return <>{children}</>;
  }

  return (
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      {children}
    </ConvexProviderWithClerk>
  );
}
