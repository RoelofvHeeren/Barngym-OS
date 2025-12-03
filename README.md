This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Deployment: Phase 2 Database Migration

Phase 2 adds GoHighLevel lead intake, tracking data, and lead events. The database needs new columns on `Lead` (`ghlContactId`, `goal`, `source`) and new tables (`LeadTracking`, `LeadEvent`).

### Commands to run in Railway (Shell tab)
1) Apply migrations (preferred):  
`npx prisma migrate deploy`

If migrate deploy fails because the migration history is missing, run:  
`npx prisma migrate dev --name phase2_lead_intake_pipeline`  
`npx prisma migrate deploy`

Last resort (only if no migration history exists):  
`npx prisma db push`

### Common symptoms if not migrated
- 500 errors mentioning missing columns, e.g. `Lead.ghlContactId does not exist`
- Deploy/build failures on Prisma schema changes

### Troubleshooting
- Ensure `DATABASE_URL` is set (Railway Variables) with the correct SSL params.
- Verify `prisma/migrations/phase2_lead_intake_pipeline/migration.sql` is present.
- After migration, confirm tables/columns exist (e.g., with `psql` or Prisma Studio: `LeadTracking`, `LeadEvent`, and `Lead.ghlContactId`).

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
