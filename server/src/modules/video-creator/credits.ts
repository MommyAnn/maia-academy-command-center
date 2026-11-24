// Video credit ledger. Rules enforced here (and only here):
//  * Every balance change writes exactly one append-only VideoCreditTransaction
//    in the SAME database transaction.
//  * Decrements use a conditional UPDATE ("balance >= cost"), so concurrent
//    requests can never overdraw; the DB CHECK constraint backs this up.
//  * Every ledger row carries a unique idempotencyKey, so a retried charge,
//    grant or refund is applied at most once.
//  * Credits are charged when a job is created (reservation) and restored
//    exactly once if the job ends in failure.

import { Prisma } from "@prisma/client";
import { db } from "../../db.js";

type Tx = Prisma.TransactionClient;

export type CreditTxType = "GRANT" | "ADJUSTMENT" | "GENERATION_CHARGE" | "GENERATION_REFUND";

export async function getOrCreateAccount(studentId: string, client: Tx | typeof db = db) {
  const existing = await client.videoCreatorAccount.findUnique({ where: { studentId } });
  if (existing) return existing;
  try {
    // New accounts start SUSPENDED: access is only ever turned on by an admin
    // after the purchase has been verified outside this app.
    return await client.videoCreatorAccount.create({ data: { studentId, accessStatus: "SUSPENDED", creditBalance: 0 } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return client.videoCreatorAccount.findUniqueOrThrow({ where: { studentId } });
    }
    throw err;
  }
}

export class InsufficientCreditsError extends Error {
  constructor(
    public balance: number,
    public required: number,
  ) {
    super(`Not enough video credits: this video needs ${required}, you have ${balance}.`);
  }
}

/**
 * Applies a signed credit change inside an existing transaction. Returns the
 * ledger row, or the pre-existing row if this idempotencyKey was already used
 * (no second change is applied).
 */
export async function applyCreditChange(
  tx: Tx,
  input: { accountId: string; amount: number; type: CreditTxType; idempotencyKey: string; reason?: string; actorUserId?: string; jobId?: string },
) {
  const prior = await tx.videoCreditTransaction.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
  if (prior) return { transaction: prior, applied: false };

  if (input.amount < 0) {
    const result = await tx.videoCreatorAccount.updateMany({
      where: { id: input.accountId, creditBalance: { gte: -input.amount } },
      data: { creditBalance: { increment: input.amount } },
    });
    if (result.count === 0) {
      const account = await tx.videoCreatorAccount.findUniqueOrThrow({ where: { id: input.accountId } });
      throw new InsufficientCreditsError(account.creditBalance, -input.amount);
    }
  } else if (input.amount > 0) {
    await tx.videoCreatorAccount.update({ where: { id: input.accountId }, data: { creditBalance: { increment: input.amount } } });
  }
  const account = await tx.videoCreatorAccount.findUniqueOrThrow({ where: { id: input.accountId } });
  const transaction = await tx.videoCreditTransaction.create({
    data: {
      accountId: input.accountId,
      type: input.type,
      amount: input.amount,
      balanceAfter: account.creditBalance,
      idempotencyKey: input.idempotencyKey,
      reason: input.reason ?? null,
      actorUserId: input.actorUserId ?? null,
      jobId: input.jobId ?? null,
    },
  });
  return { transaction, applied: true };
}

/** Admin grant / correction. Negative amounts can only remove credits the customer actually has. */
export async function adminAdjustCredits(input: { studentId: string; amount: number; reason: string; actorUserId: string; idempotencyKey: string }) {
  return db.$transaction(async (tx) => {
    const account = await getOrCreateAccount(input.studentId, tx);
    return applyCreditChange(tx, {
      accountId: account.id,
      amount: input.amount,
      type: input.amount > 0 ? "GRANT" : "ADJUSTMENT",
      idempotencyKey: input.idempotencyKey,
      reason: input.reason,
      actorUserId: input.actorUserId,
    });
  });
}

/**
 * Restores a failed job's credits — exactly once. The job's creditStatus is
 * flipped CHARGED -> REFUNDED with a conditional update first, so two workers
 * (or a worker and an admin) racing to refund the same job can't both win.
 */
export async function refundJobCredits(jobId: string, reason: string, actorUserId?: string): Promise<boolean> {
  return db.$transaction(async (tx) => {
    const job = await tx.videoGenerationJob.findUnique({ where: { id: jobId } });
    if (!job || job.creditStatus !== "CHARGED" || job.creditsCharged <= 0) return false;
    const flipped = await tx.videoGenerationJob.updateMany({ where: { id: jobId, creditStatus: "CHARGED" }, data: { creditStatus: "REFUNDED" } });
    if (flipped.count === 0) return false;
    const account = await getOrCreateAccount(job.studentId, tx);
    const { applied } = await applyCreditChange(tx, {
      accountId: account.id,
      amount: job.creditsCharged,
      type: "GENERATION_REFUND",
      idempotencyKey: `refund:${jobId}`,
      reason,
      actorUserId,
      jobId,
    });
    return applied;
  });
}
