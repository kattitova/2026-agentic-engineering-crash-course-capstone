import type { JobApplication } from "@/app/generated/prisma/client";
import { BOARD_COLUMNS, groupApplicationsByStatus } from "@/lib/applications/board";
import { BoardColumn } from "./BoardColumn";

export function Board({ applications }: { applications: JobApplication[] }) {
  const grouped = groupApplicationsByStatus(applications);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {BOARD_COLUMNS.map((column) => (
        <BoardColumn
          key={column.status}
          column={column}
          applications={grouped[column.status]}
        />
      ))}
    </div>
  );
}
