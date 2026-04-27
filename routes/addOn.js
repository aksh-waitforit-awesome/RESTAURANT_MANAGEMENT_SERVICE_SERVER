const router = require("express").Router()
const {getAllAddOn,createAddOn,updateAddOn,changeStatus} = require("../controllers/addOn")
const allowRoles = require("../middlewares/allowRoles")
const auth = require("../middlewares/auth")
router.route("/").get(getAllAddOn).post(auth,allowRoles("admin","manager"),createAddOn)
router.route("/:id").put(auth,allowRoles("admin","manager"),updateAddOn)
router.route("/:id/status").patch(auth,allowRoles("admin","manager"),changeStatus)
module.exports = router