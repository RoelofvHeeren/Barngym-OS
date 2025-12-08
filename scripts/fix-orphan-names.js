const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixNames() {
    try {
        const contacts = await prisma.contact.findMany({
            where: {
                AND: [
                    { status: 'client' },
                    { sourceTags: { hasSome: ['stripe', 'starling'] } }
                ]
            }
        });

        for (const c of contacts) {
            if (!c.email) continue;

            // Check if name is raw username (e.g. "stick2510" from "stick2510@...")
            const emailUser = c.email.split('@')[0];
            const currentName = c.fullName || '';

            // If name exactly matches email part, or looks like "dylan.oflanagan"
            if (currentName === emailUser || currentName === emailUser.toLowerCase()) {

                // Formatting Logic
                let clean = emailUser.replace(/[0-9]+$/g, ''); // Remove trailing numbers? e.g. stick2510 -> stick. User might prefer Stick2510.
                // Let's keep numbers but separate them? 
                // Strategy: Split by dot, underscore, numbers.

                const parts = emailUser.split(/[\._-]+/);
                const formatted = parts.map(p => {
                    // Remove numbers if mixed? e.g. "oflanagan69" -> "oflanagan" "69"?
                    // Simple capitalization first.
                    return p.charAt(0).toUpperCase() + p.slice(1);
                }).join(' ');

                if (formatted !== currentName) {
                    console.log(`Renaming: ${currentName} -> ${formatted}`);
                    await prisma.contact.update({
                        where: { id: c.id },
                        data: { fullName: formatted }
                    });
                }
            }
        }
        console.log('Name fix complete.');

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

fixNames();
