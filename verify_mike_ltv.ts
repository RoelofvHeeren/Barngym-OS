
import fs from "fs";
import path from "path";

// Load Env
const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, "utf8").split("\n");
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const [key, ...rest] = trimmed.split("=");
        if (!process.env[key]) {
            process.env[key] = rest.join("=").trim();
        }
    }
}

async function verifyMike() {
    const { prisma } = await import("./src/lib/prisma");

    // Find transaction first to get the correct Lead ID
    const tx = await prisma.transaction.findFirst({
        where: {
            personName: { contains: "Mike Patrick", mode: "insensitive" },
            provider: "Glofox"
        },
        select: { leadId: true, personName: true, externalId: true }
    });

    if (!tx || !tx.leadId) {
        console.log(`No linked Lead found for Mike Patrick-Dawson (Tx: ${tx?.personName ?? 'None'})`);
        return;
    }

    const lead = await prisma.lead.findUnique({
        where: { id: tx.leadId },
        include: { payments: true }
    });

    if (!lead) {
        console.log(`Lead ID ${tx.leadId} not found in DB.`);
        return;
    }

    console.log(`Found Lead: ${lead.fullName} (ID: ${lead.id}) linked to ${tx.personName}`);
    console.log(`Current LTV: ${lead.ltvAllCents}`);
    console.log(`Payment Count: ${lead.payments.length}`);

    const sum = lead.payments.reduce((acc, p) => acc + (p.amountCents || 0), 0);
    console.log(`Sum of Payments (after cleanup): ${sum}`);

    if (lead.ltvAllCents !== sum) {
        console.log("LTV mismatch. Recalculating...");
        await prisma.lead.update({
            where: { id: lead.id },
            data: { ltvAllCents: sum }
        });
        console.log(`LTV Updated to ${sum}.`);
    } else {
        console.log("LTV matches payments. Verification Successful.");
    }

    await prisma.$disconnect();
}

verifyMike()
    .catch(console.error);
