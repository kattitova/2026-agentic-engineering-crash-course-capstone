import type { JobApplication } from "@/app/generated/prisma/client";
import type { BoardColumn as BoardColumnDefinition } from "@/lib/applications/board";
import { ApplicationCard } from "./ApplicationCard";

interface BoardColumnProps {
  column: BoardColumnDefinition;
  applications: JobApplication[];
}

export function BoardColumn({ column, applications }: BoardColumnProps) {
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-200/55 p-3">
      <div className="flex items-center justify-between px-1">
        <h2 className="flex items-center gap-2 text-sm font-semibold leading-5 text-slate-700">
          <span className={`size-2.5 rounded-full ${column.dotClass}`} aria-hidden="true" />
          {column.label}
        </h2>
        <span className="rounded-full bg-white px-2 py-px text-xs font-medium text-slate-500 shadow-sm">
          {applications.length}
        </span>
      </div>

      {applications.length === 0 ? (
        <p className="px-1 py-6 text-center text-xs text-slate-500">No applications yet</p>
      ) : (
        applications.map((application) => (
          <ApplicationCard key={application.id} application={application} />
        ))
      )}
    </section>
  );
}
