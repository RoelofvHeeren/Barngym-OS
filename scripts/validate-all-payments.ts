import { prisma } from '../src/lib/prisma';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

/**
 * Payment Validation Script
 * 
 * Validates and counts all payment transactions across all providers:
 * - Stripe (via Payment table AND Transaction table)
 * - Glofox (via Payment table AND Transaction table)
 * - Starling (via Transaction table)
 * 
 * Generates a comprehensive report showing totals, date ranges, and discrepancies.
 * Calculates a "Unique Total" by deduplicating across both tables.
 */

interface ProviderStats {
  total: number;
  oldest: Date | null;
  newest: Date | null;
  sources: string[];
}

interface ValidationReport {
  stripe: ProviderStats;
  glofox: ProviderStats;
  starling: ProviderStats;
  other: ProviderStats;
  paymentTableCount: number;
  transactionTableCount: number;
  projectedUniqueTotal: number;
  overlapCount: number;
  generatedAt: Date;
}

async function validateAllPayments(): Promise<ValidationReport> {
  console.log('\n' + '='.repeat(70));
  console.log('Payment Validation - Historical & Live Data Audit');
  console.log('='.repeat(70) + '\n');

  // 1. Fetch all Payment IDs and timestamps
  console.log('Fetching Payment table data...');
  const payments = await prisma.payment.findMany({
    select: { 
      externalPaymentId: true, 
      sourceSystem: true,
      timestamp: true 
    }
  });
  console.log(`  ✓ Found ${payments.length} records in Payment table`);

  // 2. Fetch all Transaction IDs and timestamps
  console.log('Fetching Transaction table data...');
  const transactions = await prisma.transaction.findMany({
    select: { 
      externalId: true, 
      provider: true, 
      source: true,
      occurredAt: true 
    }
  });
  console.log(`  ✓ Found ${transactions.length} records in Transaction table`);

  // 3. Process Data
  const uniqueIds = new Set<string>();
  const stats = {
    stripe: { count: 0, oldest: null as Date | null, newest: null as Date | null },
    glofox: { count: 0, oldest: null as Date | null, newest: null as Date | null },
    starling: { count: 0, oldest: null as Date | null, newest: null as Date | null },
    other: { count: 0, oldest: null as Date | null, newest: null as Date | null }
  };

  const updateStats = (provider: string, date: Date) => {
    const key = provider.toLowerCase().includes('stripe') ? 'stripe' :
                provider.toLowerCase().includes('glofox') ? 'glofox' :
                provider.toLowerCase().includes('starling') ? 'starling' : 'other';
    
    stats[key].count++;
    if (!stats[key].oldest || date < stats[key].oldest!) stats[key].oldest = date;
    if (!stats[key].newest || date > stats[key].newest!) stats[key].newest = date;
  };

  // Consolidate Unique IDs and Stats
  // Priority: Transaction > Payment (if ID exists in both, counting it once is implied by Set, 
  // but for provider stats we want to count the unique entity)
  
  // Actually, we want to know the "Projected State".
  // The migration moves Payment -> Transaction.
  // So the final set is Union(Payment, Transaction).
  
  const allRecords = [
    ...payments.map(p => ({ id: p.externalPaymentId, provider: p.sourceSystem, date: p.timestamp, origin: 'payment' })),
    ...transactions.map(t => ({ id: t.externalId, provider: t.provider || t.source, date: t.occurredAt, origin: 'transaction' }))
  ];

  let overlapCount = 0;

  for (const record of allRecords) {
    if (!record.id) continue;
    
    if (uniqueIds.has(record.id)) {
      overlapCount++;
      continue;
    }
    
    uniqueIds.add(record.id);
    updateStats(record.provider || 'unknown', record.date);
  }

  // Helper to format stats
  const formatStats = (s: typeof stats.stripe): ProviderStats => ({
    total: s.count,
    oldest: s.oldest,
    newest: s.newest,
    sources: []
  });

  const report: ValidationReport = {
    stripe: formatStats(stats.stripe),
    glofox: formatStats(stats.glofox),
    starling: formatStats(stats.starling),
    other: formatStats(stats.other),
    paymentTableCount: payments.length,
    transactionTableCount: transactions.length,
    projectedUniqueTotal: uniqueIds.size,
    overlapCount,
    generatedAt: new Date()
  };

  // Output Summary
  console.log('\n' + '='.repeat(70));
  console.log('Consolidated Summary (Unique Transactions)');
  console.log('='.repeat(70));
  console.log(`Stripe:                 ${stats.stripe.count.toLocaleString()}`);
  console.log(`Glofox:                 ${stats.glofox.count.toLocaleString()}`);
  console.log(`Starling:               ${stats.starling.count.toLocaleString()}`);
  if (stats.other.count > 0) {
    console.log(`Other:                  ${stats.other.count.toLocaleString()}`);
  }
  console.log('='.repeat(70));
  console.log(`Projected Total:        ${uniqueIds.size.toLocaleString()}`);
  console.log(`(Records in Payment: ${payments.length}, Transaction: ${transactions.length}, Overlap: ${overlapCount})`);
  console.log('='.repeat(70) + '\n');

  return report;
}

async function generateReport(report: ValidationReport): Promise<void> {
  const reportsDir = path.join(process.cwd(), 'reports');
  await mkdir(reportsDir, { recursive: true });

  const timestamp = new Date().toISOString().split('T')[0];
  const reportPath = path.join(reportsDir, `payment-validation-consolidated-${timestamp}.md`);

  const markdown = `# Payment Validation Report (Consolidated)
**Generated**: ${report.generatedAt.toISOString()}

## Executive Summary

This report counts **unique transactions** across both the legacy \`Payment\` table and the current \`Transaction\` table. It simulates the final state after all payments are migrated.

### Projected Unique Totals
| Provider | Unique Count | Oldest | Newest |
|----------|-------------:|--------|--------|
| **Stripe** | **${report.stripe.total.toLocaleString()}** | ${report.stripe.oldest?.toISOString().split('T')[0] || '-'} | ${report.stripe.newest?.toISOString().split('T')[0] || '-'} |
| **Glofox** | **${report.glofox.total.toLocaleString()}** | ${report.glofox.oldest?.toISOString().split('T')[0] || '-'} | ${report.glofox.newest?.toISOString().split('T')[0] || '-'} |
| **Starling** | **${report.starling.total.toLocaleString()}** | ${report.starling.oldest?.toISOString().split('T')[0] || '-'} | ${report.starling.newest?.toISOString().split('T')[0] || '-'} |
| **Other** | **${report.other.total.toLocaleString()}** | ${report.other.oldest?.toISOString().split('T')[0] || '-'} | ${report.other.newest?.toISOString().split('T')[0] || '-'} |
| **TOTAL** | **${report.projectedUniqueTotal.toLocaleString()}** | | |

## Data Sources

- **Payment Table**: ${report.paymentTableCount.toLocaleString()} records
- **Transaction Table**: ${report.transactionTableCount.toLocaleString()} records
- **Overlapping Records**: ${report.overlapCount.toLocaleString()} (Exist in both, deduplicated)

## Migration Impact
The migration script will move any records from \`Payment\` that do NOT exist in \`Transaction\`.
- Total Unique Records: **${report.projectedUniqueTotal.toLocaleString()}**
- This includes historical file imports AND live webhook data.
`;

  await writeFile(reportPath, markdown);
  console.log(`\n✅ Consolidated report saved to: ${reportPath}\n`);
}

async function main() {
  try {
    const report = await validateAllPayments();
    await generateReport(report);
    await prisma.$disconnect();
  } catch (error) {
    console.error('Error:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

main();
