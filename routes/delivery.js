const router = require("express").Router()
const {
  getDeliveryDashboard,
  assignDriver,
  getMyDeliveries,
  completeOrder,
} = require("../controllers/delivery")
const allowRoles = require("../middlewares/allowRoles")
// GET DELIVERIES
router.route("/").get(getDeliveryDashboard)
router.route("/assign").patch(assignDriver)
router.get("/my-orders", allowRoles("delivery_guy"), getMyDeliveries)
router.patch("/complete", allowRoles("delivery_guy"), completeOrder)
module.exports = router
