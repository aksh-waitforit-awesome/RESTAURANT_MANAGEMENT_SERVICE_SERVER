const jwt = require("jsonwebtoken")
const UnauthorizedError = require("../errors/unauthorizedError")

const auth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new UnauthorizedError("Authorization token missing")
    }

    const token = authHeader.split(" ")[1]

    const payload = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET)

    req.user = payload
    next()
  } catch (error) {
    console.log(error.name)
    next(error)
  }
}

module.exports = auth
