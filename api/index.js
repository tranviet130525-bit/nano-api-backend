const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const User = require('./models/User');
const History = require('./models/History');
const Prompt = require('./models/Prompt');

const app = express();
app.use(express.json());
app.use(cors());

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/nano_db')
  .then(() => console.log('MongoDB Connected'))
  .catch(err => console.error(err));

const JWT_SECRET = process.env.JWT_SECRET || 'nano-secret-token-key-2026';

// Middleware to protect routes
const auth = async (req, res, next) => {
  const token = req.body.token || req.headers['authorization'];
  if (!token) return res.json({ code: 1, msg: 'Chưa xác thực, vui lòng đăng nhập lại!' });

  try {
    const decoded = jwt.verify(token.replace('Bearer ', ''), JWT_SECRET);
    req.user = await User.findById(decoded.id);
    if (!req.user) throw new Error();
    next();
  } catch (e) {
    res.json({ code: 1, msg: 'Token không hợp lệ, vui lòng đăng nhập lại!' });
  }
};

// ---------------- USER ROUTES ----------------- //

app.post('/api/user/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ username });
    if (!user) return res.json({ code: 1, msg: 'Sai tài khoản hoặc mật khẩu' });

    const isMatch = await user.matchPassword(password);
    if (!isMatch) return res.json({ code: 1, msg: 'Sai mật khẩu' });

    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '30d' });

    res.json({
      code: 0,
      msg: 'Đăng nhập thành công',
      data: {
        user_id: user._id,
        score: user.score,
        token: token,
        username: user.username
      }
    });

  } catch (err) {
    res.json({ code: 1, msg: 'Lỗi server' });
  }
});

app.post('/api/user/register', async (req, res) => {
  const { username, password, password_confirm } = req.body;
  if (password !== password_confirm) return res.json({ code: 1, msg: 'Mật khẩu không khớp' });

  try {
    const exists = await User.findOne({ username });
    if (exists) return res.json({ code: 1, msg: 'Tài khoản đã tồn tại' });

    const user = await User.create({ username, password });
    res.json({ code: 0, msg: 'Đăng ký thành công', data: null });
  } catch (err) {
    res.json({ code: 1, msg: 'Lỗi khi đăng ký' });
  }
});

app.post('/api/user/password', async (req, res) => {
  const { username, password, new_password } = req.body;
  try {
    const user = await User.findOne({ username });
    if (!user) return res.json({ code: 1, msg: 'Không tìm thấy tài khoản' });
    const isMatch = await user.matchPassword(password);
    if (!isMatch) return res.json({ code: 1, msg: 'Mật khẩu cũ không đúng' });

    user.password = new_password; // middleware will hash it
    await user.save();
    res.json({ code: 0, msg: 'Đổi mật khẩu thành công' });
  } catch (err) {
    res.json({ code: 1, msg: 'Lỗi đổi mật khẩu' });
  }
});

app.post('/api/user/cdkey', async (req, res) => {
  // Allow all CDKeys (mock success) to activate account if needed
  res.json({ code: 0, msg: 'Kích hoạt thành công' });
});

app.post('/api/user/logout', auth, (req, res) => {
  res.json({ code: 0, msg: 'Đăng xuất thành công' });
});

// ---------------- INFO & HISTORY ----------------- //

app.post('/api/user/info', auth, async (req, res) => {
  try {
    const prompts = await Prompt.find({ userId: req.user._id });

    // Dummy models from backend
    const models = [
      { id: "BANA-1K", title: "BANA-1K", score: 10, k: 0 },
      { id: "BANA-1K-2", title: "BANA-1K-2", score: 12, k: 0 },
      { id: "BANA-4K-PRO", title: "BANA-4K-PRO", score: 30, k: 0 }
    ];

    res.json({
      code: 0,
      msg: 'success',
      data: {
        user: { score: req.user.score },
        gongneng: req.user.gongneng || [],
        model: models,
        prompt: prompts,
      }
    });

  } catch (err) {
    res.json({ code: 1, msg: 'Lỗi server' });
  }
});

