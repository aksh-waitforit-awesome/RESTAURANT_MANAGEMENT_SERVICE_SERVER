const CustomError = require("./customError")
const { StatusCodes } = require("http-status-codes")
class ConflictError extends CustomError {
  constructor(message) {
    super(message, StatusCodes.CONFLICT)
  }
}

module.exports = ConflictError
