import { defineSchema } from "convex/server";
import { authTables } from "./schema/auth";
import { routerTables } from "./schema/router";

export default defineSchema({
  ...authTables,
  ...routerTables,
});
