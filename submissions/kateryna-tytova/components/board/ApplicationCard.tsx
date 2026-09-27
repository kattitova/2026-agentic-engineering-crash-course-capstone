import type { JobApplication } from "@/app/generated/prisma/client";
import { isHttpUrl } from "@/lib/applications/validation";

export function ApplicationCard({ application }: { application: JobApplication }) {
  // Re-checked here, not only on write: seed.ts and direct database edits never
  // pass through validateApplicationInput, and a stored javascript: URL would be
  // one click from executing.
  const postingUrl =
    application.link !== null && isHttpUrl(application.link) ? application.link : null;
  const companyId = `card-${application.id}-company`;

  return (
    // Named, so card-by-card navigation says which application it lands on
    // instead of announcing an unnamed "article".
    <article
      aria-labelledby={companyId}
      className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm"
    >
      {/* break-words so a long unbroken token can't widen the column; the clamp
          keeps one card from towering over the rest. */}
      <h3
        id={companyId}
        className="line-clamp-3 break-words text-sm font-semibold leading-5 text-slate-900"
      >
        {application.company}
      </h3>
      <p className="line-clamp-2 break-words text-sm leading-5 text-slate-600">
        {application.position}
      </p>
      {postingUrl !== null ? (
        <a
          href={postingUrl}
          target="_blank"
          rel="noopener noreferrer"
          // Without this every card's link is named "View posting", so a link
          // list gives no way to tell which application each one belongs to.
          // Names the application (a link list is otherwise "View posting" over
          // and over) and says the tab is new, which target="_blank" does not.
          aria-label={`View posting at ${application.company} (opens in a new tab)`}
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
