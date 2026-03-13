const mongoose = require('mongoose');

const historySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  model_title: String,
  score: Number,
  status: { type: Number, default: 0 }, // 0 = success, 1 = failure, 2 = generating
  created_at: String,
  seconds: { type: Number, default: 0 },
  filename: String,
  left: Number,
  top: Number,
  width: Number,
  height: Number,
  img: String, // result image URL
  doc: String
});

const History = mongoose.model('History', historySchema);
module.exports = History;
