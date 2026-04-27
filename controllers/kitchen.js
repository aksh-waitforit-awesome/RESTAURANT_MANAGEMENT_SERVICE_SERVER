const SubOrder = require("../models/SubOrder")
const Order = require("../models/Order")
const asyncWrapper = require("../utils/asyncWrapper")

exports.getKitchenLiveFeed = asyncWrapper(async (req, res) => {
  // 1. Fetch Active Dining SubOrders
  // We only want items that aren't served and haven't been cancelled
  const subOrders = await SubOrder.find({
    allServed: false,
  }).populate("items.menuItem", "name category")

  // 2. Fetch Active Delivery/Takeaway Orders
  const orders = await Order.find({
    orderType: { $in: ["delivery", "takeaway", "parcel"] },
    orderStatus: { $in: ["placed", "preparing", "ready"] }, // Only show active kitchen tasks
    $or: [
      { paymentStatus: "paid" },
      { paymentStatus: "cod_pending", paymentMethod: "cod" }, // Fixed the typo: paymenStatus -> paymentStatus
    ],
  }).populate("items.menuItem", "name category")

  res.status(200).json({
    result: "success",
    data: { subOrders, orders },
  })
})
