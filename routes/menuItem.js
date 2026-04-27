const {
  getMenuItems,
  createMenuItem,
  updateMenuItem,
  toggleAvailability,
} = require("../controllers/menuItem")
const allowRoles = require("../middlewares/allowRoles")
const auth = require("../middlewares/auth")
const router = require("express").Router()
const MenuItem = require("../models/MenuItem")
// Public: Anyone can see the menu
router.get("/", getMenuItems)
// Protected: Only Admin/Manager can create or full-edit
router.post("/", auth, allowRoles("admin", "manager"), createMenuItem)
router.put("/:id", auth, allowRoles("admin", "manager"), updateMenuItem)

// Protected: Kitchen staff can also mark items as out-of-stock
// Changed to PATCH as it's a partial update
router.patch(
  "/:id/available",
  auth,
  allowRoles("admin", "manager", "kitchen"),
  toggleAvailability,
)

module.exports = router
