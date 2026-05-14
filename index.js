require("dotenv").config()
const express = require("express")
const http = require("http")
const cors = require("cors")
const connectDB = require("./db/db")
const redisClient = require("./config/redis")
const cookieParser = require("cookie-parser")
const notFound = require("./middlewares/notFound")
const errorHandler = require("./middlewares/errorHandler")
const authRoute = require("./routes/auth")
const categoryRoute = require("./routes/category")
const addOnRoute = require("./routes/addOn")
const menuItemRoute = require("./routes/menuItem")
const kitchenRoute = require("./routes/kitchen")
const orderRoute = require("./routes/order")
const onlineOrderRouter = require("./routes/onlineOrder")
const subOrderRoute = require("./routes/subOrder")
const deliveryRoute = require("./routes/delivery")
const tableRoute = require("./routes/table")
const tableSessionRoute = require("./routes/TableSession")
const auth = require("./middlewares/auth")
require("./worker")
const { handleStripeWebhook } = require("./controllers/order")
const { attachWebServer } = require("./ws/server")
const app = express()
const server = http.createServer(app)

console.log("admin url", process.env.ADMIN_URL)
app.set("trust proxy", 1)
app.use(
  cors({
    origin: [
      process.env.NODE_ENV === "production"
        ? process.env.CLIENT_URL
        : "http://localhost:5173",
      process.env.NODE_ENV === "production"
        ? process.env.ADMIN_URL
        : "http://localhost:5174",
    ], // Specify your frontend URL
    credentials: true, // Allow cookies to be sent
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
)
app.post(
  "/api/webhook",
  express.raw({ type: "application/json" }),
  handleStripeWebhook,
)
app.use(express.json())
app.use(cookieParser())

app.use("/api/v1/auth", authRoute)
app.use("/api/v1/category", categoryRoute)
app.use("/api/v1/addOn", addOnRoute)
app.use("/api/v1/menu", menuItemRoute)
app.use("/api/v1/kitchen", kitchenRoute)
app.use("/api/v1/order", orderRoute)
app.use("/api/v1/onlineOrders", onlineOrderRouter)
app.use("/api/v1/subOrder", subOrderRoute)
app.use("/api/v1/delivery", auth, deliveryRoute)

app.use("/api/v1/tables", auth, tableRoute)
app.use("/api/v1/tableSession", auth, tableSessionRoute)
app.use(notFound)
app.use(errorHandler)

const port = process.env.PORT || 5000

// index.js
const {
  sessionCreated,
  orderStatusUpdated,
  newOnlineOrderPlaced,
  SubOrderStatusUpdated,
  waiterSendOrderToKitchen,
  sessionCompleted,
  demoEnvironmentCleaned,
  emptySessionDeletion,
} = attachWebServer(server)
app.locals.sessionCreated = sessionCreated
app.locals.orderStatusUpdated = orderStatusUpdated
app.locals.newOnlineOrderPlaced = newOnlineOrderPlaced
app.locals.SubOrderStatusUpdated = SubOrderStatusUpdated
app.locals.waiterSendOrderToKitchen = waiterSendOrderToKitchen
app.locals.sessionCompleted = sessionCompleted
global.demoEnvironmentCleaned = demoEnvironmentCleaned
app.locals.emptySessionDeletion = emptySessionDeletion
server.listen(port, async () => {
  await connectDB(process.env.MONGO_KEY)
  console.log(`server listening on ${port}`)
  console.log(`server listening on ws://localhost:${port}/ws`)
})
redisClient.set("foo", "bar").then(() => console.log("Redis Initialized"))
