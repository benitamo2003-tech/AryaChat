const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');

const JWT_SECRET = "AryaSuperSecretKey2026"; 
const app = express();
const server = http.createServer(app);

// ۱. تنظیمات حجم برای فایل‌های سنگین (موزیک، ویدیو، آواتارهای با کیفیت)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// ۲. تنظیمات Socket.io
const io = new Server(server, {
    maxHttpBufferSize: 1e8,
    transports: ['polling', 'websocket']
});

app.use(express.static(path.join(__dirname, '../frontend')));

const MONGO_URI = "mongodb://127.0.0.1:27017/AryaChatDB"; 

mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ اتصال به دیتابیس برقرار شد'))
  .catch(err => console.error('❌ خطا در دیتابیس:', err.message));

// --- مدل کاربر (آپدیت شده برای تاریخچه پروفایل) ---
const User = mongoose.model('User', new mongoose.Schema({
    email: { type: String, unique: true, required: true },
    firstName: String,
    // تغییر این خط:
    username: { type: String, unique: true, sparse: true, default: undefined }, 
    bio: { type: String, maxlength: 100 },
    birthDate: String,
    avatar: { type: String, default: 'img/default-avatar.png' },
    avatarHistory: [String]
}));

const Message = mongoose.model('Message', new mongoose.Schema({
    sender: String,
    senderName: String,
    receiver: String,
    text: String,
    fileUrl: String, 
    fileType: String, 
    type: String,
    seen: { type: Boolean, default: false },
    time: { type: Date, default: Date.now }
}));

const otpStore = new Map();

const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com', port: 465, secure: true,
    auth: { user: 'benitamo2003@gmail.com', pass: 'izaljwlkmrkonlib' }
});

// --- API های احراز هویت ---

app.post('/api/auth/send-code', async (req, res) => {
    const { email } = req.body;
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    otpStore.set(email, code);
    try {
        await transporter.sendMail({
            from: '"AryaChat" <benitamo2003@gmail.com>',
            to: email,
            subject: 'کد تایید آریا چت',
            html: `<h1 style="text-align:center; color:#048896;">${code}</h1>`
        });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false }); }
});

app.post('/api/auth/verify-code', async (req, res) => {
    const { email, code } = req.body;
    if (otpStore.get(email) !== code) return res.status(401).json({ success: false });
    const token = jwt.sign({ email }, JWT_SECRET, { expiresIn: '30d' });
    const user = await User.findOne({ email });
    res.json({ success: true, newUser: !user, user, token });
});

// --- API های مدیریت پروفایل ---

// دریافت اطلاعات کامل (شامل تاریخچه عکس‌ها)
app.get('/api/user/profile', async (req, res) => {
    try {
        const user = await User.findOne({ email: req.query.email });
        res.json({ success: true, user });
    } catch (err) { res.status(500).json({ success: false }); }
});

// به‌روزرسانی اطلاعات متنی
app.post('/api/user/update-full', async (req, res) => {
    const { email, username, firstName, bio, birthDate } = req.body;
    try {
        if (username) {
            const existingUser = await User.findOne({ username, email: { $ne: email } });
            if (existingUser) return res.json({ success: false, message: "آیدی تکراری است" });
        }
        await User.findOneAndUpdate({ email }, { username, firstName, bio, birthDate });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false }); }
});

// آپدیت آواتار با قابلیت ذخیره در تاریخچه
app.post('/api/user/update-avatar', async (req, res) => {
    const { email, avatar } = req.body;
    try {
        const user = await User.findOne({ email });
        if (user) {
            const oldAvatar = user.avatar;
            // اگر عکس فعلی پیش‌فرض نیست، بفرستش به تاریخچه
            const updateData = { avatar: avatar };
            if (oldAvatar && oldAvatar !== 'img/default-avatar.png') {
                await User.findOneAndUpdate(
                    { email },
                    { 
                        avatar: avatar, 
                        $push: { avatarHistory: { $each: [oldAvatar], $position: 0 } } 
                    }
                );
            } else {
                await User.findOneAndUpdate({ email }, { avatar: avatar });
            }
            res.json({ success: true });
        }
    } catch (err) { res.status(500).json({ success: false }); }
});

// حذف آواتار فعلی و بازگشت به عکس پیش‌فرض
app.post('/api/user/delete-avatar', async (req, res) => {
    const { email } = req.body;
    try {
        await User.findOneAndUpdate({ email }, { avatar: 'img/default-avatar.png' });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false }); }
});

