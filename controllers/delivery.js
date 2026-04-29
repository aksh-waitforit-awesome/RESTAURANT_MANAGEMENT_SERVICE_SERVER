const User = require("../models/User")
const Order = require("../models/Order")
const asyncWrapper = require("../utils/asyncWrapper")
const mongoose = require("mongoose")
exports.getDeliveryDashboard = asyncWrapper(async (req, res) => {
  const [pendingDeliveries, ongoingDeliveries, availableDrivers] =
    await Promise.all([
      // 1. Orders ready but not yet picked up
      Order.find({
        orderType: "delivery",
        orderStatus: "ready",
      }).select("orderNumber customer totalAmount createdAt"),

      // 2. Orders currently in transit
      // Note: This assumes you added a 'deliveryGuy' ref to your Order Schema
      Order.find({
        orderType: "delivery",
        orderStatus: "out_for_delivery",
      }).populate("deliveryGuy", "username email"),

      // 3. Drivers who are clocked in and ready for a new task
      User.find({
        role: "delivery_guy",
        isAvailable: true,
        isActive: true,
      }).select("username email"),
    ])

  res.status(200).json({
    success: true,
    stats: {
      totalPending: pendingDeliveries.length,
      totalOngoing: ongoingDeliveries.length,
      totalAvailableDrivers: availableDrivers.length,
    },
    data: {
      pendingDeliveries,
      ongoingDeliveries,
      availableDrivers,
    },
  })
})
exports.assignDriver = asyncWrapper(async (req, res) => {
  const { orderId, driverId } = req.body
  console.log(req.body)
  if (!orderId || !driverId) {
    return res
      .status(400)
      .json({ message: "Order ID and Driver ID are required" })
  }

  // 1. Start a Session for the transaction
  const session = await mongoose.startSession()
  session.startTransaction()

  try {
    // 2. Find and update the Order
    // We check for orderStatus: "ready" to prevent double-assignment
    const order = await Order.findOneAndUpdate(
      { _id: orderId, orderStatus: "ready" },
      {
        orderStatus: "out_for_delivery",
        deliveryGuy: driverId,
      },
      { new: true, session },
    )

    if (!order) {
      throw new Error("Order not found or is no longer ready for assignment.")
    }

    // 3. Find and update the Driver
    // We check for isAvailable: true to prevent assigning a busy driver
    const driver = await User.findOneAndUpdate(
      { _id: driverId, role: "delivery_guy", isAvailable: true },
      { isAvailable: false },
      { new: true, session },
    )

    if (!driver) {
      throw new Error("Driver is no longer available.")
    }

    // 4. Commit changes
    await session.commitTransaction()

    if (res?.app?.locals?.orderStatusUpdated) {
      console.log("order out for delivery")
      res?.app?.locals?.orderStatusUpdated({
        userId: order.userId,
        orderId: order._id,
        orderStatus: order.orderStatus,
      })
    }

    res.status(200).json({
      success: true,
      message: `Order #${order.orderNumber} assigned to ${driver.username}`,
      order,
    })
  } catch (error) {
    // 5. If anything fails, abort the transaction and undo changes
    await session.abortTransaction()
    res.status(400).json({ success: false, message: error.message })
  } finally {
    session.endSession()
  }
})
// 1. Get deliveries assigned to the logged-in driver
exports.getMyDeliveries = asyncWrapper(async (req, res) => {
  const driverId = req.user.user_id // Extract from auth middleware

  const myOrders = await Order.find({
    deliveryGuy: driverId,
    orderStatus: "out_for_delivery", // Only show active deliveries
  }).sort("-createdAt")

  res.status(200).json({
    success: true,
    count: myOrders.length,
    data: myOrders,
  })
})

// 2. Mark order as completed and free up the driver
exports.completeOrder = asyncWrapper(async (req, res) => {
  const { orderId } = req.body
  const driverId = req.user.user_id

  const session = await mongoose.startSession()
  session.startTransaction()

  try {
    // 1. Update Order status to completed
    const order = await Order.findOneAndUpdate(
      { _id: orderId, deliveryGuy: driverId, orderStatus: "out_for_delivery" },
      { orderStatus: "completed" },
      { new: true, session },
    )

    if (!order) {
      throw new Error("Order not found or not assigned to you.")
    }

    // 2. Set driver back to available
    await User.findByIdAndUpdate(driverId, { isAvailable: true }, { session })

    await session.commitTransaction()
    if (res?.app?.locals?.orderStatusUpdated) {
      console.log("delivery completed")
      res?.app?.locals?.orderStatusUpdated({
        userId: order.userId,
        orderId: order._id,
        orderStatus: order.orderStatus,
      })
    }
    res.status(200).json({
      success: true,
      message: "Delivery completed! You are now available for new orders.",
    })
  } catch (error) {
    await session.abortTransaction()
    res.status(400).json({ success: false, message: error.message })
  } finally {
    session.endSession()
  }
})
