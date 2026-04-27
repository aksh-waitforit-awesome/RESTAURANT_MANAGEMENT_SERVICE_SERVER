const mongoose = require("mongoose")
const TableSessionSchema = new mongoose.Schema(
  {
    table_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Table",
      required: [true, "table_id is required"],
    },
    status: {
      type: String,
      enum: ["Active", "Closed"],
      default: "Active",
    },
    waiter_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "waiter_id is required"],
    },
    // Making the entire object required
    contactDetail: {
      type: {
        name: { type: String },
        phone_no: {
          type: String,
        },
        email: { type: String }, // Kept optional, but you can add required: true if needed
      },
    },
    // Timing fields
    started_at: {
      type: Date,
      default: Date.now, // Automatically sets the time when the session is created
    },
    ended_at: {
      type: Date,
      // This stays null until the session status changes to 'Closed'
    },
  },
  { timestamps: true },
)

module.exports = mongoose.model("TableSession", TableSessionSchema)