app.post('/api/auth/complete-signup', async (req, res) => {
    const { email, firstName, lastName } = req.body;
    try {
        // استفاده ازfindOneAndUpdate با تنظیمات درست
        await User.findOneAndUpdate(
            { email }, 
            { firstName, lastName }, 
            { upsert: true, new: true }
        );
        
        const token = jwt.sign({ email }, JWT_SECRET, { expiresIn: '30d' });
        res.json({ success: true, token });
    } catch (err) {
        console.error("خطا در تکمیل ثبت‌نام:", err);
        res.status(500).json({ success: false, message: "خطای سرور در ثبت اطلاعات" });
    }
});
// API برای جستجوی کاربر (بر اساس ایمیل یا آیدی)
app.get('/api/user/search', async (req, res) => {
    const { query } = req.query;
    if (!query) return res.json({ success: false, users: [] });

    try {
        // حذف @ از ابتدای یوزرنیم اگر کاربر وارد کرده بود
        const cleanQuery = query.startsWith('@') ? query.slice(1) : query;
        
        const users = await User.find({
            $or: [
                { email: { $regex: cleanQuery, $options: 'i' } },
                { username: { $regex: cleanQuery, $options: 'i' } },
                { firstName: { $regex: cleanQuery, $options: 'i' } }
            ]
        }).limit(10).select('email firstName username avatar'); // فقط فیلدهای لازم رو بفرست

        res.json({ success: true, users });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
// --- مدیریت چت (Socket.io) ---

// در فایل server.js بخش io.on('connection')
io.on('connection', (socket) => {
    
    // ۱. هر کاربر به محض ورود به اتاق خودش می‌رود
    socket.on('join', (userEmail) => {
        socket.join(userEmail);
        console.log(userEmail + " Joined private room");
    });

    // ۲. اصلاح ارسال پیام شخصی
    socket.on('chatMessage', async (data) => {
        const newMessage = new Message(data); // ذخیره در دیتابیس
        const savedMsg = await newMessage.save();

        // ارسال به فرستنده (خودم)
        socket.emit('message', savedMsg);

        // ارسال به گیرنده (اگر پی‌وی بود)
        if (data.receiver && data.receiver !== "Saved Messages") {
            // پیام فقط به اتاقِ گیرنده فرستاده می‌شود
            io.to(data.receiver).emit('message', savedMsg);
        }
    });

    // ۳. لود کردن پیام‌های دیتابیس (برای اینکه با رفرش پاک نشه)
    socket.on('getOldMessages', async ({ userEmail, otherEmail }) => {
        let query;
        if (!otherEmail || otherEmail === "Saved Messages") {
            query = { sender: userEmail, receiver: "Saved Messages" };
        } else {
            query = {
                $or: [
                    { sender: userEmail, receiver: otherEmail },
                    { sender: otherEmail, receiver: userEmail }
                ]
            };
        }
        const msgs = await Message.find(query).sort({ time: 1 });
        socket.emit('loadHistory', msgs);
    });
});
    socket.on('chatMessage', async (data) => {
        try {
            const newMessage = await Message.create({ ...data, time: new Date() });
            io.emit('message', newMessage);
        } catch (err) { console.log("خطا در ذخیره پیام:", err); }
    });

   socket.on('chatMessage', async (data) => {
    try {
        const newMessage = new Message(data); // فرض بر این است که مدل Message داری
        const savedMsg = await newMessage.save();
        
        // حالا پیام رو با ID دیتابیس به هر دو طرف بفرست
        // فرستادن به فرستنده
        socket.emit('message', savedMsg);
        
        // پیدا کردن سوکتِ گیرنده و فرستادن به او
        // اگر سیستم اتاق (Room) نداری، فعلاً ساده‌ترین راه اینه:
        socket.broadcast.emit('message', savedMsg); 
        
    } catch (err) { console.log(err); }
});

// بخش تیک دوم (Seen)
socket.on('messageSeen', async ({ msgId }) => {
    await Message.findByIdAndUpdate(msgId, { seen: true });
    io.emit('updateTick', msgId); // به همه خبر بده که این پیام سین شد
});
});

app.get('/chat', (req, res) => res.sendFile(path.join(__dirname, '../frontend/chat.html')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, '../frontend/login.html')));

server.listen(3000, '0.0.0.0', () => {
    console.log(`🚀 سرور با امنیت بالا و تاریخچه پروفایل بیدار شد!`);
});