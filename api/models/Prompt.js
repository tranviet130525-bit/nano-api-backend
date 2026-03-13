const mongoose = require('mongoose');

const promptSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  name: String,
  prompt: String,
});

const Prompt = mongoose.model('Prompt', promptSchema);
module.exports = Prompt;
