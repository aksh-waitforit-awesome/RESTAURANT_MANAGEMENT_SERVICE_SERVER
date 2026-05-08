// utils/arcjet.js
let aj = null

/**
 * Singleton getter for Arcjet instance.
 * Handles the dynamic import of the ESM @arcjet/node module.
 */
async function getArcjet() {
  if (aj) return aj

  try {
    // Dynamic import required for ESM modules in CommonJS
    const {
      default: arcjet,
      tokenBucket,
      shield,
    } = await import("@arcjet/node")

    aj = arcjet({
      key: process.env.ARCJET_KEY,
      characteristics: ["ip.src"],
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

    return aj
  } catch (error) {
    console.error("Failed to initialize Arcjet:", error)
    throw error
  }
}

module.exports = getArcjet
