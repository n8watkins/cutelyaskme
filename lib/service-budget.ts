import type { Client } from "@libsql/client";

export type ServiceBudgetLimit = {
  subjectId: string;
  limit: number;
};

export type ReserveServiceBudgetInput = {
  service: string;
  cost?: number;
  windowStart: number;
  windowEnd: number;
  limits: ServiceBudgetLimit[];
};

export type ServiceBudgetReservation =
  | { allowed: true }
  | { allowed: false };

function assertPositiveInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
}

export function budgetKey(service: string, subjectId: string, windowStart: number): string {
  return JSON.stringify([service, subjectId, windowStart]);
}

/**
 * Atomically reserve cost against every supplied ceiling.
 *
 * A typical request supplies both a per-viewer limit and a global limit. If
 * either ceiling is exhausted, the transaction rolls back every increment.
 */
export async function reserveServiceBudget(
  client: Client,
  input: ReserveServiceBudgetInput,
): Promise<ServiceBudgetReservation> {
  const cost = input.cost ?? 1;
  if (!input.service.trim()) throw new Error("service is required");
  assertPositiveInteger(cost, "cost");
  assertPositiveInteger(input.windowStart, "windowStart");
  assertPositiveInteger(input.windowEnd, "windowEnd");
  if (input.windowEnd <= input.windowStart) {
    throw new Error("windowEnd must be after windowStart");
  }
  if (input.limits.length === 0) throw new Error("at least one limit is required");

  for (const budget of input.limits) {
    if (!budget.subjectId.trim()) throw new Error("subjectId is required");
    assertPositiveInteger(budget.limit, "limit");
    if (cost > budget.limit) {
      return { allowed: false };
    }
  }

  const requestedValues = input.limits.map(() => "(?, ?, ?)").join(", ");
  const requestedArgs = input.limits.flatMap((budget) => [
    budgetKey(input.service, budget.subjectId, input.windowStart),
    budget.subjectId,
    budget.limit,
  ]);
  const result = await client.execute({
    sql: `
      WITH requested(key, subject_id, limit_value) AS (
        VALUES ${requestedValues}
      )
      INSERT INTO service_budgets (
        key,
        service,
        subject_id,
        window_start,
        window_end,
        count,
        limit_value
      )
      SELECT
        requested.key,
        ?,
        requested.subject_id,
        ?,
        ?,
        ?,
        requested.limit_value
      FROM requested
      WHERE NOT EXISTS (
        SELECT 1
        FROM requested AS ceiling
        LEFT JOIN service_budgets AS current ON current.key = ceiling.key
        WHERE COALESCE(current.count, 0) + ? > ceiling.limit_value
      )
      ON CONFLICT(key) DO UPDATE SET
        count = service_budgets.count + excluded.count,
        limit_value = excluded.limit_value
    `,
    args: [
      ...requestedArgs,
      input.service,
      input.windowStart,
      input.windowEnd,
      cost,
      cost,
    ],
  });

  return result.rowsAffected === input.limits.length ? { allowed: true } : { allowed: false };
}
