import { ClerkProvider } from "@clerk/clerk-react";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { useMemo } from "react";

const CLERK_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const CONVEX_URL = import.meta.env.VITE_CONVEX_URL;

function ConvexWrapper({ children }: { children: React.ReactNode }) {
  const convex = useMemo(
    () => (CONVEX_URL ? new ConvexReactClient(CONVEX_URL) : null),
    []
  );

  if (!convex) {
    return <>{children}</>;
  }

  return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}

export function Providers({ children }: { children: React.ReactNode }) {
  if (!CLERK_KEY) {
    return <ConvexWrapper>{children}</ConvexWrapper>;
  }

  return (
    <ClerkProvider publishableKey={CLERK_KEY}>
      <ConvexWrapper>{children}</ConvexWrapper>
    </ClerkProvider>
  );
}
