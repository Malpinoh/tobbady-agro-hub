export type ExpenseCorrectionSource = {
  status: string;
  payment_status: string;
};

export const isReviewedExpense = (expense: ExpenseCorrectionSource) =>
  expense.status.toLowerCase() !== "pending" || expense.payment_status.toLowerCase() === "paid";

export function expenseCorrectionValues(expense: ExpenseCorrectionSource, form: {
  date: string; description: string; reference: string; amount: string; category: string; livestockLink: string;
}) {
  const correction = { spent_on: form.date, description: form.description.trim() || null, reference: form.reference.trim() || null };
  if (isReviewedExpense(expense)) return correction;
  return {
    ...correction, amount: Number(form.amount), category: form.category,
    animal_id: form.livestockLink.startsWith("animal:") ? form.livestockLink.slice(7) : null,
    batch_id: form.livestockLink.startsWith("batch:") ? form.livestockLink.slice(6) : null,
  };
}

export function validateMortality(quantity: number, maximum: number, date: string, today: string, reason: string) {
  if (!Number.isInteger(quantity) || quantity <= 0 || quantity > maximum) return "Enter a whole-number quantity within the remaining stock.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date)) || date > today) return "Choose a valid death date, not in the future.";
  if (reason.trim().length < 5) return "Explain the cause or reason (at least 5 characters).";
  return null;
}