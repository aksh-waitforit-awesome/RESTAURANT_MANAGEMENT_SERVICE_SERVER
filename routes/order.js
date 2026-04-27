const express = require("express")
const router = express.Router()
const {
  createOrder,
  updateOrderStatusFromKitchen,
  sendOrderToKitchen,
  getUnsettledDinningOrders,
  getOrderById,
  getCustomerOrders,
  settleDinningOrder,
  getAdminDashboardStats,
  getUnsettledTakeawayOrder,
  pickupTakeAwayOrder,
} = require("../controllers/order")

const allowRoles = require("../middlewares/allowRoles")
const auth = require("../middlewares/auth")
const NotFoundError = require("../errors/notFoundError")
// Frontend calls this to place order
router.get(
  "/dinning/unsettled-orders",
  auth,
  allowRoles("admin", "cashier", "manager"),
  getUnsettledDinningOrders,
)
router.get(
  "/takeaway/unsettled",
  auth,
  allowRoles("admin", "manager", "cashier"),
  getUnsettledTakeawayOrder,
)
router.get("/admin/dashboard", getAdminDashboardStats)
router.get("/customer/orders", auth, getCustomerOrders)
router.get("/:id", auth, getOrderById)
router.post("/checkout", auth, createOrder)
router.post(
  "/settle-dining",
  auth,
  allowRoles("admin", "cashier"),
  settleDinningOrder,
)
router.post(
  "/takeaway/pickup/:orderId",
  auth,
  allowRoles("admin", "cashier", "manager"),
  pickupTakeAwayOrder,
)
router.patch(
  "/:orderId/status",
  auth,
  allowRoles("chef"),
  updateOrderStatusFromKitchen,
)
router.post("/send", auth, allowRoles("waiter"), sendOrderToKitchen)

module.exports = router
