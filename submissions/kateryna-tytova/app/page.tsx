import { AddApplicationButton } from "@/components/application-form/AddApplicationButton";
import { Board } from "@/components/board/Board";
import { listApplications } from "@/lib/applications/queries";

export default async function Home() {
  const applications = await listApplications();
  // Taken once, here, so every badge on the board is counted against the same
  // moment. The board is a client tree, so a card reaching for its own clock
  // would give one number during SSR and another on hydration.
  const now = new Date();

  return (
    <main className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-6 px-6 py-8 sm:px-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Job Tracker</h1>
          <p className="text-sm leading-5 text-slate-500">
            Every application you are tracking, grouped by stage.
          </p>
        </div>
        <AddApplicationButton />
      </header>

      <Board applications={applications} now={now} />
    </main>
  );
}
