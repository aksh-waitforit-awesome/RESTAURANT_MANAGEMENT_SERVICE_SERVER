const express = require("express")
const router = express.Router()
const auth = require("../middlewares/auth")
const allowRoles = require("../middlewares/allowRoles")
const { getKitchenLiveFeed } = require("../controllers/kitchen")
router
  .route("/live")
  .get(auth, allowRoles("chef", "waiter"), getKitchenLiveFeed)
module.exports = router
