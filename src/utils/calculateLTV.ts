/**
 * LTV Calculation Utilities
 * 
 * Single source of truth for calculating Lifetime Value (LTV) across the application.
 * LTV is calculated by summing ALL successful transactions for a client.
 */

/**
 * Transaction statuses that count as "successful" for LTV calculation.
 * These represent completed payments that contribute to lifetime value.
 */
export const SUCCESSFUL_TRANSACTION_STATUSES = [
    'completed',
    'paid',
    'PAID',
    'succeeded',
    'success',
    'Success',
    'Completed',
    'COMPLETED',
    'SETTLED',
] as const;

/**
 * Check if a transaction status is considered successful
 */
export function isSuccessfulTransaction(status: string | null | undefined): boolean {
    if (!status) return false;
    return SUCCESSFUL_TRANSACTION_STATUSES.some(
        s => s.toLowerCase() === status.toLowerCase()
    );
}

/**
 * Calculate LTV from an array of transactions
 * @param transactions Array of transactions with amountMinor and status fields
 * @returns Total LTV in minor currency units (cents/pence)
 */
export function calculateLtvFromTransactions(
    transactions: Array<{ amountMinor?: number | null; status?: string | null }>
): number {
    return transactions.reduce((sum, transaction) => {
        if (!isSuccessfulTransaction(transaction.status)) {
            return sum;
        }
        return sum + (transaction.amountMinor || 0);
    }, 0);
}

/**
 * Calculate LTV from an array of payments
 * @param payments Array of payments with amountCents field
 * @returns Total LTV in minor currency units (cents/pence)
 */
export function calculateLtvFromPayments(
    payments: Array<{ amountCents?: number | null }>
): number {
    return payments.reduce((sum, payment) => {
        return sum + (payment.amountCents || 0);
    }, 0);
}

/**
 * Check if a lead/contact is from ads based on tags or source
 */
export function isAdsClient(data: {
    tags?: string[] | null;
    source?: string | null;
}): boolean {
    // Check tags array for 'ads'
    if (data.tags && Array.isArray(data.tags)) {
        if (data.tags.includes('ads')) return true;
    }

    // Check source field
    if (data.source) {
        const source = data.source.toLowerCase();
        return (
            source.includes('ads') ||
            source.includes('facebook') ||
            source.includes('instagram') ||
            source.includes('meta') ||
            source.includes('tiktok') ||
            source === 'ghl_ads'
        );
    }

    return false;
}
