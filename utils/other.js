/**
 * Generates a user-friendly message for kitchen and waitstaff
 * @param {Object} subOrder - The updated subOrder document
 * @param {Array|String} updatedIds - The IDs that were just updated
 * @param {String} newStatus - The status they were changed to
 * @returns {String} - A formatted notification message
 */
const generateStatusMessage = (subOrder, updatedIds, newStatus) => {
  const idArray = Array.isArray(updatedIds) ? updatedIds : [updatedIds]

  // 1. Find the names of the items that were actually updated
  const updatedItemNames = subOrder.items
    .filter((item) => idArray.includes(item._id.toString()))
    .map((item) => `${item.quantity}x ${item.name}`)

  const itemListString = updatedItemNames.join(", ")
  const statusEmoji =
    {
      preparing: "👨‍🍳",
      ready_to_serve: "🛎️",
      served: "✅",
      placed: "📝",
    }[newStatus] || "🔄"

  // 2. Handle the "All Served" milestone
  if (subOrder.allServed && newStatus === "served") {
    return `🎉 Order Complete! Table ${subOrder.tableNumber}: All items have been served.`
  }

  // 3. Handle multiple vs single items
  if (updatedItemNames.length > 1) {
    return `${statusEmoji} Table ${subOrder.tableNumber}: [${itemListString}] are now ${newStatus.replace(/_/g, " ")}.`
  } else if (updatedItemNames.length === 1) {
    return `${statusEmoji} Table ${subOrder.tableNumber}: ${updatedItemNames[0]} is now ${newStatus.replace(/_/g, " ")}.`
  }

  return `Table ${subOrder.tableNumber}: Status updated to ${newStatus}`
}
module.exports = { generateStatusMessage }
