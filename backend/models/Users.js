const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  userId: { type: String, required: true, unique: true }, // 5-digit unique ID
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
