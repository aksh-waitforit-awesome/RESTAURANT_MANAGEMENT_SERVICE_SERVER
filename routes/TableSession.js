const {
  closeTableSession,
  createTableSession,
  deleteEmptyTableSession,
} = require("../controllers/TableSession")
const allowRoles = require("../middlewares/allowRoles")
const auth = require("../middlewares/auth")
const router = require("express").Router()
router.route("/start").post(auth, allowRoles("waiter"), createTableSession)
router.route("/end").patch(auth, allowRoles("waiter"), closeTableSession)

module.exports = router
