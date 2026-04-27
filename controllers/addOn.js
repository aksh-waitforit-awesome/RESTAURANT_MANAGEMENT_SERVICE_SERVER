const AddOn = require("../models/AddOn");
const BadRequestError = require("../errors/badRequestError");
const NotFoundError = require("../errors/notFoundError");
const asyncHandler = require("../utils/asyncWrapper")
// 1. Create Add-On
module.exports.createAddOn = asyncHandler(async (req, res) => {
    const addOn = await AddOn.create(req.body);
    res.status(201).json({ message: "Add-on created", addOn });
});

// 2. Full Update (Name/Price/Status)
module.exports.updateAddOn = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const addOn = await AddOn.findByIdAndUpdate(id, req.body, { new: true, runValidators: true });
    
    if (!addOn) {
        throw new NotFoundError(`Add-on with id: ${id} not found`);
    }
    res.status(200).json({ message: "Add-on updated successfully", addOn });
});

// 3. Toggle Status (Optimized)
module.exports.changeStatus = asyncHandler(async (req, res) => {
    const { id } = req.params;
    
    // Find the document first to toggle the existing boolean
    const addOn = await AddOn.findById(id);
    
    if (!addOn) {
        throw new NotFoundError(`Add-on with id: ${id} not found`);
    }

    // Toggle the current state
    addOn.isActive = !addOn.isActive;
    await addOn.save();

    res.status(200).json({ message: `Add-on is now ${addOn.isActive ? 'active' : 'inactive'}`, addOn });
});

// 4. Get All with Pagination & Search
module.exports.getAllAddOn = asyncHandler(async (req, res) => { // Added req, res here
    const { search = "", page = 1, limit = 5, isActive, sortBy = "name" , orderBy = "desc" } = req.query;
    let query = {};

    if (search) {
        query.name = { $regex: search, $options: "i" };
    }

    if (isActive !== undefined) {
        query.isActive = isActive === "true";
    }
    const sortOptions = { [sortBy]: orderBy === "desc" ? -1 : 1 };
    
    // Execute Pagination
    const addOns = await AddOn.find(query)
        .limit(Number(limit))
        .skip((Number(page) - 1) * Number(limit))
        .sort(sortOptions); // Sorted A-Z for better UX in lists

    const count = await AddOn.countDocuments(query);

    res.status(200).json({
        success: true,
        count,
        totalPages: Math.ceil(count / limit),
        currentPage: Number(page),
        data: addOns
    });
});