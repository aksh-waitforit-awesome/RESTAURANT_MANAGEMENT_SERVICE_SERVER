const mongoose = require('mongoose');

const TableSchema = new mongoose.Schema({
  // 1. UNIQUE IDENTIFIER
  // Use this ID to link with "Reservations" and "Sessions" later
  tableNumber: { 
    type: String, 
    required: true, 
    unique: true,
    trim: true 
  }, 

  // 2. KINEMATICS (React-Konva Positioning)
  x: { type: Number, required: true }, 
  y: { type: Number, required: true },
  rotation: { type: Number, default: 0 },

  // 3. PHYSICAL PROPERTIES
  shape: { 
    type: String, 
    enum: ['rect', 'circle'], 
    default: 'rect' 
  },
  width: { type: Number, default: 60 },
  height: { type: Number, default: 60 },
  radius: { type: Number, default: 30 }, // Used if shape is 'circle'

  // 4. CAPACITY
  // Useful for filtering reservations (e.g., "Find me a table for 6")
  capacity: { 
    type: Number, 
    required: true,
    min: 1 
  },

  // 5. METADATA
  lastMovedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Table', TableSchema);