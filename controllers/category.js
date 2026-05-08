const Category = require("../models/Category")
const redisClient = require("../config/redis") // Ensure spelling is correct here

// Helper to generate a unique cache key based on query params
const getCacheKey = (search, available, page, limit) => {
  return `categories:search=${search || ""}:avail=${available || "all"}:p=${page}:l=${limit}`
}

// @desc    Get all categories with search, filter & pagination
module.exports.getAllCategories = async (req, res) => {
  try {
    const { search, available, page = 1, limit = 10 } = req.query
    const cacheKey = getCacheKey(search, available, page, limit)

    // 1. Check Redis Cache
    const cachedData = await redisClient.get(cacheKey)
    if (cachedData) {
      console.log("⚡ Serving from Cache")
      console.log(cachedData)
      return res.status(200).json(JSON.parse(cachedData))
    }

    // 2. Build Query if not in cache
    let query = {}
    if (search) {
      query.name = { $regex: search, $options: "i" }
    }
    if (available !== undefined) {
      query.available = available === "true"
    }

    // 3. Execute MongoDB Queries
    const [categories, count] = await Promise.all([
      Category.find(query)
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .sort({ "stats.totalOrders": -1 }),
      Category.countDocuments(query),
    ])

    const response = {
      success: true,
      count,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      data: categories,
    }

    // 4. Save to Redis (Expire in 1 hour / 3600 seconds)
    await redisClient.setex(cacheKey, 3600, JSON.stringify(response))

    res.status(200).json(response)
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
}

// @desc    Add new category
module.exports.createCategory = async (req, res) => {
  try {
    const category = await Category.create(req.body)

    // Invalidate all category caches
    await clearCategoryCache()

    res.status(201).json({ success: true, data: category })
  } catch (err) {
    res.status(400).json({ success: false, error: err.message })
  }
}

// @desc    Update category details
module.exports.updateCategory = async (req, res) => {
  try {
    const category = await Category.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    })
    if (!category) return res.status(404).json({ message: "Not found" })

    await clearCategoryCache()

    res.status(200).json({ success: true, data: category })
  } catch (err) {
    res.status(400).json({ success: false, error: err.message })
  }
}

// @desc    Toggle Active Status
module.exports.changeStatus = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id)
    if (!category)
      return res.status(404).json({ message: "Category not found" })

    category.available = !category.available
    await category.save()

    await clearCategoryCache()

    res.status(200).json({ success: true, available: category.available })
  } catch (err) {
    res.status(400).json({ success: false, error: err.message })
  }
}

/**
 * Helper to clear all keys starting with 'categories:'
 */
async function clearCategoryCache() {
  const keys = await redisClient.keys("categories:*")
  if (keys.length > 0) {
    await redisClient.del(keys)
    console.log("🗑️ Category Cache Cleared")
  }
}
