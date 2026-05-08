const { Redis } = require("ioredis")

const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379"

// Production environments (like Heroku/Render) often require
// TLS (rediss://) and rejecting unauthorized certificates.
const options = redisUrl.startsWith("rediss://")
  ? { tls: { rejectUnauthorized: false } }
  : {}

const client = new Redis(redisUrl, options)

// Error handling is crucial to prevent the process from crashing
// if the Redis server goes down.
client.on("error", (err) => console.error("Redis Client Error", err))

// Optional: Test the connection asynchronously elsewhere,
// rather than blocking the module export.
// client.set("foo", "bar").then(() => console.log("Redis Initialized"));

module.exports = client
