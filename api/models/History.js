const mongoose = require('mongoose');

const historySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  // the plugin expects: id, img1, text, type, result, score, status, intime
  img1: String, // original image
  text: String, // prompt used
  type: String, // type of generation
  result: String, // result image URL
  score: Number, // cost
  status: { type: Number, default: 2 }, // 2 = success
  intime: {
    type: Date,
    default: Date.now,
  }
});

const History = mongoose.model('History', historySchema);
module.exports = History;
