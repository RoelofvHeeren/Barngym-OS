import { prisma } from '@/lib/prisma';

async function main() {
    const contactId = 'cmiwpdrk7009tuqduh0tkr61c'; // From transaction linkage

    console.log(`Investigating Contact ID ${contactId}...`);

    const contact = await prisma.contact.findUnique({
        where: { id: contactId },
        include: {
            transactions: true
        }
    });

    if (contact) {
        console.log(`Name: ${contact.fullName}`);
        console.log(`Email: ${contact.email}`);
        console.log(`Phone: ${contact.phone}`);
        console.log(`LTV All: £${contact.ltvAllCents / 100}`);
        console.log(`Transaction Count: ${contact.transactions.length}`);
    } else {
        console.log('Contact not found');
    }
}

main()
    .catch((e) => console.error(e))
    .finally(async () => await prisma.$disconnect());
