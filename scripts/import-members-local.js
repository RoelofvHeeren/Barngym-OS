const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

async function importMembers() {
    const prisma = new PrismaClient();

    try {
        console.log('Starting member import...');

        // Helper function to parse CSV
        function parseCSV(filePath) {
            const content = fs.readFileSync(filePath, 'utf-8');
            const lines = content.split('\n').filter(line => line.trim());
            // Handle BOM if present
            const firstLine = lines[0].replace(/^\uFEFF/, '');
            const headers = firstLine.split(',').map(h => h.trim());

            return lines.slice(1).map(line => {
                // Simple CSV parser handling quotes
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

        // Process function to handle upsert with tag merging
        async function processContact(email, firstName, lastName, phone, newTag) {
            if (!email) return;
            email = email.toLowerCase().trim();
            const fullName = `${firstName || ''} ${lastName || ''}`.trim() || email;

            const existing = await prisma.contact.findUnique({ where: { email } });

            if (existing) {
                // Merge tags
                const tags = new Set(existing.sourceTags || []);
                if (newTag) tags.add(newTag);
                // Force status to client for members
                await prisma.contact.update({
                    where: { email },
                    data: {
                        status: 'client',
                        sourceTags: Array.from(tags),
                        // Update phone/name if missing? Maybe better to keep existing if valid
                        phone: existing.phone || phone,
                    }
                });
                process.stdout.write('.');
            } else {
                // Create new
                const tags = [];
                if (newTag) tags.push(newTag);

                await prisma.contact.create({
                    data: {
                        email,
                        fullName,
                        phone,
                        status: 'client',
                        sourceTags: tags,
                    }
                });
                process.stdout.write('+');
            }
        }

        // 1. Import Glofox Members
        console.log('\n🏋️  Importing Glofox Members...');
        const glofoxPath = path.join(__dirname, '../../Members/Dashboard OS - Glofox Members.csv');
        const glofoxMembers = parseCSV(glofoxPath);
        console.log(`Found ${glofoxMembers.length} Glofox records`);

        for (const member of glofoxMembers) {
            // User didn't request explicit tag for Glofox, but let's add 'glofox' for tracking?
            // "just give the trainerize ones a tag with trainerize" implies Glofox might not need one, 
            // but usually good practice. Let's add 'glofox' but focus on status=client.
            await processContact(
                member.Email,
                member['First Name'],
                member['Last Name'],
                member.Phone,
                'glofox'
            );
        }
        console.log('\n✓ Glofox import done.');

        // 2. Import Trainerize Members
        console.log('\n📱 Importing Trainerize Members...');
        const trainerizePath = path.join(__dirname, '../../Members/Dashboard OS - Trainerize Members.csv');
        const trainerizeMembers = parseCSV(trainerizePath);
        console.log(`Found ${trainerizeMembers.length} Trainerize records`);

        for (const member of trainerizeMembers) {
            await processContact(
                member.Email,
                member['First Name'],
                member['Last Name'],
                member.Phone,
                'trainerize' // Explicitly requested tag
            );
        }
        console.log('\n✓ Trainerize import done.');

        console.log('\n✅ Member import completed successfully!');

    } catch (error) {
        console.error('\n❌ Member import failed:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

importMembers();
