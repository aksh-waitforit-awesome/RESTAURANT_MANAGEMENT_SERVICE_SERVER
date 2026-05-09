const MenuItem = require("../models/MenuItem")
const redisClient = require("../config/redis")

// Helper to clear MenuItem cache
const clearMenuItemCache = async () => {
  const keys = await redisClient.keys("menu_items:*")
  if (keys.length > 0) {
    await redisClient.del(keys)
  }
}

// 1. GET ALL with Caching
const getMenuItems = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      category = "",
      sortBy = "createdAt",
      orderBy = "desc",
    } = req.query

    // Create a unique key based on all query parameters
    const cacheKey = `menu_items:page:${page}:limit:${limit}:search:${search}:cat:${category}:sort:${sortBy}:${orderBy}`

    // Try fetching from Redis first
    const cachedData = await redisClient.get(cacheKey)
    if (cachedData) {
      return res.status(200).json(JSON.parse(cachedData))
    }

    // Build Filter Query
    const query = {}
    if (search) {
      query.name = { $regex: search, $options: "i" }
    }
    if (category) {
      query.category = category
    }

    // Sorting Logic
    const sortOptions = {}
    sortOptions[sortBy] = orderBy === "desc" ? -1 : 1

    const items = await MenuItem.find(query)
      .populate("category", "name")
      .populate("addOns")
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit)

    const total = await MenuItem.countDocuments(query)

    const responseData = {
      success: true,
      data: items,
      totalPages: Math.ceil(total / limit),
      currentPage: Number(page),
      totalItems: total,
    }

    // Save to Redis (Expire in 1 hour)
    await redisClient.set(cacheKey, JSON.stringify(responseData), {
      EX: 3600,
    })

    res.status(200).json(responseData)
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

// 2. CREATE MenuItem (Invalidates Cache)
const createMenuItem = async (req, res) => {
  try {
    const newItem = new MenuItem(req.body)
    await newItem.save()
    
    await clearMenuItemCache() // Wipe cache so new item shows up
    
    res.status(201).json({ success: true, menuItem: newItem })
  } catch (error) {
    res.status(400).json({ message: error.message })
  }
}

// 3. UPDATE MenuItem (Invalidates Cache)
const updateMenuItem = async (req, res) => {
  try {
    const updatedItem = await MenuItem.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true },
    )

    if (!updatedItem) return res.status(404).json({ message: "Item not found" })

    await clearMenuItemCache() 

    res.status(200).json({ success: true, menuItem: updatedItem })
  } catch (error) {
    res.status(400).json({ message: error.message })
  }
}

// 4. CHANGE Status (Invalidates Cache)
const toggleAvailability = async (req, res) => {
  try {
    const item = await MenuItem.findById(req.params.id)
    if (!item) return res.status(404).json({ message: "Item not found" })

    item.available = !item.available
    await item.save()

    await clearMenuItemCache()

    res.status(200).json({ success: true, available: item.available })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

module.exports = {
  getMenuItems,
  createMenuItem,
  updateMenuItem,
  toggleAvailability,
}