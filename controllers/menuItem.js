const MenuItem = require("../models/MenuItem")

// 1. GET ALL with Pagination, Search, Category Filter, and Sorting
const getMenuItems = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      category,
      sortBy,
      orderBy = "asc",
    } = req.query

    // Build Filter Query
    const query = {}
    if (search) {
      query.name = { $regex: search, $options: "i" } // Case-insensitive search
    }
    if (category) {
      query.category = category
    }

    // Sorting Logic
    const sortOptions = {}
    if (sortBy) {
      sortOptions[sortBy] = orderBy === "desc" ? -1 : 1
    } else {
      sortOptions.createdAt = -1 // Default: Newest first
    }

    const items = await MenuItem.find(query)
      .populate("category", "name") // Get category name
      .populate("addOns") // Get full add-on details
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit)

    const total = await MenuItem.countDocuments(query)

    res.status(200).json({
      success: true,
      data: items,
      totalPages: Math.ceil(total / limit),
      currentPage: Number(page),
      totalItems: total,
    })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

// 2. CREATE MenuItem
const createMenuItem = async (req, res) => {
  try {
    const newItem = new MenuItem(req.body)
    await newItem.save()
    res.status(201).json({ success: true, menuItem: newItem })
  } catch (error) {
    res.status(400).json({ message: error.message })
  }
}

// 3. UPDATE MenuItem
const updateMenuItem = async (req, res) => {
  try {
    // { runValidators: true } is CRITICAL for your custom 'hasSizes' logic
    const updatedItem = await MenuItem.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true },
    )

    if (!updatedItem) return res.status(404).json({ message: "Item not found" })

    res.status(200).json({ success: true, menuItem: updatedItem })
  } catch (error) {
    res.status(400).json({ message: error.message })
  }
}

// 4. CHANGE Status (Toggle isAvailable)
const toggleAvailability = async (req, res) => {
  try {
    const item = await MenuItem.findById(req.params.id)
    if (!item) return res.status(404).json({ message: "Item not found" })

    item.available = !item.available
    await item.save()

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
