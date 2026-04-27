const Order = require("../models/Order")
const asyncWrapper = require("../utils/asyncWrapper")
const NotFoundError = require("../errors/notFoundError")
const BadRequestError = require("../errors/badRequestError")
exports.updateOnlineOrderStatus = asyncWrapper(async (req, res, next) => {
  const { id: orderId } = req.params
  const { orderStatus } = req.body

  if (!orderStatus)
    throw new BadRequestError("Please provide an updated status")

  const order = await Order.findById(orderId)
  if (!order) throw new NotFoundError("Order not found")

  if (order.orderType === "dinning") {
    throw new BadRequestError("We only handle online orders from here")
  }

  order.orderStatus = orderStatus
  await order.save()

  // FIX: Access via app.locals (plural)
  if (req.app.locals.orderStatusUpdated) {
    // Pass the actual userId saved in the order
    req.app.locals.orderStatusUpdated(order.userId, orderId, orderStatus)
  }

  res.status(200).json({ order })
})
