const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixAllNames() {
    try {
        console.log('Fixing ALL username-like names...');

        // Find contacts where fullName matches email username part
        const contacts = await prisma.contact.findMany({
            where: {
                email: { not: null }
            }
        });

        for (const c of contacts) {
            if (!c.email) continue;

            const emailUser = c.email.split('@')[0];
            const currentName = c.fullName || '';

            // Logic: If Name is roughly equal to Email User (case-insensitive) OR Name is null
            // e.g. "doogleplex" == "doogleplex"
            // e.g. "clare.staplehurst" == "clare.staplehurst"

            const isUsername = currentName.toLowerCase() === emailUser.toLowerCase();
            const needsFix = !currentName || isUsername;

            if (needsFix) {
                // Formatting Logic
                // 1. Split by dot, underscore, dash, numbers
                const parts = emailUser.split(/[\._-]+/);
                const formatted = parts.map(p => {
                    // Remove numbers? 
                    const letters = p.replace(/[0-9]/g, '');
                    if (letters.length > 0) {
                        return letters.charAt(0).toUpperCase() + letters.slice(1);
                    }
                    return p; // Keep number if only number?
                }).filter(p => p.length > 0).join(' ');

                if (formatted && formatted.toLowerCase() !== currentName.toLowerCase()) {
                    console.log(`Renaming: ${currentName || '(empty)'} -> ${formatted} (${c.email})`);
                    await prisma.contact.update({
                        where: { id: c.id },
                        data: { fullName: formatted }
                    });
                }
            }
        }
        console.log('Global Name fix complete.');

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

fixAllNames();
