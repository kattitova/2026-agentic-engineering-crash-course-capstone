import type { JobApplication } from "@/app/generated/prisma/client";

export function ApplicationCard({ application }: { application: JobApplication }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
      <h3 className="text-sm font-semibold leading-5 text-slate-900">{application.company}</h3>
      <p className="text-sm leading-5 text-slate-600">{application.position}</p>
      {application.link ? (
        <a
          href={application.link}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700"
        >
          View posting
          <svg
            viewBox="0 0 24 24"
            width="12"
            height="12"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M7 17 17 7M9 7h8v8" />
          </svg>
        </a>
      ) : null}
    </article>
  );
}
