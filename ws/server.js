const jwt = require("jsonwebtoken")
const { WebSocketServer, WebSocket } = require("ws")

// Store user connections: Map<userId, Set<WebSocket>>
const userSockets = new Map()
const Order = require("../models/Order")
const { generateStatusMessage } = require("../utils/other")
function sendJSON(socket, data) {
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(data))
  }
}
const broadcastToRoles = (wss, roles, envelope) => {
  console.log("broadcast envlope")
  const rolesArray = Array.isArray(roles) ? roles : [roles]
  wss.clients.forEach((client) => {
    if (client.isAuthorized && rolesArray.includes(client.user?.role)) {
      sendJSON(client, envelope)
    }
  })
}

function attachWebServer(server) {
  const wss = new WebSocketServer({
    server,
    path: "/ws",
    maxPayload: 1024 * 1024,
  })

  // SINGLE Heartbeat interval for all clients
  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) return ws.terminate()
      ws.isAlive = false
      ws.ping()
    })
  }, 30000) // 30 seconds is standard; 3s is very aggressive

  wss.on("connection", (ws) => {
    console.log("trying connection")
    ws.isAuthorized = false
    ws.isAlive = true
    ws.user = null

    ws.on("pong", () => {
      ws.isAlive = true
    })

    // Auth Timeout
    const authTimeout = setTimeout(() => {
      if (!ws.isAuthorized) {
        sendJSON(ws, { error: "Auth timeout: Closing connection" })
        ws.terminate()
      }
    }, 5000)

    ws.on("message", async (data) => {
      try {
        const message = JSON.parse(data)

        if (message.type === "AUTH") {
          jwt.verify(
            message?.token,
            process.env.ACCESS_TOKEN_SECRET,
            (err, decode) => {
              if (err) {
                sendJSON(ws, { error: "Invalid Token" })
                return ws.close()
              }
              console.log("decode", decode)
              const uid = decode.user_id
              ws.isAuthorized = true
              ws.user = decode

              // Manage User Map
              if (!userSockets.has(uid)) {
                userSockets.set(uid, new Set())
              }
              userSockets.get(uid).add(ws)

              clearTimeout(authTimeout)
              sendJSON(ws, { type: "AUTH_SUCCESS" })
            },
          )
        }
      } catch (e) {
        sendJSON(ws, { error: "Invalid JSON format" })
      }

      // sending order status to customer
    })

    ws.on("close", () => {
      // CLEANUP: Remove socket from map to prevent memory leaks
      if (ws.user && userSockets.has(ws.user.user_id)) {
        const userSet = userSockets.get(ws.user.user_id)
        userSet.delete(ws)
        if (userSet.size === 0) userSockets.delete(ws.user.user_id)
      }
    })

    ws.on("error", console.error)
  })

  wss.on("close", () => clearInterval(interval))

  // Inside attachWebServer function in ws/server.js
  // Dinning
  // 1 SESSION_CREATED
  function sessionCreated({ tableId, tableNumber, newSession }) {
    const envelope = {
      type: "SESSION_CREATED",
      message: `Table ${tableNumber} is now occupied.`,
      tableId: tableId, // Needed to find the table in the cache
      newSession, // The clean session object created by the DB
    }
    wss.clients.forEach((client) => {
      if (client.user.role == "waiter") {
        sendJSON(client, envelope)
      }
    })
  }
  function waiterSendOrderToKitchen(subOrder) {
    const envelope = {
      type: "KITCHEN_TICKET",
      source: "DINING",
      message: `🛎️ NEW TICKET: Table ${subOrder.tableNumber}`,
      payload: subOrder,
    }

    // 3. Broadcast only to the relevant staff
    wss.clients.forEach((client) => {
      // Both Chefs (to cook) and potentially Admins (to monitor)
      if (client?.user?.role === "chef" || client?.user?.role === "waiter") {
        if (client.readyState === 1) {
          // 1 = WebSocket.OPEN
          sendJSON(client, envelope)
        }
      }
    })
  }
  // new online order is placed
  function newOnlineOrderPlaced(orderId) {
    wss.clients?.forEach((client) => {
      if (client?.user.role && client?.user?.role == "chef") {
        sendJSON(client, { type: "NEW_ONLINE_ORDER_PLACED", orderId: orderId })
      }
    })
  }
  function SubOrderStatusUpdated(subOrder, newStatus, updateIds) {
    const niceMessage = generateStatusMessage(subOrder, updateIds, newStatus)
    wss.clients.forEach((client) => {
      if (client?.user?.role == "chef" || client?.user?.role == "waiter") {
        sendJSON(client, {
          type: "SUBORDER_STATUS_UPDATED",
          message: niceMessage,
          payload: {
            subOrderId: subOrder._id,
            tableNumber: subOrder.tableNumber,
            allServed: subOrder.allServed,
            subOrder,
          },
        })
      }
    })
  }
  // newOrder place

  // order status updated
  function orderStatusUpdated({ userId, orderId, orderStatus }) {
    const userIdStr = userId.toString() // Ensure it's a string for Map lookup
    const sockets = userSockets.get(userIdStr)

    if (!sockets || sockets.size === 0) return

    // Use forEach because userSockets stores a Set
    sockets.forEach((socket) => {
      sendJSON(socket, {
        type: "ORDER_STATUS_UPDATED",
        payload: {
          orderId,
          orderStatus,
          message: `Order #${orderId} is now ${orderStatus}`,
        },
      })
    })
  }
  function sessionCompleted({ tableId, tableNumber, newUnsettledOrder }) {
    const envelope = {
      type: "SESSION_COMPLETED",
      message: `Table ${tableNumber} bill is ready for settlement.`,
      tableId,
      newUnsettledOrder, // This is the gold for the cashier
    }

    wss.clients.forEach((client) => {
      if (client.user.role === "waiter" || client.user.role === "cashier") {
        sendJSON(client, envelope)
      }
    })
  }
  function demoEnvironmentCleaned(userId) {
    const envelope = {
      type: "DEMO_DATA_CLEANUP",
      message: "A demo session has expired and data has been cleared",
      payload: { userId },
    }
    wss.clients.forEach((client) => {
      if (client.isAuthorized && client?.user?.role !== "customer") {
        sendJSON(client, envelope)
      }
    })
  }
  function emptySessionDeletion({ tableId, tableNumber, sessionId }) {
    const envelope = {
      type: "EMPTY_SESSION_DELETE",
      message: `An Empty table session ${sessionId} of Table number ${tableNumber} is deleted `,
      payload: { tableId, tableNumber, sessionId },
    }
    broadcastToRoles(wss, "waiter", envelope)
  }
  return {
    sessionCreated,
    orderStatusUpdated,
    newOnlineOrderPlaced,
    SubOrderStatusUpdated,
    waiterSendOrderToKitchen,
    sessionCompleted,
    demoEnvironmentCleaned,
    emptySessionDeletion,
  }
}

module.exports = { attachWebServer }
