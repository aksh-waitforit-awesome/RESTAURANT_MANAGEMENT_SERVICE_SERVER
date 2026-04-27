const express = require("express");
const router = express.Router();
const {
    getAllCategories,
    createCategory,
    updateCategory,
    changeStatus
} = require("../controllers/category");
const allowRoles = require("../middlewares/allowRoles")
const auth = require("../middlewares/auth")
// Root routes
router.route("/")
    .get(getAllCategories)
    .post(auth,allowRoles("admin","manager"),createCategory);

// ID specific routes
router.route("/:id")
    .put(auth,allowRoles("admin","manager"),updateCategory)
    
router.route("/:id/status").patch(auth,allowRoles("admin","manager"),changeStatus); // Optimized for simple status toggles

module.exports = router;