import { AddApplicationDialog } from "@/components/application-form/AddApplicationDialog";
import { Board } from "@/components/board/Board";
import { listApplications } from "@/lib/applications/queries";

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
        <AddApplicationDialog />
      </header>

      <Board applications={applications} />
    </main>
  );
}
