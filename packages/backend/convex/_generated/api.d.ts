/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as auth_queries from "../auth/queries.js";
import type * as http from "../http.js";
import type * as rateLimits from "../rateLimits.js";
import type * as router_keys from "../router/keys.js";
import type * as schema_auth from "../schema/auth.js";
import type * as schema_router from "../schema/router.js";
import type * as schema_shared from "../schema/shared.js";
import type * as shared_rateLimits from "../shared/rateLimits.js";
import type * as testing from "../testing.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  "auth/queries": typeof auth_queries;
  http: typeof http;
  rateLimits: typeof rateLimits;
  "router/keys": typeof router_keys;
  "schema/auth": typeof schema_auth;
  "schema/router": typeof schema_router;
  "schema/shared": typeof schema_shared;
  "shared/rateLimits": typeof shared_rateLimits;
  testing: typeof testing;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
