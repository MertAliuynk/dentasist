// Pure functions for generating/recomputing payment-plan installments.
// Money is always an integer in kuruş. No Prisma types here — these are
// unit-testable without a DB.

export type InstallmentDraft = {
  sequence: number;
  amount: number;
  dueDate: Date;
  isLocked: boolean;
};

export class InstallmentEngineError extends Error {}

function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

/**
 * Applies a flat interest rate (percent) on top of a principal amount,
 * rounding to the nearest kuruş. A plan's `totalAmount` always represents
 * the amount actually owed (principal + interest) — the interest rate is
 * only ever applied once, at plan-creation time.
 */
export function applyInterest(principal: number, interestRatePercent: number): number {
  if (interestRatePercent < 0) throw new InstallmentEngineError("Faiz oranı negatif olamaz.");
  return Math.round(principal * (1 + interestRatePercent / 100));
}

/** Splits totalAmount across `count` monthly installments starting at startDate. */
export function generateEvenSplit(totalAmount: number, count: number, startDate: Date): InstallmentDraft[] {
  if (count <= 0) throw new InstallmentEngineError("Taksit sayısı en az 1 olmalıdır.");
  const base = Math.floor(totalAmount / count);
  const remainder = totalAmount - base * count;

  return Array.from({ length: count }, (_, i) => ({
    sequence: i + 1,
    amount: base + (i < remainder ? 1 : 0),
    dueDate: addMonths(startDate, i),
    isLocked: false,
  }));
}

/** Recomputes installments when the installment count changes, honoring locked installments. */
export function recomputeOnCountChange(
  existing: InstallmentDraft[],
  newCount: number,
  totalAmount: number,
  startDate: Date,
): InstallmentDraft[] {
  const locked = existing.filter((i) => i.isLocked).sort((a, b) => a.sequence - b.sequence);
  const lockedSum = locked.reduce((sum, i) => sum + i.amount, 0);
  const unlockedCount = newCount - locked.length;

  if (unlockedCount < 0) {
    throw new InstallmentEngineError(
      "Taksit sayısı, daha önce manuel olarak düzenlenmiş taksit sayısından az olamaz.",
    );
  }
  const remaining = totalAmount - lockedSum;
  if (remaining < 0) {
    throw new InstallmentEngineError("Kilitli taksitlerin toplamı plan tutarını aşıyor.");
  }

  const lockedSequences = new Set(locked.map((i) => i.sequence));
  const freeSequences = Array.from({ length: newCount }, (_, i) => i + 1).filter(
    (seq) => !lockedSequences.has(seq),
  );

  const base = unlockedCount > 0 ? Math.floor(remaining / unlockedCount) : 0;
  const rem = unlockedCount > 0 ? remaining - base * unlockedCount : 0;

  const unlockedDrafts: InstallmentDraft[] = freeSequences.map((sequence, i) => ({
    sequence,
    amount: base + (i < rem ? 1 : 0),
    dueDate: addMonths(startDate, sequence - 1),
    isLocked: false,
  }));

  return [...locked, ...unlockedDrafts].sort((a, b) => a.sequence - b.sequence);
}

/** Applies a manual amount edit to one installment, redistributing the remainder across still-unlocked installments. */
export function applyManualAmountEdit(
  existing: InstallmentDraft[],
  editedSequence: number,
  newAmount: number,
  totalAmount: number,
): InstallmentDraft[] {
  const target = existing.find((i) => i.sequence === editedSequence);
  if (!target) throw new InstallmentEngineError("Taksit bulunamadı.");
  if (newAmount < 0) throw new InstallmentEngineError("Taksit tutarı negatif olamaz.");

  const others = existing.filter((i) => i.sequence !== editedSequence);
  const lockedOthers = others.filter((i) => i.isLocked);
  const unlockedOthers = others.filter((i) => !i.isLocked);

  const committed = newAmount + lockedOthers.reduce((sum, i) => sum + i.amount, 0);
  const remainingForUnlocked = totalAmount - committed;

  if (remainingForUnlocked < 0) {
    throw new InstallmentEngineError("Girilen tutar, toplam plan tutarını aşıyor.");
  }
  if (unlockedOthers.length === 0 && remainingForUnlocked !== 0) {
    throw new InstallmentEngineError(
      "Dağıtılacak başka taksit kalmadığı için tutarlar toplamı plan tutarına eşit olmalıdır.",
    );
  }

  const base = unlockedOthers.length > 0 ? Math.floor(remainingForUnlocked / unlockedOthers.length) : 0;
  const rem = unlockedOthers.length > 0 ? remainingForUnlocked - base * unlockedOthers.length : 0;

  const redistributed = unlockedOthers
    .sort((a, b) => a.sequence - b.sequence)
    .map((i, idx) => ({ ...i, amount: base + (idx < rem ? 1 : 0) }));

  const updatedTarget: InstallmentDraft = { ...target, amount: newAmount, isLocked: true };

  return [...redistributed, ...lockedOthers, updatedTarget].sort((a, b) => a.sequence - b.sequence);
}

/** Updates only the due date of one installment (does not lock it or affect amounts). */
export function editDueDate(existing: InstallmentDraft[], sequence: number, dueDate: Date): InstallmentDraft[] {
  return existing.map((i) => (i.sequence === sequence ? { ...i, dueDate } : i));
}

export function assertBalanced(installments: InstallmentDraft[], totalAmount: number) {
  const sum = installments.reduce((acc, i) => acc + i.amount, 0);
  if (sum !== totalAmount) {
    throw new InstallmentEngineError(
      `Taksit toplamı (${sum}) plan tutarına (${totalAmount}) eşit değil.`,
    );
  }
}