app.post('/api/user/submit', auth, async (req, res) => {
    try {
        const { model, prompt, images, aspectRatio, filename, left, top, width, height, doc } = req.body;
        
        // Map model ID to API model name and score cost
        const modelMap = {
            "BANA-1K": { apiModel: "nano-banana-vip", cost: 10, title: "BANA-1K" },
            "BANA-1K-2": { apiModel: "gemini-2.5-flash-image-vip", cost: 12, title: "BANA-1K-2" },
            "BANA-4K-PRO": { apiModel: "gemini-3-pro-image-preview-4k", cost: 30, title: "BANA-4K-PRO" }
        };

        const modelInfo = modelMap[model] || modelMap["BANA-1K"];

        // Check score
        if (req.user.score < modelInfo.cost) {
            return res.json({ code: 1, msg: "Không đủ số dư, vui lòng nạp thêm điểm!" });
        }

        // Prepare request to APICore
        const apiKey = "sk-y7hN7iNoM89bxIwtjspJtUZLtGCP9yNYdiqySLKzmUAEpgmc"; // from plugin config
        const apiUrl = "https://api.apicore.ai/v1/chat/completions";

        const apiPayload = {
            model: modelInfo.apiModel,
            messages: [
                {
                    role: "user",
                    content: [
                        { type: "text", text: (prompt || "Tạo ảnh") + " --ar " + (aspectRatio || "1:1") }
                    ]
                }
            ]
        };

        if (images && images.length > 0) {
            apiPayload.messages[0].content.push({
                type: "image_url",
                image_url: { url: images[0] }
            });
        }

        const startTime = Date.now();
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(apiPayload)
        });

        const resultData = await response.json();
        const elapsedSeconds = Math.round((Date.now() - startTime) / 1000);

        if (!response.ok) {
            console.log("API Error:", resultData);
            return res.json({ code: 1, msg: "Lỗi từ APICore: " + (resultData.error?.message || "Unknown error") });
        }

        // Extract URL 
        const content = resultData.choices[0].message.content;
        let imageUrl = content;
        
        // markdown format (![alt](url))
        const match = content.match(/!\[.*?\]\((.*?)\)/);
        if (match && match[1]) {
            imageUrl = match[1];
        } 
        // JSON format fallback
        else if (content.startsWith("{")) {
            try {
               const parsed = JSON.parse(content);
               if (parsed.url) imageUrl = parsed.url;
               else if (parsed.image) imageUrl = parsed.image;
            } catch(e) {}
        }

        // Remove html/markdown residue if any
        if (imageUrl.includes("](")) imageUrl = imageUrl.split("](")[1].split(")")[0];

        // Deduct score
        req.user.score -= modelInfo.cost;
        await req.user.save();

        // Save history 
        await History.create({
            userId: req.user._id,
            model_title: modelInfo.title,
            score: modelInfo.cost,
            status: 0,
            created_at: new Date().toISOString().replace('T', ' ').substring(0, 19),
            seconds: elapsedSeconds,
            filename: filename || "image.jpg",
            left: left || 0,
            top: top || 0,
            width: width || 1024,
            height: height || 1024,
            img: imageUrl,
            doc: doc || ""
        });

        res.json({ code: 0, msg: "success", data: imageUrl });

    } catch (error) {
        console.error("Submit error:", error);
        res.json({ code: 1, msg: "Có lỗi xảy ra: " + error.message });
    }
});

app.post('/api/user/history/del', auth, async (req, res) => {
  try {
    const { id } = req.body; // array of string ids, or single string id
    if (Array.isArray(id)) {
        await History.deleteMany({ _id: { $in: id }, userId: req.user._id });
    } else if (id) {
        await History.deleteOne({ _id: id, userId: req.user._id });
    } else {
        await History.deleteMany({ userId: req.user._id });
    }
    
    res.json({ code: 0, msg: 'Xóa thành công' });
  } catch (err) {
    res.json({ code: 1, msg: 'Lỗi khi xóa' });
  }
});

app.post('/api/user/prompt/add', auth, async (req, res) => {
  const { name, prompt } = req.body;
  try {
    await Prompt.create({ userId: req.user._id, name, prompt });
    res.json({ code: 0, msg: 'Thêm preset thành công' });
  } catch (err) {
    res.json({ code: 1, msg: 'Lỗi thêm preset' });
  }
});

