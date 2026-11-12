export type FollowUpTask = {
  id: string;
  type: "reminder" | "call";
  dueOn: string;
  doneOn: string | null;
  cancelledOn: string | null;
};

export type FollowUpPlan = {
  daysSinceApproval: number | null;
  tasksToCreate: Array<Pick<FollowUpTask, "type" | "dueOn">>;
  taskIdsToCancel: string[];
  parkCase: boolean;
};

function dateOrdinal(date: string): number {
  const time = Date.parse(`${date}T00:00:00.000Z`);
  if (!Number.isFinite(time)) throw new Error("Dates must use the YYYY-MM-DD format");
  return Math.floor(time / 86_400_000);
}

function plusDays(date: string, days: number): string {
  return new Date((dateOrdinal(date) + days) * 86_400_000).toISOString().slice(0, 10);
}

export function planFollowUps(input: {
  approvedOn: string | null;
  asOfDate: string;
  clientReplyDates: string[];
  existingTasks: FollowUpTask[];
}): FollowUpPlan {
  if (!input.approvedOn) {
    return { daysSinceApproval: null, tasksToCreate: [], taskIdsToCancel: [], parkCase: false };
  }

  const elapsedDays = dateOrdinal(input.asOfDate) - dateOrdinal(input.approvedOn);
  if (elapsedDays < 0) {
    return { daysSinceApproval: elapsedDays, tasksToCreate: [], taskIdsToCancel: [], parkCase: false };
  }

  const hasReply = input.clientReplyDates.some(
    (replyDate) =>
      dateOrdinal(replyDate) >= dateOrdinal(input.approvedOn!) &&
      dateOrdinal(replyDate) <= dateOrdinal(input.asOfDate),
  );
  if (hasReply) {
    return {
      daysSinceApproval: elapsedDays,
      tasksToCreate: [],
      taskIdsToCancel: input.existingTasks
        .filter((task) => task.doneOn === null && task.cancelledOn === null)
        .map((task) => task.id),
      parkCase: false,
    };
  }

  const dueTasks: FollowUpPlan["tasksToCreate"] = [];
  if (elapsedDays >= 3) dueTasks.push({ type: "reminder", dueOn: plusDays(input.approvedOn, 3) });
  if (elapsedDays >= 5) dueTasks.push({ type: "call", dueOn: plusDays(input.approvedOn, 5) });

  const tasksToCreate = dueTasks.filter(
    (due) => !input.existingTasks.some((task) => task.type === due.type && task.dueOn === due.dueOn),
  );

  return {
    daysSinceApproval: elapsedDays,
    tasksToCreate,
    taskIdsToCancel: [],
    parkCase: elapsedDays >= 7,
  };
}
