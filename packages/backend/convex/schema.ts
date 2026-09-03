import { defineSchema } from "convex/server";
import { authTables } from "./schema/auth";
import { sharedTables } from "./schema/shared";

export default defineSchema({
  ...authTables,
  ...sharedTables,
});
