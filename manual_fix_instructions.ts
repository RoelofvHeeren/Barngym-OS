import { prisma } from './src/lib/prisma';

async function updateAdsLeadsRoute() {
    console.log('The Ads Dashboard API needs to be updated manually.');
    console.log('Location: /Users/roelofvanheeren/Code Projects/Barn Gym Dashboard/app/src/app/api/ads/leads/route.ts');
    console.log('');
    console.log('The issue: Line 187-189 fetches contacts but doesn\'t include their transactions.');
    console.log('');
    console.log('Change line 187-190 from:');
    console.log('    const contacts = await prisma.contact.findMany({');
    console.log('      where: { email: { in: leadEmails } },');
    console.log('      select: { id: true, email: true },');
    console.log('    });');
    console.log('');
    console.log('To:');
    console.log('    const contacts = await prisma.contact.findMany({');
    console.log('      where: { email: { in: leadEmails } },');
    console.log('      select: { ');
    console.log('        id: true, ');
    console.log('        email: true,');
    console.log('        transactions: {');
    console.log('          select: { occurredAt: true, amountMinor: true, status: true, productType: true }');
    console.log('        }');
    console.log('      },');
    console.log('    });');
    console.log('');
    console.log('Then after line 194, add code to merge Contact transactions into paymentsMap');

    await prisma.$disconnect();
}

updateAdsLeadsRoute();
