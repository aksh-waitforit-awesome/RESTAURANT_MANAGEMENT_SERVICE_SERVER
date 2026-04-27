const mongoose = require("mongoose")

const OrderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      // Increased range for order numbers to avoid frequent collisions
      default: () => Math.floor(100000 + Math.random() * 900000).toString(),
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    deliveryGuy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    waiter_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    tableSession_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TableSession",
      default: null,
    },
    customer: {
      name: { type: String },
      phone: { type: String },
      address: { type: String },
    },
    items: [
      {
        // Renamed to menuItemID to match your frontend logic if preferred,
        // but 'menuItem' is standard for refs.
        menuItem: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "MenuItem",
          required: true,
        },
        name: String,
        quantity: { type: Number, required: true, min: 1 },
        size: { type: String, default: "base" }, // Matches 'base', '500gm', etc.
        price: Number, // This will be populated/vetted by the pre-save hook
      },
    ],
    orderType: {
      type: String,
      enum: ["delivery", "takeaway", "parcel", "dinning"],
      required: true,
    },
    paymentMethod: {
      type: String,
      enum: ["card", "cod", "yet_to_decide"],
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "cod_pending"],
      default: "pending",
    },
    orderStatus: {
      type: String,
      enum: [
        "placed",
        "preparing",
        "ready",
        "completed",
        "cancelled",
        "out_for_delivery",
      ],
      default: "placed",
    },
    totalAmount: { type: Number, required: true },
    stripeSessionId: String,
    isKOTPrinted: { type: Boolean, default: false },
  },
  { timestamps: true },
)

// Remove 'next' from the arguments
OrderSchema.pre("save", async function () {
  if (!this.isModified("items")) return // Simply return instead of next()

  try {
    let grandTotal = 0
    const MenuItem = this.constructor.model("MenuItem")

    for (let item of this.items) {
      const product = await MenuItem.findById(item.menuItem)

      if (!product) {
        throw new Error(`Menu item ${item.name} not found.`)
      }

      let unitPrice = 0
      if (product.hasSizes && item.size && item.size !== "base") {
        const sizeData = product.sizes.find((s) => s.sizeName === item.size)
        unitPrice = sizeData ? sizeData.price : product.basePrice
      } else {
        unitPrice = product.basePrice
      }

      item.price = unitPrice
      grandTotal += unitPrice * item.quantity
    }

    this.totalAmount = Math.round(grandTotal)
    // No next() call here
  } catch (error) {
    // Re-throw the error; Mongoose handles it as a validation error
    throw error
  }
})
module.exports = mongoose.model("Order", OrderSchema)
