import type { BoardSummary } from "@/lib/applications/stats";

/**
 * The summary above the board: how many applications are tracked, and what share
 * of them reached the interview stage.
 *
 * Every figure is written out in words, and there is no `aria-hidden` /
 * `.sr-only` pair anywhere here. That pair exists on the cards and the column
 * badges because those show an abbreviation - "12d", a bare "3" - that a screen
 * reader must not read as it stands. A region spanning the page has room for the
 * words, and one text node that is both shown and announced cannot drift out of
 * step with a twin it does not have. Every figure in this region is a number
 * whose label is the only thing that makes it mean anything, so that drift is
 * the failure most worth designing out.
 *
 * No `now` prop, deliberately: neither figure is a function of elapsed time.
 * Every other derived number on this board takes the served instant as a
 * required argument, so the omission is worth stating - it is not a forgotten
 * call site.
 */
export function BoardStats({ summary }: { summary: BoardSummary }) {
  const { total, percentReachedInterview } = summary;

  return (
    // A named landmark, like the five columns, so it is reachable by the same
    // navigation and comes before the cards.
    //
    // Contrast, computed against the background the text actually sits on, as
    // spec.md's 2026-10-02 entry requires: slate-900 on white is 16.9:1 and
    // slate-600 on white is 7.58:1, both far above the 4.5:1 minimum that the
    // 12px note needs. Left on white rather than given a tint precisely so the
    // margin is this wide - the board's own surfaces are tinted, and a colour
    // that clears AA on white can fail on a tint.
    <section
      aria-label="Application summary"
      className="flex flex-wrap items-baseline gap-x-6 gap-y-1 rounded-2xl border border-slate-200 bg-white px-4 py-3"
    >
      {/* One template literal per figure, not `{total} {word}`: JSX would emit
          three text nodes, and a figure has to be one phrase to be read as one. */}
      <p className="text-sm font-semibold leading-5 text-slate-900">
        {total === 0
          ? "No applications yet"
          : `${total} ${total === 1 ? "application" : "applications"}`}
      </p>

      {/* No percentage at all on an empty board. The type is what makes this a
          branch the compiler insisted on rather than one to remember: a share of
          an empty set is not zero, and "0% reached interview" would describe a
          job search that has not started. */}
      {percentReachedInterview !== null && (
        <p className="text-sm font-semibold leading-5 text-slate-900">
          {`${percentReachedInterview}% reached interview`}
        </p>
      )}

      {/* What the percentage counts, always visible beside it.
          The figure is narrower than the words "reached interview" suggest: a
          rejection is not counted, because the stored row carries no history of
          the statuses an application passed through, so an application rejected
          after two interviews cannot be told from one rejected in silence. A
          person with rejections on the board needs that said somewhere they can
          see it, and this line is the only place it is said. */}
      {percentReachedInterview !== null && (
        <p className="basis-full text-xs leading-4 text-slate-600">
          Counts applications now in Interview or Offer. A rejected application is not counted, because
          the board does not record whether it was interviewed first.
        </p>
      )}
    </section>
  );
}
