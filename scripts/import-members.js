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
            const headers = lines[0].split(',');

            return lines.slice(1).map(line => {
                const values = line.split(',');
                const obj = {};
                headers.forEach((header, index) => {
                    obj[header.trim()] = values[index]?.trim() || null;
                });
                return obj;
            });
        }

        // Import Glofox clients
        console.log('Importing Glofox clients...');
        const glofoxPath = path.join(__dirname, '../../Barn Gym Transaction : Member Data/Glofox Clients.csv');
        const glofoxClients = parseCSV(glofoxPath);

        let glofoxImported = 0;
        for (const client of glofoxClients) {
            if (!client.Email && !client['First Name']) continue; // Skip empty rows

            const fullName = `${client['First Name'] || ''} ${client['Last Name'] || ''}`.trim();

            await prisma.contact.upsert({
                where: { email: client.Email || `noemail_${Date.now()}_${Math.random()}` },
                update: {
                    fullName: fullName || client.Email,
                    phone: client.Phone,
                },
                create: {
                    fullName: fullName || client.Email || 'Unknown',
                    email: client.Email,
                    phone: client.Phone,
                    status: 'lead', // Will be updated to 'client' by classification script
                    sourceTags: ['glofox'],
                },
            });

            glofoxImported++;
            if (glofoxImported % 100 === 0) {
                console.log(`  Imported ${glofoxImported}/${glofoxClients.length} Glofox clients...`);
            }
        }
        console.log(`✓ Imported ${glofoxImported} Glofox clients`);

        // Import Trainerize clients
        console.log('Importing Trainerize clients...');
        const trainerizePath = path.join(__dirname, '../../Barn Gym Transaction : Member Data/Trainerize Clients.csv');
        const trainerizeClients = parseCSV(trainerizePath);

        let trainerizeImported = 0;
        for (const client of trainerizeClients) {
            if (!client.Email && !client['First Name']) continue; // Skip empty rows

            const fullName = `${client['First Name'] || ''} ${client['Last Name'] || ''}`.trim();

            await prisma.contact.upsert({
                where: { email: client.Email || `noemail_${Date.now()}_${Math.random()}` },
                update: {
                    fullName: fullName || client.Email,
                    phone: client.Phone,
                },
                create: {
                    fullName: fullName || client.Email || 'Unknown',
                    email: client.Email,
                    phone: client.Phone,
                    status: 'lead', // Will be updated to 'client' by classification script
                    sourceTags: ['trainerize'],
                },
            });

            trainerizeImported++;
            if (trainerizeImported % 50 === 0) {
                console.log(`  Imported ${trainerizeImported}/${trainerizeClients.length} Trainerize clients...`);
            }
        }
        console.log(`✓ Imported ${trainerizeImported} Trainerize clients`);

        console.log(`\nMember import completed successfully!`);
        console.log(`Total imported: ${glofoxImported + trainerizeImported} members`);

    } catch (error) {
        console.error('Member import failed:', error);
        throw error; // Fail the build if import fails
    } finally {
        await prisma.$disconnect();
    }
}

importMembers();
