const { Queue } = require("bullmq")
const redisConnection = require("./config/redis")
const cleanupQueue = new Queue("demo-cleanup", { connection: redisConnection })
module.exports = cleanupQueue
