const express = require("express")
const router = express.Router()
const {
  getAllTables,
  createTable,
  bulkUpdateTables,
  updateTable,
  getLiveTableStatus,
} = require("../controllers/table")

// Define the endpoints
router
  .route("/")
  .get(getAllTables) // GET  /api/tables
  .post(createTable) // POST /api/tables
// Bulk update route
router.route("/live").get(getLiveTableStatus)
router.route("/bulk-update").post(bulkUpdateTables)

// Individual ID route
router.route("/:id").patch(updateTable)
module.exports = router
