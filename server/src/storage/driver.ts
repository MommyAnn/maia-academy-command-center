import type { StorageDriver } from "./index.js";
import { env } from "../env.js";
import { localDriver as diskDriver } from "./localDriver.js";
import { s3Driver } from "./s3Driver.js";

/** The configured storage driver (STORAGE_DRIVER=local|s3). Every module reads/writes files through this. */
export const storage: StorageDriver = env.STORAGE_DRIVER === "s3" ? s3Driver : diskDriver;
