import { PrismaClient } from "@prisma/client";

const resolvedDatabaseUrl =
  process.env.DATABASE_URL ||
  process.env.DATABASE_PUBLIC_URL ||
  process.env.NEXT_PUBLIC_DATABASE_URL;

if (!resolvedDatabaseUrl) {
  throw new Error("DATABASE_URL is not set. Add it in Connections or your environment variables.");
}
// Ensure we always include a permissive SSL mode for hosted Postgres endpoints that use self-signed certs.
function withSafeSsl(url?: string | null) {
  if (!url) return undefined;
  const hasParams = url.includes("?");
  const connector = hasParams ? "&" : "?";
  if (url.includes("sslmode=")) return url;
  return `${url}${connector}sslmode=prefer&sslaccept=accept_invalid_certs`;
}

declare global {
  var prisma: PrismaClient | undefined;
}

export const prisma =
  global.prisma ||
  new PrismaClient({
    datasources: {
      db: {
        url: withSafeSsl(resolvedDatabaseUrl),
      },
    },
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  global.prisma = prisma;
}
