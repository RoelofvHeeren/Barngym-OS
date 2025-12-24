import { prisma } from '../src/lib/prisma';
import { writeFile, readFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

/**
 * Resilient Payment Migration Script
 * 
 * Features:
 * - Auto-reconnect with exponential backoff
 * - Checkpoint-based progress tracking
 * - Auto-resume from last checkpoint
 * - Idempotent (safe to re-run)
 */

interface MigrationState {
  lastProcessedPaymentIndex: number;
  lastProcessedPaymentId: string;
  totalPayments: number;
  processedCount: number;
  contactsCreated: number;
  transactionsCreated: number;
  transactionsSkipped: number;
  leadsLinked: number;
  errors: Array<{ paymentId: string; error: string }>;
  startedAt: string;
  lastCheckpoint: string;
  completed: boolean;
}

const STATE_FILE = path.join(process.cwd(), 'reports', 'migration-state.json');
const LOG_FILE = path.join(process.cwd(), 'reports', `migration-${new Date().toISOString().split('T')[0]}.log`);

function log(message: string) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);
  // Append to log file asynchronously
  writeFile(LOG_FILE, logMessage + '\n', { flag: 'a' }).catch(() => { });
}

async function loadState(): Promise<MigrationState | null> {
  try {
    if (existsSync(STATE_FILE)) {
      const data = await readFile(STATE_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    log(`Warning: Could not load state file: ${error}`);
  }
  return null;
}

async function saveState(state: MigrationState): Promise<void> {
  try {
    await mkdir(path.dirname(STATE_FILE), { recursive: true });
    await writeFile(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (error) {
    log(`Error saving state: ${error}`);
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function connectWithRetry(maxRetries = 10, initialDelay = 2000): Promise<boolean> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      log(`Attempting database connection (attempt ${attempt}/${maxRetries})...`);
      await prisma.$connect();
      await prisma.$queryRaw`SELECT 1`; // Test query
      log('✓ Database connected successfully');
      return true;
    } catch (error) {
      const delay = Math.min(initialDelay * Math.pow(2, attempt - 1), 60000); // Max 60s
      log(`Connection failed: ${error instanceof Error ? error.message : String(error)}`);

      if (attempt < maxRetries) {
        log(`Retrying in ${delay / 1000}s...`);
        await sleep(delay);
      }
    }
  }

  log('❌ Failed to connect after maximum retries');
  return false;
}

async function processPaymentWithRetry(
  payment: any,
  state: MigrationState,
  maxRetries = 3
): Promise<{ success: boolean; created: boolean }> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Skip if no lead or no  email
      if (!payment.leadId || !payment.lead?.email) {
        state.transactionsSkipped++;
        return { success: true, created: false };
      }

      const lead = payment.lead;

      // Find or create Contact
      let contact = await prisma.contact.findUnique({
        where: { email: lead.email }
      });

      if (!contact) {
        contact = await prisma.contact.create({
          data: {
            email: lead.email,
            fullName: lead.fullName || undefined,
            phone: lead.phone || undefined,
            status: 'client',
            sourceTags: lead.source ? [lead.source] : [],
            firstSeenAt: lead.createdAt,
            isActive: true
          }
        });
        state.contactsCreated++;
      }

      // Check if transaction already exists
      const existingTransaction = await prisma.transaction.findFirst({
        where: {
          OR: [
            { externalId: payment.externalPaymentId },
            {
              AND: [
                { contactId: contact.id },
                { occurredAt: payment.timestamp },
                { amountMinor: payment.amountCents }
              ]
            }
          ]
        }
      });

      if (existingTransaction) {
        state.transactionsSkipped++;
        return { success: true, created: false };
      }

      // Create transaction
      await prisma.transaction.create({
        data: {
          contactId: contact.id,
          externalId: payment.externalPaymentId,
          transactionUid: `migrated-${payment.id}`,
          amountMinor: payment.amountCents,
          currency: payment.currency,
          occurredAt: payment.timestamp,
          status: 'succeeded',
          provider: payment.sourceSystem,
          source: payment.sourceSystem,
          productType: payment.productType || undefined,
          personName: lead.fullName || undefined,
          confidence: 'high',
          description: 'Migrated from Payment table',
          raw: payment.rawPayload,
          tags: ['migrated-from-payment'],
          createdAt: payment.createdAt
        }
      });
      state.transactionsCreated++;

      // Link lead to contact
      await prisma.lead.update({
        where: { id: lead.id },
        data: { isClient: true }
      });
      state.leadsLinked++;

      return { success: true, created: true };

    } catch (error) {
      const isConnectionError = error instanceof Error &&
        (error.message.includes('database') || error.message.includes('connection') || error.message.includes('P1001'));

      if (isConnectionError && attempt < maxRetries) {
        log(`Connection error processing payment ${payment.id}, retrying...`);
        await sleep(2000);
        const reconnected = await connectWithRetry();
        if (!reconnected) {
          throw error;
        }
        continue;
      }

      // Non-connection error or out of retries
      state.errors.push({
        paymentId: payment.id,
        error: error instanceof Error ? error.message : String(error)
      });

      log(`Error processing payment ${payment.id}: ${error instanceof Error ? error.message : String(error)}`);
      return { success: false, created: false };
    }
  }

  return { success: false, created: false };
}

