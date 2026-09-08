export type TimeRange = { start: string; end: string };
export type InterviewDay = {
  date: string;
  start: string;
  end: string;
  breaks?: TimeRange[];
};

export type ScheduleInput = {
  candidateNames: string[];
  units: string[];
  days: InterviewDay[];
  durationMinutes: number;
};

export type ScheduledInterview = {
  date: string;
  start: string;
  end: string;
  unit: string;
  candidate: string;
  round: number;
};

export type CapacityReport = {
  candidateCount: number;
  unitCount: number;
  totalInterviews: number;
  requiredRounds: number;
  availableRounds: number;
  missingRounds: number;
  canGenerate: boolean;
  minutesNeededPerUnit: number;
  minutesAvailablePerUnit: number;
};

function toMinutes(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function fromMinutes(m: number) {
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  return aStart < bEnd && bStart < aEnd;
}

export function slotsForDay(day: InterviewDay, durationMinutes: number) {
  const slots: { date: string; start: string; end: string }[] = [];
  const dayStart = toMinutes(day.start);
  const dayEnd = toMinutes(day.end);
  const breaks = (day.breaks ?? []).map((b) => ({ start: toMinutes(b.start), end: toMinutes(b.end) }));

  for (let m = dayStart; m + durationMinutes <= dayEnd; m += durationMinutes) {
    const end = m + durationMinutes;
    if (breaks.some((b) => overlaps(m, end, b.start, b.end))) continue;
    slots.push({ date: day.date, start: fromMinutes(m), end: fromMinutes(end) });
  }
  return slots;
}

export function allSlots(days: InterviewDay[], durationMinutes: number) {
  return days.flatMap((d) => slotsForDay(d, durationMinutes));
}

export function capacityReport(input: ScheduleInput): CapacityReport {
  const candidateCount = input.candidateNames.length;
  const unitCount = input.units.length;
  const availableRounds = allSlots(input.days, input.durationMinutes).length;
  const requiredRounds = Math.max(candidateCount, unitCount);

  return {
    candidateCount,
    unitCount,
    totalInterviews: candidateCount * unitCount,
    requiredRounds,
    availableRounds,
    missingRounds: Math.max(0, requiredRounds - availableRounds),
    canGenerate: candidateCount > 0 && unitCount > 0 && availableRounds >= requiredRounds,
    minutesNeededPerUnit: candidateCount * input.durationMinutes,
    minutesAvailablePerUnit: availableRounds * input.durationMinutes,
  };
}

export function generateSchedule(input: ScheduleInput): ScheduledInterview[] {
  const report = capacityReport(input);
  if (!report.canGenerate) {
    throw new Error(`אין מספיק זמני ראיון. חסרים ${report.missingRounds} זמני ראיון.`);
  }

  const slots = allSlots(input.days, input.durationMinutes);
  const m = Math.max(input.candidateNames.length, input.units.length);
  const candidates = [...input.candidateNames, ...Array(Math.max(0, m - input.candidateNames.length)).fill(null)] as (string | null)[];
  const units = [...input.units, ...Array(Math.max(0, m - input.units.length)).fill(null)] as (string | null)[];
  const result: ScheduledInterview[] = [];

  for (let round = 0; round < m; round++) {
    const slot = slots[round];
    for (let i = 0; i < m; i++) {
      const candidate = candidates[i];
      const unit = units[(i + round) % m];
      if (!candidate || !unit) continue;
      result.push({ ...slot, candidate, unit, round: round + 1 });
    }
  }

  return result;
}

export function validateSchedule(input: ScheduleInput, schedule: ScheduledInterview[]) {
  const issues: string[] = [];
  const pairKeys = new Set<string>();
  const slotCandidate = new Set<string>();
  const slotUnit = new Set<string>();

  for (const interview of schedule) {
    const pair = `${interview.candidate}|||${interview.unit}`;
    if (pairKeys.has(pair)) issues.push(`כפילות: ${interview.candidate} מול ${interview.unit}`);
    pairKeys.add(pair);

    const candidateSlot = `${interview.date}|${interview.start}|${interview.candidate}`;
    if (slotCandidate.has(candidateSlot)) issues.push(`התנגשות מועמד/ת: ${interview.candidate} ב-${interview.start}`);
    slotCandidate.add(candidateSlot);

    const unitSlot = `${interview.date}|${interview.start}|${interview.unit}`;
    if (slotUnit.has(unitSlot)) issues.push(`התנגשות יחידה: ${interview.unit} ב-${interview.start}`);
    slotUnit.add(unitSlot);
  }

  const expected = input.candidateNames.length * input.units.length;
  if (schedule.length !== expected) issues.push(`חסרים ראיונות: צפויים ${expected}, קיימים ${schedule.length}`);

  return { valid: issues.length === 0, issues };
}