app.post('/api/user/prompt/del', auth, async (req, res) => {
    const { id } = req.body;
    try {
      await Prompt.deleteOne({ _id: id, userId: req.user._id });
      res.json({ code: 0, msg: 'Xóa preset thành công' });
    } catch (err) {
      res.json({ code: 1, msg: 'Lỗi xóa preset' });
    }
});

// ---------------- BILLING ----------------- //

// Mock pay/add
app.post('/api/user/pay/add', auth, async (req, res) => {
    // Return dummy QR URL and trade no
    res.json({ 
        code: 0, 
        msg: 'success', 
        data: "https://chart.googleapis.com/chart?chs=200x200&cht=qr&chl=Self-Hosted-Backend",
        out_trade_no: `TR-${Date.now()}` 
    });
});

// Mock pay/res
app.post('/api/user/pay/res', auth, async (req, res) => {
    // Increase user score freely on any QR check
    req.user.score += 10000;
    await req.user.save();
    res.json({ code: 0, msg: 'Nạp tiền thành công' });
});

// ---------------- MISC ----------------- //

app.post('/api/user/version', (req, res) => {
    res.json({ code: 0, data: null }); // return null so it doesn't prompt an update
});

app.post('/api/user/submit', auth, async (req, res) => {
    try {
        const { model, prompt, images, aspectRatio, filename } = req.body;
        
        // Map model ID to API model name and score cost
        const modelMap = {
            "BANA-1K": { apiModel: "nano-banana-vip", cost: 10 },
            "BANA-1K-2": { apiModel: "gemini-2.5-flash-image-vip", cost: 12 },
            "BANA-4K-PRO": { apiModel: "gemini-3-pro-image-preview-4k", cost: 30 }
        };

        const modelInfo = modelMap[model] || modelMap["BANA-1K"];

        // Check score
        if (req.user.score < modelInfo.cost) {
            return res.json({ code: 1, msg: "Không đủ số dư, vui lòng nạp thêm điểm!" });
        }

        // Prepare request to APICore
        const apiKey = "sk-y7hN7iNoM89bxIwtjspJtUZLtGCP9yNYdiqySLKzmUAEpgmc"; // from plugin config
        const apiUrl = "https://api.apicore.ai/v1/chat/completions";

        const apiPayload = {
            model: modelInfo.apiModel,
            messages: [
                {
                    role: "user",
                    content: [
                        { type: "text", text: prompt + " --ar " + aspectRatio }
                    ]
                }
            ]
        };

        if (images && images.length > 0) {
            apiPayload.messages[0].content.push({
                type: "image_url",
                image_url: { url: images[0] }
            });
        }

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(apiPayload)
        });

        const resultData = await response.json();

        if (!response.ok) {
            console.log("API Error:", resultData);
            return res.json({ code: 1, msg: "Lỗi từ APICore: " + (resultData.error?.message || "Unknown error") });
        }

        // Extract URL 
        const content = resultData.choices[0].message.content;
        let imageUrl = content;
        
        // markdown format (![alt](url))
        const match = content.match(/!\[.*?\]\((.*?)\)/);
        if (match && match[1]) {
            imageUrl = match[1];
        } 
        // JSON format fallback
        else if (content.startsWith("{")) {
            try {
               const parsed = JSON.parse(content);
               if (parsed.url) imageUrl = parsed.url;
               else if (parsed.image) imageUrl = parsed.image;
            } catch(e) {}
        }

        // Deduct score
        req.user.score -= modelInfo.cost;
        await req.user.save();

        // Save history (We only save the result URL to avoid inflating DB with Base64)
        await History.create({
            userId: req.user._id,
            img1: "Image Uploaded", 
            text: prompt,
            type: modelInfo.apiModel,
            result: imageUrl,
            score: modelInfo.cost,
            status: 2
        });

        res.json({ code: 0, msg: "success", data: imageUrl });

    } catch (error) {
        console.error("Submit error:", error);
        res.json({ code: 1, msg: "Có lỗi xảy ra: " + error.message });
    }
});

app.get('*', (req, res) => res.send('Nano Server is running!'));

// For local testing
if (process.env.NODE_ENV !== 'production') {
  app.listen(3001, () => console.log('Server running locally on port 3001'));
}

module.exports = app;
