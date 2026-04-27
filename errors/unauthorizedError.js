const CustomError = require("./customError");
const {StatusCodes} = require("http-status-codes")

class UnauthorizedError extends CustomError {
  constructor(message = "Unauthorized") {
    super(message, StatusCodes.UNAUTHORIZED);
  }
}

module.exports = UnauthorizedError;
