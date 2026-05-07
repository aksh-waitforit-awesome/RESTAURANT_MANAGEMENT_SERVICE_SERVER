const mongoose = require("mongoose")
const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, "Username is required"], // ✅ array with message
      trim: true,
    },

    email: {
      type: String,
      required: [true, "Email is required"], // ✅ array with message
      unique: true,
      lowercase: true,
    },

    password: {
      type: String,
      required: [true, "Password is required"], // ✅ array with message
      select: false,
    },

    role: {
      type: String,
      enum: [
        "admin",
        "demo_admin",
        "waiter",
        "chef",
        "receptionist",
        "cashier",
        "delivery_guy",
        "customer",
      ],
      default: "customer",
    },
    isAvailable: {
      type: Boolean,
      default: function () {
        // Only defaults to true if the user is a delivery_guy
        return this.role === "delivery_guy" ? true : undefined
      },
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true },
)

userSchema.pre("save", async function () {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified("password")) return

  const salt = await bcrypt.genSalt(10)
  this.password = await bcrypt.hash(this.password, salt)

  // No next() needed here for async functions!
})
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password)
}

// 🎟 Generate Access Token
userSchema.methods.generateAccessToken = function () {
  return jwt.sign(
    { user_id: this._id, role: this.role },
    process.env.ACCESS_TOKEN_SECRET, // ✅ separate secret
    { expiresIn: "15m" },
  )
}

// 🔄 Generate Refresh Token
userSchema.methods.generateRefreshToken = function () {
  return jwt.sign(
    { user_id: this._id, role: this.role },
    process.env.REFRESH_TOKEN_SECRET, // ✅ separate secret
    { expiresIn: "7d" },
  )
}

module.exports = mongoose.model("User", userSchema)
