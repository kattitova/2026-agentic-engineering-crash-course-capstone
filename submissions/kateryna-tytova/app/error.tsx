"use client"; // Error boundaries must be Client Components.

import { useEffect } from "react";

/**
 * Catches a failed read from the board's data loader. Loaders throw by design —
 * only the mutating server actions return ActionResult — so without this the
 * whole page would fall through to Next's default handling.
 */
export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col items-center justify-center gap-4 px-6 py-8">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
        The board could not be loaded
      </h1>
      <p className="max-w-prose text-center text-sm leading-5 text-slate-500">
        Your applications are still stored; only this page failed to read them.
      </p>
      {/* retry() re-runs the loader. reset() would only re-render the boundary's
          children, which cannot help when the read itself is what failed. */}
      <button
        type="button"
        onClick={() => retry()}
        className="inline-flex h-11 items-center rounded-xl bg-indigo-600 px-5 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
      >
        Try again
      </button>
    </main>
  );
}