async function runMigration(dryRun: boolean = true): Promise<void> {
  log('\n' + '='.repeat(70));
  log(`Resilient Payment Migration ${dryRun ? '(DRY RUN)' : '(LIVE)'}`);
  log('='.repeat(70));

  // Load or create state
  let state = await loadState();

  if (state?.completed) {
    log('\n✅ Migration already completed!');
    log('Previous run stats:');
    log(`  - Processed: ${state.processedCount}/${state.totalPayments}`);
    log(`  - Contacts Created: ${state.contactsCreated}`);
    log(`  - Transactions Created: ${state.transactionsCreated}`);
    log(`  - Transactions Skipped: ${state.transactionsSkipped}`);
    log(`  - Leads Linked: ${state.leadsLinked}`);
    log(`  - Errors: ${state.errors.length}`);
    return;
  }

  if (state && !state.completed) {
    log(`\n📋 Resuming from checkpoint...`);
    log(`  Last checkpoint: ${state.lastCheckpoint}`);
    log(`  Progress: ${state.processedCount}/${state.totalPayments} payments`);
    log(`  Created: ${state.transactionsCreated} transactions`);
  } else {
    log('\n🚀 Starting new migration...');
    state = {
      lastProcessedPaymentIndex: -1,
      lastProcessedPaymentId: '',
      totalPayments: 0,
      processedCount: 0,
      contactsCreated: 0,
      transactionsCreated: 0,
      transactionsSkipped: 0,
      leadsLinked: 0,
      errors: [],
      startedAt: new Date().toISOString(),
      lastCheckpoint: new Date().toISOString(),
      completed: false
    };
  }

  // Connect to database
  const connected = await connectWithRetry();
  if (!connected) {
    throw new Error('Could not establish database connection');
  }

  // Fetch all payments (ordered for consistent processing)
  log('\nFetching payments...');
  const payments = await prisma.payment.findMany({
    include: {
      lead: {
        select: {
          id: true,
          email: true,
          fullName: true,
          phone: true,
          source: true,
          tags: true,
          createdAt: true
        }
      }
    },
    orderBy: { id: 'asc' }
  });

  state.totalPayments = payments.length;
  log(`Found ${payments.length} total payments`);

  // Start processing from last checkpoint
  const startIndex = state.lastProcessedPaymentIndex + 1;
  log(`Processing from index ${startIndex}...\n`);

  for (let i = startIndex; i < payments.length; i++) {
    const payment = payments[i];

    try {
      if (!dryRun) {
        const result = await processPaymentWithRetry(payment, state);
        state.processedCount++;
        state.lastProcessedPaymentIndex = i;
        state.lastProcessedPaymentId = payment.id;

        // Checkpoint every 50 payments
        if (state.processedCount % 50 === 0) {
          state.lastCheckpoint = new Date().toISOString();
          await saveState(state);
          log(`Checkpoint: ${state.processedCount}/${state.totalPayments} (${Math.round(state.processedCount / state.totalPayments * 100)}%)`);
        }
      } else {
        // Dry run - just log
        if (i % 100 === 0 && i > 0) {
          log(`[DRY RUN] Would process: ${i}/${payments.length} payments`);
        }
        state.processedCount++;
      }

    } catch (error) {
      log(`Fatal error at payment ${i}: ${error}`);
      state.errors.push({
        paymentId: payment.id,
        error: error instanceof Error ? error.message : String(error)
      });

      // Save state before exiting
      await saveState(state);
      throw error;
    }
  }

  // Mark as completed
  if (!dryRun) {
    state.completed = true;
    state.lastCheckpoint = new Date().toISOString();
    await saveState(state);
  }

  // Final summary
  log('\n' + '='.repeat(70));
  log('Migration Complete!');
  log('='.repeat(70));
  log(`Total Payments:          ${state.totalPayments}`);
  log(`Processed:               ${state.processedCount}`);
  log(`Contacts Created:        ${state.contactsCreated}`);
  log(`Transactions Created:    ${state.transactionsCreated}`);
  log(`Transactions Skipped:    ${state.transactionsSkipped}`);
  log(`Leads Linked:            ${state.leadsLinked}`);
  log(`Errors:                  ${state.errors.length}`);
  log('='.repeat(70) + '\n');

  if (state.errors.length > 0) {
    log('Errors encountered:');
    state.errors.slice(0, 10).forEach((err, idx) => {
      log(`  ${idx + 1}. Payment ${err.paymentId}: ${err.error}`);
    });
    if (state.errors.length > 10) {
      log(`  ... and ${state.errors.length - 10} more`);
    }
  }
}

async function main() {
  const dryRun = !process.argv.includes('--execute');

  if (!dryRun) {
    log('\n⚠️  WARNING: Running in LIVE mode. Data will be modified!\n');
    log('Press Ctrl+C to cancel, or wait 5 seconds to continue...\n');
    await sleep(5000);
  }

  try {
    await runMigration(dryRun);
    await prisma.$disconnect();

    if (dryRun) {
      log('✅ Dry run complete. Run with --execute to apply changes.\n');
    } else {
      log('✅ Live migration complete!\n');
    }

    process.exit(0);
  } catch (error) {
    log(`\n❌ Fatal error: ${error}`);
    await prisma.$disconnect();
    process.exit(1);
  }
}

main();
