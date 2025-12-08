const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

async function importLeads() {
    const prisma = new PrismaClient();

    try {
        console.log('Starting lead import...');

        // Helper function to parse CSV
        function parseCSV(filePath) {
            const content = fs.readFileSync(filePath, 'utf-8');
            const lines = content.split('\n').filter(line => line.trim());
            const headers = lines[0].split(',').map(h => h.trim());

            return lines.slice(1).map(line => {
                // Handle quoted fields that might contain commas
                const values = [];
                let current = '';
                let inQuotes = false;

                for (let i = 0; i < line.length; i++) {
                    const char = line[i];
                    if (char === '"') {
                        inQuotes = !inQuotes;
                    } else if (char === ',' && !inQuotes) {
                        values.push(current.trim());
                        current = '';
                    } else {
                        current += char;
                    }
                }
                values.push(current.trim());

                const obj = {};
                headers.forEach((header, index) => {
                    obj[header] = values[index] || null;
                });
                return obj;
            });
        }

        // Import GHL leads (with "ads" tag)
        console.log('\n📢 Importing GHL leads (with "ads" tag)...');
        const ghlPath = path.join(__dirname, '../../Leads/Dashboard OS - GHL - Ad Leads.csv');
        const ghlLeads = parseCSV(ghlPath);

        let ghlImported = 0;
        for (const lead of ghlLeads) {
            if (!lead.Email && !lead['First Name']) continue; // Skip empty rows

            const fullName = `${lead['First Name'] || ''} ${lead['Last Name'] || ''}`.trim();
            const email = lead.Email?.toLowerCase().trim();

            if (!email) continue; // Skip leads without email

            await prisma.contact.upsert({
                where: { email },
                update: {
                    fullName: fullName || email,
                    phone: lead.Phone,
                },
                create: {
                    fullName: fullName || email || 'Unknown',
                    email,
                    phone: lead.Phone,
                    status: 'lead',
                    sourceTags: ['lead', 'ads'], // GHL leads get both tags
                },
            });

            ghlImported++;
            if (ghlImported % 50 === 0) {
                console.log(`  Imported ${ghlImported}/${ghlLeads.length} GHL leads...`);
            }
        }
        console.log(`✓ Imported ${ghlImported} GHL leads with "lead" + "ads" tags`);

        // Import Glofox leads (only "lead" tag, NO "ads")
        console.log('\n📋 Importing Glofox leads (only "lead" tag)...');
        const glofoxPath = path.join(__dirname, '../../Leads/Dashboard OS - Glofox Leads.csv');
        const glofoxLeads = parseCSV(glofoxPath);

        let glofoxImported = 0;
        for (const lead of glofoxLeads) {
            if (!lead.Email && !lead['First Name']) continue; // Skip empty rows

            const fullName = `${lead['First Name'] || ''} ${lead['Last Name'] || ''}`.trim();
            const email = lead.Email?.toLowerCase().trim();

            if (!email) continue; // Skip leads without email

            await prisma.contact.upsert({
                where: { email },
                update: {
                    fullName: fullName || email,
                    phone: lead.Phone,
                },
                create: {
                    fullName: fullName || email || 'Unknown',
                    email,
                    phone: lead.Phone,
                    status: 'lead',
                    sourceTags: ['lead'], // Glofox leads get ONLY "lead" tag (NO "ads")
                },
            });

            glofoxImported++;
            if (glofoxImported % 50 === 0) {
                console.log(`  Imported ${glofoxImported}/${glofoxLeads.length} Glofox leads...`);
            }
        }
        console.log(`✓ Imported ${glofoxImported} Glofox leads with only "lead" tag`);

        console.log(`\n✅ Lead import completed successfully!`);
        console.log(`Total imported: ${ghlImported + glofoxImported} leads`);
        console.log(`  - GHL leads (with "ads"): ${ghlImported}`);
        console.log(`  - Glofox leads (no "ads"): ${glofoxImported}`);

    } catch (error) {
        console.error('❌ Lead import failed:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

importLeads();
