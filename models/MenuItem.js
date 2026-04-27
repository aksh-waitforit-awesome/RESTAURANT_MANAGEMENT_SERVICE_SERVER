const mongoose = require("mongoose")
const MenuItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    image: {
      type: String,
    },
    // Base Price (Used if hasSizes is false)
    basePrice: {
      type: Number,
      required: function () {
        return !this.hasSizes
      },
    },

    // Reference to the Category Model
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },

    // --- Add-Ons as References ---
    addOns: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "AddOn",
      },
    ],

    // --- Dynamic Sizing Logic ---
    hasSizes: {
      type: Boolean,
      default: false,
    },
    sizes: [
      {
        sizeName: { type: String }, // e.g., "Half", "Full", "Regular", "Large"
        price: { type: Number },
      },
    ],
    bestseller: { type: Boolean, default: false },
    available: { type: Boolean, default: true },
    // ... (dietary, spiceLevel, etc. from previous step)
  },
  { timestamps: true },
)

// Validation to ensure sizes are provided if hasSizes is true
MenuItemSchema.path("sizes").validate(function (value) {
  if (this.hasSizes && (!value || value.length === 0)) {
    return false
  }
  return true
}, "If 'hasSizes' is true, at least one size and price must be provided.")

module.exports = mongoose.model("MenuItem", MenuItemSchema)
