const mongoose = require("mongoose");

const AddOnSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true,"name is required"],
        unique:true,
        trim: true
    },
    price: {
        type: Number,
        required: true,
        default: 0
    },
    icon:{
        type: String,
        required: [true,"icon is required"],
    
    },
    isActive: {
        type: Boolean,
        default: true
    }
});

module.exports = mongoose.model("AddOn", AddOnSchema);