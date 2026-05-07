// RIGHT: Destructure the arcjet function
const { arcjet, tokenBucket, shield } = require("@arcjet/node");

const aj = arcjet({
  key: process.env.ARCJET_KEY,
  characteristics: ["ip.src"], // This solves your shared demo ID problem!
  rules: [
    shield({ mode: "LIVE" }),
    tokenBucket({
      mode: "LIVE",
      refillRate: 5,
      interval: "24h",
      capacity: 5,
    }),
  ],
});
console.log(aj)
module.exports = aj;