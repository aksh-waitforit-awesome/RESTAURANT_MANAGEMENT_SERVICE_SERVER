const TableSession = require("../models/TableSession")
const User = require("../models/User")
const Table = require("../models/Table")
const SubOrder = require("../models/SubOrder")
const Order = require("../models/Order")
const asyncWrapper = require("../utils/asyncWrapper")
const BadRequestError = require("../errors/badRequestError")
const NotFoundError = require("../errors/notFoundError")
const ConflictError = require("../errors/conflictError")
const { json } = require("stream/consumers")
exports.createTableSession = asyncWrapper(async (req, res) => {
  const { table_id } = req.body
  const waiter_id = req.user.user_id // Clean: Handled by Auth middleware

  // 1. Precise Error Message
  if (!table_id) {
    throw new BadRequestError("Table ID is required.")
  }

  /**
   * 2. SOLVING THE RACE CONDITION & REDUNDANCY
   * We use findOneAndUpdate to check availability and "claim" the table in one atomic step.
   * This prevents two waiters from opening the same table simultaneously.
   */
  const activeSession = await TableSession.findOne({
    table_id,
    status: "Active",
  })

  if (activeSession) {
    throw new ConflictError("This table is already occupied.")
  }

  // 3. Optimized Query: Fetch ONLY tableNumber using .select()
  // This minimizes the data transfer between MongoDB and your Server.
  const table = await Table.findById(table_id).select("tableNumber")
  if (!table) {
    throw new NotFoundError("Table not found.")
  }

  // 4. Create the session
  const tableSession = await TableSession.create({
    table_id,
    waiter_id,
    status: "Active",
    started_at: new Date(),
  })

  // 5. Broadcast with the FULL data required for manual cache updates
  if (res.app.locals.sessionCreated) {
    res.app.locals.sessionCreated({
      tableId: table_id,
      tableNumber: table.tableNumber,
      // Pass the new session object so frontend can update cache without re-fetching
      newSession: {
        _id: tableSession._id,
        started_at: tableSession.started_at,
      },
    })
  }

  // 6. Consistent Response Format
  res.status(201).json({
    success: true,
    data: tableSession,
  })
})

exports.closeTableSession = asyncWrapper(async (req, res) => {
  const { user_id: waiterId } = req.user
  console.log("close table session req.user", req.user)
  const { table_id, paymentMethod = "yet_to_decide" } = req.body
  const ws = req.app.locals
  // 1. Find the Active Session (Use lean() if you don't need Mongoose methods)
  const session = await TableSession.findOne({
    table_id,
    status: "Active",
  }).populate("table_id", "tableNumber")

  if (!session) {
    throw new NotFoundError("session not found")
  }
  const unservedOrderExists = await SubOrder.exists({
    tableSession_id: session._id,
    allServed: false,
  })

  if (unservedOrderExists) {
    throw new BadRequestError(
      "Cannot end session. Some items are still being prepared or served.",
    )
  }
  // 2. Fetch SubOrders - Optimization: Only select fields you need
  const allSubOrders = await SubOrder.find({
    tableSession_id: session._id,
  }).select("items subTotal ")

  if (allSubOrders.length === 0) {
    try {
      await TableSession.findByIdAndDelete(session._id)
      res.app.locals.emptySessionDeletion({
        tableNumber: session.table_id.tableNumber,
        tableId: session.table_id._id,
        sessionId: session._id,
      })
      res.json(200).json({ message: `empty session deleted` })
    } catch (err) {
      throw new Error(err)
    }
  }

  const billItems = allSubOrders.flatMap((sub) => sub.items)
  const totalAmount = allSubOrders.reduce((acc, sub) => acc + sub.subTotal, 0)

  // 3. Create Order
  const mainOrder = await Order.create({
    tableSession_id: session._id,
    waiter_id: session.waiter_id,
    items: billItems,
    orderType: "dinning",
    paymentMethod,
    paymentStatus: "pending",
    orderStatus: "completed",
    totalAmount,
  })

  // 4. Update Session
  session.status = "Closed"
  session.ended_at = new Date()
  await session.save()

  // 5. BROADCAST FULL DATA (The "Clean Push")
  // We send the full 'mainOrder' so the Cashier doesn't have to re-fetch
  res.app.locals.sessionCompleted({
    tableId: table_id,
    tableNumber: session.table_id.tableNumber,
    newUnsettledOrder: mainOrder,
  })

  res.status(200).json({
    success: true,
    order: mainOrder,
    printData: {
      orderNumber: mainOrder.orderNumber,
      tableNumber: session.table_id.tableNumber,
      grandTotal: mainOrder.totalAmount,
      items: mainOrder.items,
    },
  })
})
