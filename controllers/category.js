const Category = require("../models/Category")

// @desc    Get all categories with search, filter & pagination
module.exports.getAllCategories = async (req, res) => {
  try {
    const { search, available, page = 1, limit = 10 } = req.query

    // Build Query
    let query = {}
    if (search) {
      query.name = { $regex: search, $options: "i" } // Case-insensitive search
    }
    if (available !== undefined) {
      query.available = available === "true"
    }

    // Execute Pagination
    const categories = await Category.find(query)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ "stats.totalOrders": -1 }) // Default sort by popularity

    const count = await Category.countDocuments(query)

    res.status(200).json({
      success: true,
      count,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      data: categories,
    })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
}

// @desc    Add new category
module.exports.createCategory = async (req, res) => {
  try {
    const category = await Category.create(req.body)
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

    res.status(200).json({ success: true, available: category.available })
  } catch (err) {
    res.status(400).json({ success: false, error: err.message })
  }
}
