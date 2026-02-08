interface ScheduledWorkflow {
  workflowId: string;
  cronExpression: string;
  intervalMs: number;
  timer: ReturnType<typeof setInterval>;
  nextRun: Date;
  lastRun: Date | null;
  callback: () => void | Promise<void>;
}

interface ScheduleInfo {
  workflowId: string;
  cronExpression: string;
  intervalMs: number;
  nextRun: string;
  lastRun: string | null;
}

export class WorkflowScheduler {
  private scheduled = new Map<string, ScheduledWorkflow>();

  scheduleWorkflow(
    workflowId: string,
    cronExpression: string,
    callback: () => void | Promise<void>
  ): ScheduleInfo {
    this.unschedule(workflowId);

    const intervalMs = parseCronExpression(cronExpression);
    const nextRun = new Date(Date.now() + intervalMs);

    const wrappedCallback = async () => {
      const entry = this.scheduled.get(workflowId);
      if (entry) {
        entry.lastRun = new Date();
        entry.nextRun = new Date(Date.now() + intervalMs);
      }
      try {
        await callback();
      } catch (err) {
        console.error(
          `[Scheduler] Error executing workflow ${workflowId}:`,
          err
        );
      }
    };

    const timer = setInterval(wrappedCallback, intervalMs);

    const entry: ScheduledWorkflow = {
      workflowId,
      cronExpression,
      intervalMs,
      timer,
      nextRun,
      lastRun: null,
      callback: wrappedCallback,
    };

    this.scheduled.set(workflowId, entry);

    return {
      workflowId,
      cronExpression,
      intervalMs,
      nextRun: nextRun.toISOString(),
      lastRun: null,
    };
  }

  unschedule(workflowId: string): boolean {
    const entry = this.scheduled.get(workflowId);
    if (!entry) return false;

    clearInterval(entry.timer);
    this.scheduled.delete(workflowId);
    return true;
  }

  listScheduled(): ScheduleInfo[] {
    const result: ScheduleInfo[] = [];
    for (const entry of this.scheduled.values()) {
      result.push({
        workflowId: entry.workflowId,
        cronExpression: entry.cronExpression,
        intervalMs: entry.intervalMs,
        nextRun: entry.nextRun.toISOString(),
        lastRun: entry.lastRun?.toISOString() ?? null,
      });
    }
    return result;
  }

  isScheduled(workflowId: string): boolean {
    return this.scheduled.has(workflowId);
  }

  destroy() {
    for (const entry of this.scheduled.values()) {
      clearInterval(entry.timer);
    }
    this.scheduled.clear();
  }
}

const DAY_NAMES: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
};

function parseCronExpression(expression: string): number {
  const normalized = expression.trim().toLowerCase();

  const everyMinutes = normalized.match(
    /^every\s+(\d+)\s+minutes?$/
  );
  if (everyMinutes) {
    return parseInt(everyMinutes[1], 10) * 60 * 1000;
  }

  const everyHours = normalized.match(/^every\s+(\d+)\s+hours?$/);
  if (everyHours) {
    return parseInt(everyHours[1], 10) * 60 * 60 * 1000;
  }

  const dailyAt = normalized.match(
    /^daily\s+at\s+(\d{1,2}):(\d{2})$/
  );
  if (dailyAt) {
    return 24 * 60 * 60 * 1000;
  }

  const weeklyOn = normalized.match(
    /^weekly\s+on\s+(\w+)$/
  );
  if (weeklyOn) {
    const day = weeklyOn[1];
    if (DAY_NAMES[day] === undefined) {
      throw new Error(`Unknown day: ${day}`);
    }
    return 7 * 24 * 60 * 60 * 1000;
  }

  throw new Error(
    `Unsupported cron expression: "${expression}". ` +
      'Supported formats: "every N minutes", "every N hours", "daily at HH:MM", "weekly on DAY"'
  );
}

export function createScheduler(): WorkflowScheduler {
  return new WorkflowScheduler();
}
