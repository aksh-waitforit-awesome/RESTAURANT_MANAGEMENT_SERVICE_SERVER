const SubOrder = require("../models/SubOrder")
const Order = require("../models/Order")
const TableSession = require("../models/TableSession")
const asyncWrapper = require("../utils/asyncWrapper")
const BadRequestError = require("../errors/badRequestError")
const NotFoundError = require("../errors/notFoundError")
const ConflictError = require("../errors/conflictError")
// 1. Create a SubOrder (New Round of Items)
exports.createSubOrder = async (req, res) => {
  try {
    const { user_id: waiter_id } = req.user
    const { tableSession_id, items } = req.body
    const tableSession = await TableSession.findById(tableSession_id).populate(
      "table_id",
      "tableNumber",
    )
    if (!tableSession) {
      return res.status(404).json({ message: "Table session not found" })
    }
    // Create the SubOrder (Pre-save hook handles pricing)
    const newSubOrder = new SubOrder({
      tableSession_id,
      tableNumber: tableSession.table_id.tableNumber, // Store table number for easy access
      waiter_id,
      items,
    })

    await newSubOrder.save()
    if (res.app.locals.waiterSendOrderToKitchen) {
      res.app.locals.waiterSendOrderToKitchen(newSubOrder)
    }
    console.log("New SubOrder created:", newSubOrder)
    res.status(201).json({ success: true, data: newSubOrder })
  } catch (error) {
    console.log(error)
    res.status(400).json({ success: false, message: error.message })
  }
}

exports.updateItemsStatus = async (req, res) => {
  try {
    const { subOrderId } = req.params
    const { itemIds, newStatus } = req.body // itemIds: ["id1", "id2"], newStatus: "preparing"
    console.log("req body", req.body)
    // 1. Find the document
    const subOrder = await SubOrder.findById(subOrderId)
    if (!subOrder)
      return res.status(404).json({ message: "Sub-order not found" })
    // check it its array of items
    const itemIdsArray = Array.isArray(itemIds) ? itemIds : [itemIds]
    // 2. Update status of specific items in the array
    subOrder.items.forEach((item) => {
      if (itemIdsArray.includes(item._id.toString())) {
        item.itemStatus = newStatus
      }
    })

    // 3. Save triggers the pre-save hook (updates allServed and subTotal)
    await subOrder.save()

    // 4. Real-time Trigger (If using Socket.io)
    // req.io.emit("status-changed", { subOrderId, itemIds, newStatus, allServed: subOrder.allServed });
    if (res.app.locals.SubOrderStatusUpdated) {
      res.app.locals.SubOrderStatusUpdated(subOrder, newStatus, itemIdsArray)
    }
    res.status(200).json({
      success: true,
      allServed: subOrder.allServed,
      data: subOrder,
    })
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error updating status", error: error.message })
  }
}
// 3. Get all SubOrders for a specific Table Session (The "Tokens" list)
exports.getSessionSubOrders = async (req, res) => {
  try {
    const { sessionId } = req.params
    const subOrders = await SubOrder.find({ tableSession_id: sessionId })
      .populate("waiter_id", "username")
      .sort({ createdAt: 1 })

    res.status(200).json({ success: true,  subOrders })
  } catch (error) {
    res.status(400).json({ success: false, message: error.message })
  }
}
