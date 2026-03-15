export default function SignInPage() {
  return (
    <div className="flex justify-center pt-16">
      <div className="bg-surface-light rounded-xl p-8 text-center">
        <h1 className="text-xl font-mono font-bold text-white mb-4">
          Sign In
        </h1>
        <p className="text-gray-500 font-mono text-sm">
          Clerk sign-in component will mount here after configuration.
        </p>
        <p className="text-gray-600 font-mono text-xs mt-4">
          Set VITE_CLERK_PUBLISHABLE_KEY in .env.local
        </p>
      </div>
    </div>
  );
}
