const mongoose = require("mongoose")

const CategorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      unique: true,
      trim: true, // Clean up whitespace
      required: [true, "Category name is required"],
    },
    desc: {
      type: String,
      default: "One of the best categories",
    },
    icon: {
      type: String,
      required: [true, "Category icon is required"],
    },
    available: {
      type: Boolean,
      default: true,
    },
    // --- Statistics Section ---
    stats: {
      itemCount: { type: Number, default: 0 }, // Total dishes in this category
      totalOrders: { type: Number, default: 0 }, // How many times dishes here were ordered
      viewCount: { type: Number, default: 0 }, // Menu clicks/taps
      lastOrderedAt: { type: Date }, // Recency tracking
    },
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt
  },
)

// Indexing for performance
CategorySchema.index({ "stats.totalOrders": -1 })

module.exports = mongoose.model("Category", CategorySchema)
