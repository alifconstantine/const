import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { sumopodWebhook } from "./router/payments";

const http = httpRouter();

auth.addHttpRoutes(http);
http.route({ path: "/payments/sumopod/webhook", method: "POST", handler: sumopodWebhook });

export default http;
