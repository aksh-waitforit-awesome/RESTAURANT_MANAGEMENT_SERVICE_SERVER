const { Worker } = require("bullmq")
const { demoEnvironmentCleaned } = require("./index")
const mongoose = require("mongoose") // Needed for transactions
const redisConnection = require("./config/redis")
const TableSession = require("./models/TableSession")
const SubOrder = require("./models/SubOrder")
const Order = require("./models/Order")
const User = require("./models/User")

const cleanupWorker = new Worker(
  "demo-cleanup",
  async (job) => {
    const { UserId } = job.data

    // Start a MongoDB session for the transaction
    const session = await mongoose.startSession()
    session.startTransaction()

    try {
      // 1. Find sessions inside the transaction
      const sessions = await TableSession.find({ waiter_id: UserId })
        .select("_id")
        .session(session)

      const sessionIds = sessions.map((s) => s._id)
      console.log("sessionIds", sessionIds)
      if (sessionIds.length > 0) {
        // 2. Delete SubOrders and Orders
        // Pass the { session } to every operation
        await SubOrder.deleteMany(
          { tableSession_id: { $in: sessionIds } },
          { session },
        )
        await Order.deleteMany(
          { tableSession_id: { $in: sessionIds } },
          { session },
        )

        // 3. Delete the Table Sessions
        await TableSession.deleteMany({ _id: { $in: sessionIds } }, { session })
      }

      // 4. Delete the User
      await User.findByIdAndDelete(UserId).session(session)

      // If we got here, commit everything to the DB
      await session.commitTransaction()
      // Trigger the WebSocket broadcast
      if (demoEnvironmentCleaned) {
        demoEnvironmentCleaned(UserId)
      }
      console.log(`Successfully wiped all demo data for User: ${UserId}`)
    } catch (error) {
      // If ANY step fails, undo everything
      await session.abortTransaction()
      console.error("Cleanup Job Failed, changes rolled back:", error)
      throw error // Re-throw so BullMQ can retry
    } finally {
      // Always close the session
      await session.endSession()
    }
  },
  { connection: redisConnection },
)

module.exports = cleanupWorker
