// Import the entire module
const arcjetModule = require("@arcjet/node")

// Access the function from the 'default' property or the named export
const arcjet = arcjetModule.default || arcjetModule.arcjet
const tokenBucket = arcjetModule.tokenBucket
const shield = arcjetModule.shield

// Check if it's actually a function before calling it
if (typeof arcjet !== "function") {
  throw new Error(
    "Arcjet initialization failed: arcjet is not a function. Check your @arcjet/node version.",
  )
}

const aj = arcjet({
  key: process.env.ARCJET_KEY,
  characteristics: ["ip.src"], // Still using IP to protect shared demo accounts
  rules: [
    shield({ mode: "LIVE" }),
    tokenBucket({
      mode: "LIVE",
      refillRate: 5,
      interval: "24h",
      capacity: 5,
    }),
  ],
})

module.exports = aj
