import { listApplications } from "@/app/actions/applications";
import { Board } from "@/components/board/Board";

export default async function Home() {
  const applications = await listApplications();

  return (
    <main className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-6 px-6 py-8 sm:px-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Job Tracker</h1>
          <p className="text-sm leading-5 text-slate-500">
            Every application you are tracking, grouped by stage.
          </p>
        </div>
        {/* The form arrives with the add-application change; a disabled control keeps the
            header faithful to the design without a control that does nothing. */}
        <button
          type="button"
          disabled
          className="inline-flex h-11 items-center gap-2 rounded-xl bg-indigo-600 px-5 text-sm font-medium text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
        >
          <svg
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
          Add application
        </button>
      </header>

      <Board applications={applications} />
    </main>
  );
}
