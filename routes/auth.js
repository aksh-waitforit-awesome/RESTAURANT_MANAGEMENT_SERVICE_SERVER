const express = require("express")
const router = express.Router()
const authController = require("../controllers/auth")
const auth = require("../middlewares/auth")
const User = require("../models/User")
const asyncWrapper = require("../utils/asyncWrapper")
const allowRoles = require("../middlewares/allowRoles")
// Customer self-register
router.post("/register", authController.register)
// create admin
router.post("/admin", authController.createAdmin)
router.post("/admin/demo", authController.createDemoAdmin)
// Login
router.post("/login", authController.login)
// Logout
router.post("/logout", authController.logout)
// Refresh
router.get("/refresh", authController.refresh)
router.get("/staff", authController.getStaff)
router.get(
  "/waiter",
  asyncWrapper(async (req, res) => {
    const waiters = await User.find({ role: "waiter" })
    res.status(200).json({ success: true, waiters })
  }),
)
// Add manager (admin only) or staff (admin/manager)
router.post(
  "/staff/add",
  auth,
  allowRoles("admin", "manager"),
  authController.addUser,
)

module.exports = router
