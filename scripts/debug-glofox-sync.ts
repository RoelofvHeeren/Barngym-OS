
import { config } from 'dotenv';
const resultLocal = config({ path: '.env.local' });
const resultEnv = config({ path: '.env' });

async function main() {
    const { PrismaClient } = await import('@prisma/client');
    const { prisma } = await import('../src/lib/prisma');

    console.log("🔍 Starting Glofox Branch Discovery...");

    const record = await prisma.connectionSecret.findUnique({
        where: { provider: "glofox" },
    });

    const secret = (record?.secret as any);
    const { apiKey, apiToken } = secret;

    const urls = [
        `https://gf-api.aws.glofox.com/prod/2.0/admin/branches`,
        `https://gf-api.aws.glofox.com/prod/2.0/branches`,
        `https://gf-api.aws.glofox.com/prod/2.0/user`,
        `https://gf-api.aws.glofox.com/prod/2.0/users/me`
    ];

    for (const url of urls) {
        console.log(`\nfetching: ${url}`);
        try {
            const res = await fetch(url, {
                headers: {
                    "Content-Type": "application/json",
                    "x-api-key": apiKey,
                    "x-glofox-api-token": apiToken,
                    // NO Branch ID Header!
                },
            });

            const txt = await res.text();
            console.log(`   Status: ${res.status}`);
            console.log(`   Body: ${txt.slice(0, 500)}`);
        } catch (e) {
            console.error(e);
        }
    }
}

main()
    .catch(console.error);
