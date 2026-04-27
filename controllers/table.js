const Table = require("../models/Table")
const asyncWrapper = require("../utils/asyncWrapper")

// 1. GET ALL TABLES
// Used when the React app loads to draw the initial floor plan
exports.getAllTables = async (req, res) => {
  try {
    const tables = await Table.find().sort({ tableNumber: 1 })
    res.status(200).json({
      success: true,
      count: tables.length,
      data: tables,
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

// 2. CREATE A SINGLE TABLE
// Used when the Admin clicks an "Add Table" button on the UI
exports.createTable = async (req, res) => {
  try {
    const { tableNumber, x, y, capacity, shape } = req.body

    // Check if table number already exists to avoid collisions
    const existingTable = await Table.findOne({ tableNumber })
    if (existingTable) {
      return res.status(400).json({
        success: false,
        message: `Table ${tableNumber} already exists!`,
      })
    }

    const newTable = await Table.create({
      tableNumber,
      x,
      y,
      capacity,
      shape,
    })

    res.status(201).json({ success: true, data: newTable })
  } catch (error) {
    res.status(400).json({ success: false, message: error.message })
  }
}
// 1. BULK UPDATE POSITIONS (The "Save Layout" Logic)
// This is the most efficient way to save the entire floor at once
exports.bulkUpdateTables = async (req, res) => {
  try {
    const { tables } = req.body

    if (!Array.isArray(tables)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid data format" })
    }

    // Create a list of operations for MongoDB bulkWrite
    const bulkOps = tables.map((table) => ({
      updateOne: {
        filter: { _id: table._id },
        update: {
          $set: {
            x: table.x,
            y: table.y,
          },
        },
      },
    }))

    const result = await Table.bulkWrite(bulkOps)

    res.status(200).json({
      success: true,
      message: `Successfully updated ${result.modifiedCount} tables`,
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

// 2. SINGLE TABLE UPDATE (Optional)
// Useful if you want to update a table's name or capacity later
exports.updateTable = async (req, res) => {
  try {
    const updatedTable = await Table.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true },
    )

    if (!updatedTable) {
      return res
        .status(404)
        .json({ success: false, message: "Table not found" })
    }

    res.status(200).json({ success: true, data: updatedTable })
  } catch (error) {
    res.status(400).json({ success: false, message: error.message })
  }
}

exports.getLiveTableStatus = asyncWrapper(async (req, res) => {
  const liveStatus = await Table.aggregate([
    {
      // 1. Join with only ACTIVE sessions
      $lookup: {
        from: "tablesessions",
        localField: "_id",
        foreignField: "table_id",
        as: "active_session",
        pipeline: [
          { $match: { status: "Active" } },
          // Only pull the ID and start time - nothing else is needed for the dashboard
          { $project: { _id: 1, started_at: 1 } },
        ],
      },
    },
    {
      // 2. Flatten and Format
      $addFields: {
        isOccupied: { $gt: [{ $size: "$active_session" }, 0] },
        currentSession: { $arrayElemAt: ["$active_session", 0] },
      },
    },
    {
      // 3. STRICT WHITELIST (Removes geometry, x, y, shapes, and metadata)
      $project: {
        _id: 1,
        tableNumber: 1,
        capacity: 1,
        isOccupied: 1,
        currentSession: 1,
      },
    },
    {
      // 4. Optional: Sort by table number so the grid stays consistent
      $sort: { tableNumber: 1 },
    },
  ])

  res.status(200).json({
    success: true,
    count: liveStatus.length,
    data: liveStatus,
  })
})
