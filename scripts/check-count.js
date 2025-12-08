const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.transaction.count().then(count => {
    console.log('Transaction Count:', count);
    process.exit(0);
}).catch(e => {
    console.error(e);
    process.exit(1);
});
