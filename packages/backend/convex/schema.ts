import { defineSchema } from "convex/server";
import { authTables } from "./schema/auth";
import { sharedTables } from "./schema/shared";
import { routerTables } from "./schema/router";
import { learnTables } from "./schema/learn";

export default defineSchema({
  ...authTables,
  ...sharedTables,
  ...routerTables,
  ...learnTables,
});
