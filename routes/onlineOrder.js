const onlineOrderRouter = require("express").Router()
const auth = require("../middlewares/auth")
const allowRoles = require("../middlewares/allowRoles")
const { updateOnlineOrderStatus } = require("../controllers/OnlineOrders")
onlineOrderRouter.patch(
  "/status/:id",
  auth,
  allowRoles("admin", "chef", "driver", "manager"),
  updateOnlineOrderStatus,
)
module.exports = onlineOrderRouter
