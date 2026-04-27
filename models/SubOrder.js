const mongoose = require("mongoose")

const SubOrderSchema = new mongoose.Schema(
  {
    tableSession_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TableSession",
      required: true,
    },
    tableNumber: {
      type: String,
      required: true,
    },
    waiter_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    items: [
      {
        menuItem: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "MenuItem",
          required: true,
        },
        name: String,
        quantity: { type: Number, required: true, min: 1 },
        size: { type: String, default: "base" },
        price: Number,
        itemStatus: {
          type: String,
          enum: ["placed", "preparing", "ready_to_serve", "served"],
          default: "placed",
        },
        notes: { type: String, default: "" },
      },
    ],
    subTotal: { type: Number, default: 0 },
    allServed: { type: Boolean, default: false }, // New Boolean Tracker
  },
  { timestamps: true },
)

// --- AUTOMATION HOOK ---
// --- CORRECTED AUTOMATION HOOK ---
SubOrderSchema.pre("save", async function () {
  // 1. Logic remains the same
  if (this.items && this.items.length > 0) {
    // Auto-calculate subTotal
    this.subTotal = this.items.reduce(
      (acc, item) => acc + item.price * item.quantity,
      0,
    )

    // Auto-check if everything is served
    this.allServed = this.items.every((item) => item.itemStatus === "served")
  } else {
    this.allServed = false
  }

  // 2. REMOVE next() call. Since it's async (or just returning),
  // Mongoose knows when you are done.
})

module.exports = mongoose.model("SubOrder", SubOrderSchema)
