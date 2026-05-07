const User = require("../models/User")
const asyncWrapper = require("../utils/asyncWrapper")
const BadRequestError = require("../errors/badRequestError")
const UnauthorizedError = require("../errors/unauthorizedError")
const NotFoundError = require("../errors/notFoundError")
const jwt = require("jsonwebtoken")
const aj = require("../utils/arcjet.js")
// ---------------- REGISTER (CUSTOMER ONLY)
module.exports.register = asyncWrapper(async (req, res) => {
  console.log(req.body)
  const { username, email, password } = req.body
  if (!username || !email || !password) {
    throw new BadRequestError("Provide all required fields")
  }

  const existing = await User.findOne({ email })
  if (existing) throw new BadRequestError("Email already in use")

  const user = await User.create({
    username,
    email,
    password,
    role: "customer",
  })

  res.status(201).json({
    message: "account created",
    success: true,
  })
})

// ---------------- LOGIN (ALL USERS)
module.exports.login = asyncWrapper(async (req, res) => {
  const { email, password } = req.body
  if (!email || !password)
    throw new BadRequestError("Provide email and password")

  const user = await User.findOne({ email }).select("+password")
  if (!user) throw new NotFoundError(`No account found with ${email}`)

  const isMatch = await user.comparePassword(password)
  if (!isMatch) throw new UnauthorizedError("Invalid credentials")

  const accessToken = user.generateAccessToken()
  const refreshToken = user.generateRefreshToken()
  console.log("user:", user)
  console.log("accessToken:", accessToken)
  console.log("refreshToken:", refreshToken)
  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  })

  res.status(200).json({
    accessToken,
    user: { username: user.username, role: user.role },
  })
})

// ---------------- CREATE ADMIN (MANUAL)
module.exports.createAdmin = asyncWrapper(async (req, res) => {
  const existingAdmin = await User.findOne({ role: "admin" })
  if (existingAdmin) throw new BadRequestError("Admin already exists")

  const admin = await User.create({
    username: "admin123",
    email: "admin@gmail.com",
    password: "adminPass123",
    role: "admin",
  })
  res.status(201).json({ message: "admin created" })
})

module.exports.createDemoAdmin = asyncWrapper(async (req, res) => {
  const existingAdmin = await User.findOne({ role: "demo_admin" })
  if (existingAdmin) throw new BadRequestError("Demo admin already exists")

  const admin = await User.create({
    username: "demo_user",
    email: "demo@gmail.com",
    password: "demo12345",
    role: "demo_admin",
  })
  res.status(201).json({ message: "demo admin created" })
})
// ---------------- ADD MANAGER OR STAFF (ADMIN/MANAGER)
/*module.exports.addUser = asyncWrapper(async (req, res) => {
  const { username, email, password, role } = req.body
  if (!username || !email || !password || !role) {
    throw new BadRequestError("Provide username, email, password and role")
  }
  const requesterRole = req.user.role
  const allowedRoles = ["admin", "demo_admin"]
  const isDemo = requesterRole === "demo_admin"
  console.log(isDemo, requesterRole)
  const expireAt = isDemo ? new Date(Date.now() + 3 * 60 * 1000) : null

  // Prevent creating another admin
  if (role === "admin" || role === "demo_admin")
    throw new BadRequestError(
      "Cannot create admin and demo_admin via this route",
    )

  // Check email uniqueness
  const existing = await User.findOne({ $or: [{ username }, { email }] })
  if (existing) throw new BadRequestError("Email or username already in use")

  // Only admin or demo_admin can create staff
  if (!allowedRoles.includes(req.user.role)) {
    throw new UnauthorizedError("Access denied")
  }

  const user = await User.create({
    username,
    email,
    password,
    role,
    isDemo,
    expireAt,
  })

  res.status(201).json({
    user,
  })
})*/
module.exports.addUser = asyncWrapper(async (req, res) => {
  const { username, email, password, role } = req.body

  // 1. Arcjet Protection (Uses IP in-flight, but doesn't store it in DB)
  const decision = await aj.protect(req)
  if (decision.isDenied()) {
    if (decision.reason.isRateLimit()) {
      throw new BadRequestError(
        "Rate limit exceeded. Try again in a few minutes.",
      )
    }
    throw new UnauthorizedError("Request blocked by security shield.")
  }

  // 2. Initial Validation
  if (!username || !email || !password || !role) {
    throw new BadRequestError(
      "All fields (username, email, password, role) are required.",
    )
  }

  const requesterRole = req.user.role
  const isDemoAdmin = requesterRole === "demo_admin"

  // 3. Security: Prevent role escalation
  // Even a real admin shouldn't be able to create another admin via this route
  if (["admin", "demo_admin"].includes(role)) {
    throw new BadRequestError(
      "Cannot create administrative roles via this endpoint.",
    )
  }

  // 4. Authorization check
  if (requesterRole !== "admin" && !isDemoAdmin) {
    throw new UnauthorizedError("You do not have permission to add staff.")
  }

  // 5. Check if User already exists
  const existingUser = await User.findOne({ $or: [{ username }, { email }] })
  if (existingUser) {
    throw new BadRequestError("Username or email already exists.")
  }

  // 6. Handle Demo Logic
  // We get a random UUID from the header passed by the frontend
  /*const demoSessionId = req.headers["x-demo-session-id"]*/

  const userData = {
    username,
    email,
    password,
    role,
    isDemo: isDemoAdmin,
  }

  if (isDemoAdmin) {
    userData.expireAt = new Date(Date.now() + 3 * 60 * 1000) // 3 minutes
  }

  // 7. Create User
  const user = await User.create(userData)

  // 8. Response (Strip sensitive data)
  res.status(201).json({
    success: true,
    message: isDemoAdmin
      ? "Demo staff created (expires in 3 mins)"
      : "Staff created successfully",
    user: {
      id: user._id,
      username: user.username,
      role: user.role,
      expireAt: user.expireAt,
    },
  })
})
module.exports.refresh = asyncWrapper(async (req, res) => {
  const refreshToken = req.cookies.refreshToken
  console.log("refresh:", refreshToken)
  if (!refreshToken) {
    throw new UnauthorizedError("refresh token is missing")
  }
  const payload = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET)
  const user = await User.findById(payload.user_id)
  if (!user) throw new UnauthorizedError("User no longer exist")
  const accessToken = user.generateAccessToken()
  res
    .status(200)
    .json({ accessToken, user: { username: user.username, role: user.role } })
})
module.exports.logout = asyncWrapper(async (req, res) => {
  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  })
  res.status(200).json({
    success: true,
    message: "Logged out successfully",
  })
})
module.exports.getStaff = asyncWrapper(async (req, res) => {
  // ✅ Correct Syntax: { field: { $nin: [values] } }
  const { search = "", page = 1, limit = 10, role = "" } = req.query
  // Build Query Filter
  const query = {
    username: { $regex: search, $options: "i" },
    role: role ? role : { $nin: ["customer"] }, // If role filter is provided, use it; otherwise, ignore
  }

  const staff = await User.find(query)
    .limit(limit)
    .skip((page - 1) * limit)
  const total = await User.countDocuments(query)
  res.status(200).json({
    success: true,
    data: staff,
    totalPages: Math.ceil(total / limit),
    currentPage: Number(page),
    totalMembers: total,
  })
})
