import Fastify, { FastifyReply, FastifyRequest, HookHandlerDoneFunction } from 'fastify';
import dotenv from "dotenv";
import { log } from './utils/logger';
import { readFileSync, writeFileSync } from 'fs';
dotenv.config();
const fastify = Fastify();

// Import routes on startup.
// Keep in-memory for performance.
const routes = JSON.parse(readFileSync(process.env.REST_DATA_LOCATION as string, "utf-8"));

/**
 * Check if a string is a valid URL.
 * @param url The URL to validate.
 * @returns If the URL is valid or not.
 */
function isValidUrl(url: string): boolean {
    try {
        new URL(url);
        return true;
    } catch (error) {
        return false;
    }
}

/**
 * Check if the request is authorized.
 * @param request The incoming request.
 * @param reply The downstream reply.
 * @param done Send the request downstream.
 * @returns Reply on unauthorized or void for downstream.
 */
function isAuthorized(request: FastifyRequest, reply: FastifyReply, done: HookHandlerDoneFunction): FastifyReply | void {
    if (request.headers["authorization"] === `Bearer ${process.env.REST_AUTH_TOKEN}`) {
        return done();
    } else return reply.status(401).send("Unauthorized");
}

// Logging
fastify.addHook("preHandler", (request: FastifyRequest, _reply: FastifyReply, done: HookHandlerDoneFunction) => {
    log(`API Request || Agent: ${request.headers["user-agent"]} || ${request.method} ${request.url}`, "info");
    done();
});

// Read Route
fastify.get("/r/:target/:hash?", (request: FastifyRequest, reply: FastifyReply): FastifyReply => {
    const params = request.params as { target: string, hash: string | undefined };
    const targetUrl: string | undefined = routes[params.target];
    if (targetUrl) {
        return reply.status(302).redirect(targetUrl + (params.hash ? `#${params.hash}` : ""));
    } else return reply.status(404).send("Route not found.");
});

// Read All Routes
fastify.get("/r", { preHandler: isAuthorized }, (_request: FastifyRequest, reply: FastifyReply): FastifyReply => {
    return reply.send(routes);
});

// New Route
fastify.post("/w", { preHandler: isAuthorized }, (request: FastifyRequest, reply: FastifyReply): FastifyReply => {
    // Validation
    const payload = request.body as { name: string, value: string };
    if (!payload.name || !payload.value || !payload.value.length || !payload.value.length) return reply.status(400).send("Invalid payload provided.");
    if (routes[payload.name]) return reply.status(409).send("Route already exists.");
    if (!isValidUrl(payload.value)) return reply.status(400).send("Invalid URL provided.");

    // Write
    routes[payload.name] = payload.value;
    writeFileSync(process.env.REST_DATA_LOCATION as string, JSON.stringify(routes, null, 4), {
        "encoding": "utf-8",
        "flag": "w"
    });
    return reply.send();
});

// Delete Route
fastify.delete("/d/:target", { preHandler: isAuthorized }, (request: FastifyRequest, reply: FastifyReply): FastifyReply => {
    // Validation
    const target = request.params as { target: string };
    if (!routes[target.target]) return reply.status(404).send("Route not found.");

    // Write
    delete routes[target.target];
    writeFileSync(process.env.REST_DATA_LOCATION as string, JSON.stringify(routes, null, 4), {
        "encoding": "utf-8",
        "flag": "w"
    });
    return reply.send();
});

// Catch All
fastify.get("*", (_request: FastifyRequest, reply: FastifyReply): FastifyReply => {
    return reply.send("SK Pivot API");
});
fastify.post("*", (_request: FastifyRequest, reply: FastifyReply): FastifyReply => {
    return reply.send("SK Pivot API");
});
fastify.delete("*", (_request: FastifyRequest, reply: FastifyReply): FastifyReply => {
    return reply.send("SK Pivot API");
});

// Start
fastify.listen({ port: parseInt(process.env.REST_PORT as string) })
    .then(() => {
        log(`Pivot API server listening on port ${process.env.REST_PORT}`, "info");
    }).catch((error) => {
        fastify.log.error(error);
        process.exit(1);
    });