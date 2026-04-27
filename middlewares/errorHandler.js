const { StatusCodes } = require("http-status-codes")
const CustomError = require("../errors/customError")

const errorHandler = (err, req, res, next) => {
  console.log("Error Handler Invoked", err)
  console.log(err)
  if (err instanceof CustomError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
    })
  }

  // MongoDB duplicate key
  if (err.code === 11000) {
    return res.status(StatusCodes.CONFLICT).json({
      success: false,
      message: "Duplicate field value entered",
    })
  }

  // Validation error
  if (err.name === "ValidationError") {
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: Object.values(err.errors)
        .map((e) => e.message)
        .join(", "),
    })
  }
  if (err.name === "TokenExpiredError") {
    return res.status(StatusCodes.UNAUTHORIZED).json({
      success: false,
      message: "Token has expired",
    })
  }

  return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
    success: false,
    message: "Something went wrong",
  })
}

module.exports = errorHandler
