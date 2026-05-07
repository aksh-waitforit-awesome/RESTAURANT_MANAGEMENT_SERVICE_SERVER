// src/utils/arcjet.js
const arcjet = require("@arcjet/node");
const { tokenBucket } = require("@arcjet/node");

const aj = arcjet({
  key: process.env.ARCJET_KEY,
  // This tells Arcjet to track the rate limit for each individual IP
  characteristics: ["ip.src"], 
  rules: [
    tokenBucket({
      mode: "LIVE",
      refillRate: 5,    // Give them 5 new staff slots...
      interval: "24h", // ...every 24 hours
      capacity: 5,     // Max 5 creations total per day
    }),
  ],
});
module.exports = aj