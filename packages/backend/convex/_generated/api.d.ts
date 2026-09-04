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
import type * as learn_artifacts from "../learn/artifacts.js";
import type * as learn_collections from "../learn/collections.js";
import type * as learn_learns from "../learn/learns.js";
import type * as rateLimits from "../rateLimits.js";
import type * as router_chats from "../router/chats.js";
import type * as router_combos from "../router/combos.js";
import type * as router_crypto from "../router/crypto.js";
import type * as router_keys from "../router/keys.js";
import type * as router_logs from "../router/logs.js";
import type * as router_providers from "../router/providers.js";
import type * as schema_auth from "../schema/auth.js";
import type * as schema_learn from "../schema/learn.js";
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
  "learn/artifacts": typeof learn_artifacts;
  "learn/collections": typeof learn_collections;
  "learn/learns": typeof learn_learns;
  rateLimits: typeof rateLimits;
  "router/chats": typeof router_chats;
  "router/combos": typeof router_combos;
  "router/crypto": typeof router_crypto;
  "router/keys": typeof router_keys;
  "router/logs": typeof router_logs;
  "router/providers": typeof router_providers;
  "schema/auth": typeof schema_auth;
  "schema/learn": typeof schema_learn;
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
