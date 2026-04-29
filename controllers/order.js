const { count } = require("console")
const Order = require("../models/Order")
const TableSession = require("../models/TableSession")
const NotFoundError = require("../errors/notFoundError")
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY)
const asyncWrapper = require("../utils/asyncWrapper")
/*exports.handleStripeWebhook = async (req, res) => {
  const sig = req.headers["stripe-signature"]
  let event
  console.log("Received Stripe Webhook:", req.body)
  try {
    // Verify the event came from Stripe
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.END_POINT_SECRET, // The whsec_... key from your terminal
    )
  } catch (err) {
    console.error(`Webhook Signature Verification Failed: ${err.message}`)
    return res.status(400).send(`Webhook Error: ${err.message}`)
  }

  // Handle the checkout.session.completed event
  if (event.type === "checkout.session.completed") {
    const session = event.data.object

    // Retrieve the orderId we saved in metadata during 'createOrder'
    const orderId = session.metadata.orderId

    try {
      // Update your MongoDB document
      const order = await Order.findById(orderId)
      if (order.orderType == "dinning") {
        order.paymentStatus = "paid"
        await order.save()
      } else if (
        order.orderType == "takeaway" &&
        order.orderStatus == "ready"
      ) {
        order.paymentStatus = "paid"
        order.orderStatus = "completed"
        await order.save()
      } else {
        order.paymentStatus = "paid"
        order.orderStatus = "preparing"
        await order.save()
        if (req.app.locals.newOnlineOrderPlaced) {
          req.app.locals.newOnlineOrderPlaced(order._id)
        }
      }

      console.log(`✅ Order ${order.orderNumber} updated to PAID.`)
    } catch (dbError) {
      console.error(`❌ Database Update Error: ${dbError.message}`)
      return res.status(500).send("Internal Server Error")
    }
  }

  // Return a 200 response to Stripe to acknowledge receipt
  res.json({ received: true })
} */
/*exports.handleStripeWebhook = async (req, res) => {
  const sig = req.headers["stripe-signature"]
  let event
  console.log("Received Stripe Webhook:", req.body)
  try {
    event = stripe.webhooks.constructEvent(
      req.body, // This is the raw buffer from express.raw
      sig,
      process.env.END_POINT_SECRET,
    )
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`)
  }

  // Acknowledge receipt to Stripe immediately
  res.json({ received: true })

  // Handle the logic AFTER sending the response
  if (event.type === "checkout.session.completed") {
    const session = event.data.object
    const orderId = session.metadata.orderId

    try {
      const order = await Order.findById(orderId)
      console.log(
        `Processing Order ID: ${orderId}, Current Status: ${order?.orderStatus}`,
      )
      if (!order) return

      // Your logic...
      if (order.orderType === "dinning") {
        order.paymentStatus = "paid"
      } else if (
        order.orderType === "takeaway" &&
        order.orderStatus === "ready"
      ) {
        order.paymentStatus = "paid"
        order.orderStatus = "completed"
      } else {
        console.log(`Updating Order ${order.orderNumber} to PAID and PREPARING`)
        order.paymentStatus = "paid"
        order.orderStatus = "preparing"

        // WebSocket trigger
        if (req.app.locals.newOnlineOrderPlaced) {
          req.app.locals.newOnlineOrderPlaced(order._id)
        }
      }
      await order.save()
    } catch (dbError) {
      console.error(`❌ DB Error: ${dbError.message}`)
    }
  }
}*/
exports.handleStripeWebhook = async (req, res) => {
  const sig = req.headers["stripe-signature"]
  let event

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.END_POINT_SECRET,
    )
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`)
  }

  res.json({ received: true })

  if (event.type === "checkout.session.completed") {
    const session = event.data.object
    const orderId = session.metadata.orderId

    try {
      const order = await Order.findById(orderId)
      if (!order || order.paymentStatus === "paid") return

      // --- SCENARIO 1: DINING ---
      // Customer is at the table, just paying the bill. Status stays "ready" or "completed".
      if (order.orderType === "dinning") {
        order.paymentStatus = "paid"
        // Note: We don't usually change orderStatus here because they are already eating.
      }

      // --- SCENARIO 2: TAKEAWAY (At the Counter) ---
      // Customer pays online AFTER the food is already "ready".
      else if (
        order.orderType === "takeaway" &&
        order.orderStatus === "ready"
      ) {
        order.paymentStatus = "paid"
        order.orderStatus = "completed" // Mark as finished since they are at the counter.
      }

      // --- SCENARIO 3 & 4: NEW ONLINE ORDER (Delivery/Takeaway) ---
      // Standard flow where payment happens BEFORE preparation starts.
      else {
        order.paymentStatus = "paid"
        order.orderStatus = "preparing"

        // Notify Kitchen via WebSocket only for NEW orders starting prep
        if (req.app.locals.newOnlineOrderPlaced) {
          req.app.locals.newOnlineOrderPlaced(order._id)
        }
      }

      await order.save()
      console.log(`✅ Order ${order.orderNumber} updated successfully.`)
    } catch (dbError) {
      console.error(`❌ DB Error: ${dbError.message}`)
    }
  }
}
exports.createOrder = async (req, res, next) => {
  try {
    const { customer, items, orderType, paymentMethod, totalAmount } = req.body
    // 1. Create the Order instance
    // Note: 'items' are already mapped in your Frontend (CheckoutPage)
    // but we ensure totalAmount is calculated via the pre-save hook.
    const newOrder = new Order({
      customer,
      items, // Expects: [{ menuItem, name, quantity, size }]
      orderType,
      paymentMethod,
      totalAmount,
      userId: req.user ? req.user.user_id : null,
      // If COD, we mark status as cod_pending immediately
      paymentStatus: paymentMethod === "cod" ? "cod_pending" : "pending",
    })

    // 2. This triggers the Pre-Save Hook in OrderSchema
    // This fetches DB prices, verifies them, and sets this.totalAmount
    await newOrder.save()

    // 3. Handle Stripe Payment
    if (paymentMethod === "card") {
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: newOrder.items.map((item) => ({
          price_data: {
            currency: "inr",
            product_data: {
              name: item.name,
              description: `Size: ${item.size || "Standard"}`,
            },
            // The pre-save hook populated item.price for us!
            unit_amount: Math.round(item.price * 100),
          },
          quantity: item.quantity,
        })),
        mode: "payment",
        // Crucial: Store the orderId so the Webhook can update the status later
        metadata: { orderId: newOrder._id.toString() },
        success_url: `${process.env.NODE_ENV === "production" ? process.env.CLIENT_URL : "http://localhost:5173"}/order-success/${newOrder._id}`,
        cancel_url: `${process.env.NODE_ENV === "production" ? process.env.CLIENT_URL : "http://localhost:5173"}/checkout`,
      })

      // Update order with Stripe Session ID for tracking
      newOrder.stripeSessionId = session.id
      await newOrder.save()

      res.json({ url: session.url })
    } else {
      // 4. Handle Cash on Delivery (COD)
      if (res?.app?.locals?.newOnlineOrderPlaced) {
        res.app.locals.newOnlineOrderPlaced(newOrder?._id)
      }
      res.json({
        success: true,
        orderId: newOrder._id,
        orderNumber: newOrder.orderNumber,
      })
    }
  } catch (error) {
    console.error("Order Creation Error:", error)
    res.status(500).json({ error: error.message })
  }
}

// Kitchen Controller: Optimized for Kitchen Display Systems (KDS)
exports.getKitchenOrders = async (req, res) => {
  try {
    const orders = await Order.find({
      // Kitchen only sees Paid orders or COD orders waiting for fulfillment
      $or: [
        { paymentStatus: "paid" },
        { paymentStatus: "cod_pending", paymentMethod: "cod" },
      ],
      // Only show orders that haven't been delivered or cancelled yet
      orderStatus: { $in: ["placed", "preparing", "ready"] },
    }).sort({ createdAt: 1 }) // Oldest first (FIFO)

    res.json(orders)
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

exports.updateOrderStatusFromKitchen = async (req, res) => {
  try {
    const { orderId } = req.params

    // 1. Find the order first to check its current status
    const order = await Order.findById(orderId)

    if (!order) {
      return res.status(404).json({ message: "Order not found" })
    }

    let nextStatus = ""

    // 2. Strict Workflow Logic
    if (order.orderStatus === "placed") {
      nextStatus = "preparing"
    } else if (order.orderStatus === "preparing") {
      nextStatus = "ready"
    } else {
      // 3. Block updates for "ready", "delivered", or "cancelled"
      return res.status(400).json({
        message: `Cannot update status from '${order.orderStatus}'. Workflow has ended or is invalid.`,
      })
    }

    // 4. Update and return the new order
    order.orderStatus = nextStatus
    await order.save()
    if (res?.app?.locals?.orderStatusUpdated) {
      res?.app?.locals?.orderStatusUpdated({
        userId: order.userId,
        orderId: order._id,
        orderStatus: order.orderStatus,
      })
    }
    res.status(200).json(order)
  } catch (error) {
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message })
  }
}
exports.getDeliveryDashboard = asyncWrapper(async (req, res) => {
  // 1. Get all orders waiting for a driver
  const pendingOrders = await Order.find({
    orderType: "delivery",
    orderStatus: "ready",
    deliveryGuyId: null, // Not yet assigned
  })

  // 2. Get all delivery guys who are currently "isAvailable"
  const availableDrivers = await User.find({
    role: "delivery_guy",
    isAvailable: true,
    isActive: true,
  }).select("username email")

  res.status(200).json({
    ordersCount: pendingOrders.length,
    driversCount: availableDrivers.length,
    pendingOrders,
    availableDrivers,
  })
})

exports.sendOrderToKitchen = asyncWrapper(async (req, res) => {
  const { user_id: waiter_id } = req.user
  const { items, tableSession_id, orderType } = req.body
  console.log(req.body)
  // 1. Verify Session exists and is active
  const session = await TableSession.findById(tableSession_id) // Fixed: used tableSession_id
  console.log(session)
  if (!session) {
    return res.status(404).json({ message: "Table session not found" })
  }

  if (session.status === "Closed") {
    return res
      .status(400)
      .json({ message: "Session is closed. Cannot place new orders." })
  }

  // 2. Create Order
  // Note: For dining-in, customer info is often blank initially or tied to the session
  const order = await Order.create({
    waiter_id,
    items,
    tableSession_id,
    orderType: "dinning",
    paymentMethod: "yet_to_decide",
    paymentStatus: "pending",
  })

  res.status(201).json({ order, result: "Success" }) // Fixed: result string
})

// Billing System: Get all dinning pending bills
exports.getUnsettledDinningOrders = asyncWrapper(async (req, res) => {
  const unsettledDinningOrders = await Order.find({
    orderType: "dinning",
    paymentStatus: "pending",
  })

  res.status(200).json(unsettledDinningOrders)
})

exports.getOrderById = asyncWrapper(async (req, res) => {
  const { id } = req.params
  const order = await Order.findById(id)
  console.log(order)
  if (!order) {
    return res.status(404).json({ message: "Order not found" })
  }
  res.status(200).json(order)
})
//  settle Dinning Order
exports.settleDinningOrder = asyncWrapper(async (req, res) => {
  const { id, paymentMethod } = req.body

  // 1. Find the order first
  const order = await Order.findById(id)
  if (!order) {
    throw new NotFoundError(`Order: ${id} not found`)
  }

  // 2. Handle Cash Payment (Instant Settle)
  if (paymentMethod === "cod") {
    order.paymentMethod = "cod"
    order.paymentStatus = "paid"
    order.orderStatus = "completed" // Dining orders usually complete upon payment
    await order.save()

    return res.status(200).json({
      success: true,
      message: "Order settled with Cash",
      order,
    })
  }

  // 3. Handle Stripe/Card Payment
  if (paymentMethod === "card") {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: order.items.map((item) => ({
        price_data: {
          currency: "inr",
          product_data: { name: item.name },
          unit_amount: Math.round(item.price * 100),
        },
        quantity: item.quantity,
      })),
      mode: "payment",
      metadata: { orderId: order._id.toString() },
      success_url: `${process.env.NODE_ENV === "production" ? process.env.ADMIN_URL : "http://localhost:5174"}/order/${order._id}`,
      cancel_url: `${process.env.NODE_ENV === "production" ? process.env.ADMIN_URL : "http://localhost:5174"}`,
    })

    order.stripeSessionId = session.id
    order.paymentMethod = "card"
    await order.save()

    return res.json({ url: session.url })
  }

  res.status(400).json({ error: "Invalid payment method" })
})

// get Customer Orders
exports.getCustomerOrders = asyncWrapper(async (req, res) => {
  const { user_id } = req.user
  const orders = await Order.find({ userId: user_id }).sort({ createdAt: -1 })
  res.status(200).json(orders)
})

// backend/controllers/order.js
exports.getAdminDashboardStats = async (req, res) => {
  try {
    const stats = await Order.aggregate([
      {
        $facet: {
          // 1. Overall Totals
          summary: [
            {
              $group: {
                _id: null,
                totalRevenue: { $sum: "$totalAmount" },
                totalOrders: { $sum: 1 },
                avgOrderValue: { $avg: "$totalAmount" },
              },
            },
          ],
          // 2. Revenue by Order Type (Dining vs Delivery vs Takeaway)
          typeDistribution: [
            {
              $group: {
                _id: "$orderType",
                count: { $sum: 1 },
                revenue: { $sum: "$totalAmount" },
              },
            },
          ],
          // 3. Current Status Pipeline
          statusCounts: [
            {
              $group: {
                _id: "$orderStatus",
                count: { $sum: 1 },
              },
            },
          ],
          // 4. Latest 8 Orders for the table
          recentOrders: [{ $sort: { createdAt: -1 } }, { $limit: 8 }],
        },
      },
    ])

    res.status(200).json({
      summary: stats[0].summary[0] || { totalRevenue: 0, totalOrders: 0 },
      types: stats[0].typeDistribution,
      statuses: stats[0].statusCounts,
      recentOrders: stats[0].recentOrders,
    })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}
exports.getUnsettledTakeawayOrder = asyncWrapper(async (req, res) => {
  const takeawayOrders = await Order.find({
    orderType: "takeaway",
    orderStatus: "ready",
  })
  res
    .status(200)
    .json({ success: true, takeawayOrders, count: takeawayOrders.length })
})
exports.pickupTakeAwayOrder = asyncWrapper(async (req, res) => {
  const { orderId } = req.params
  const { paymentMethod } = req.body
  const order = await Order.findById(orderId)
  if (!order) throw new NotFoundError(`Order with id ${orderId} not found`)
  if (order.paymentStatus === "paid") {
    order.orderStatus = "completed"
    await order.save()
    return res
      .status(200)
      .json({ success: true, message: "Order marked as completed" })
  }
  if (paymentMethod == "cod") {
    order.paymentMethod = "cod"
    order.paymentStatus = "paid"
    order.orderStatus = "completed"
    await order.save()
    return res
      .status(200)
      .json({ success: true, message: "Order marked as completed with COD" })
  }
  if (paymentMethod == "card") {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: order.items.map((item) => ({
        price_data: {
          currency: "inr",
          product_data: { name: item.name },
          unit_amount: Math.round(item.price * 100),
        },
        quantity: item.quantity,
      })),
      mode: "payment",
      metadata: { orderId: order._id.toString() },
      success_url: `${process.env.NODE_ENV === "production" ? process.env.ADMIN_URL : "http://localhost:5174"}/order/${order._id}`,
      cancel_url: `${process.env.NODE_ENV === "production" ? process.env.ADMIN_URL : "http://localhost:5174"}`,
    })

    order.stripeSessionId = session.id
    order.paymentMethod = "card"
    await order.save()

    return res.json({ url: session.url })
  }

  res.status(400).json({ error: "Invalid payment method" })
})

/* 

*/
