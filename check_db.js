require('dotenv').config();
const mongoose = require('mongoose');

const historySchema = new mongoose.Schema({
  userId: String,
  model_title: String,
  score: Number,
  status: Number,
  created_at: String,
  seconds: Number,
  filename: String,
  left: Number,
  top: Number,
  width: Number,
  height: Number,
  img: String,
  doc: String
});

const History = mongoose.model('History', historySchema);

async function check() {
  await mongoose.connect('mongodb+srv://tranviet130525_db_user:cachep12345@cluster0.w4e0q0h.mongodb.net/?appName=Cluster0');
  const h = await History.find().sort({_id: -1}).limit(2);
  console.log(JSON.stringify(h, null, 2));
  process.exit(0);
}

check();
