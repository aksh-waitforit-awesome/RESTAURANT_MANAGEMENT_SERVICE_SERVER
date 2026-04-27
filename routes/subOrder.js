const express = require("express")
const router = express.Router()
const subOrderController = require("../controllers/subOrder")
const auth = require("../middlewares/auth")
const allowRoles = require("../middlewares/allowRoles")
// Create a new "round" (Token)
router.post("/", auth, allowRoles("waiter"), subOrderController.createSubOrder)

// Get all rounds for a specific table
router.get("/session/:sessionId", subOrderController.getSessionSubOrders)

// Update status of one or more specific dish (e.g., mark as 'served')
router.patch(
  "/:subOrderId/items/status",
  auth,
  allowRoles("waiter", "chef"),
  subOrderController.updateItemsStatus,
)

module.exports = router
