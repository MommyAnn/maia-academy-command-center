import "./env.js"; // must load first: populates process.env.DATABASE_URL from the right .env file before PrismaClient reads it
import { PrismaClient } from "@prisma/client";

// Single shared Prisma client for the process — this IS the production
// database connection; every module in server/src reads and writes through
// this client, never through a duplicate/parallel store (unlike the
// frontend's localStorage stores, which this backend is built to replace).
export const db = new PrismaClient();
