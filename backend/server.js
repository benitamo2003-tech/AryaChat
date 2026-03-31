const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
require('dotenv').config({ path: path.join(__dirname, '.env') });

// رمز مخفی برای امضای توکن‌ها (ثابت و مطمئن)
const JWT_SECRET = "AryaSuperSecretKey2026"; 

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// --- تنظیمات دیتابیس آنلاین (Atlas) ---
// --- تنظیمات دیتابیس محلی (Local) ---
const MONGO_URI = "mongodb://127.0.0.1:27017/AryaChatDB"; 

mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ ایول! دیتابیس محلی (Local) با موفقیت وصل شد'))
  .catch(err => {
    console.error('❌ خطا در اتصال دیتابیس محلی:', err.message);
    console.log("نکته: مطمئن شو اون پنجره سیاه (mongod.exe) بازه.");
  });

// مدل کاربر
const User = mongoose.model('User', new mongoose.Schema({
    email: { type: String, unique: true, required: true },
    firstName: String,
    lastName: String,
    avatar: { type: String, default: 'default-avatar.png' },
    createdAt: { type: Date, default: Date.now }
}));

// حافظه موقت برای کدهای OTP
const otpStore = new Map();

// تنظیمات سرویس ارسال ایمیل
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
        user: 'benitamo2003@gmail.com',
        pass: 'izaljwlkmrkonlib'
    }
});

// --- مسیرهای احراز هویت ---

// ۱. ارسال کد تایید به ایمیل
app.post('/api/auth/send-code', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: "ایمیل الزامی است" });

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    otpStore.set(email, code);

    try {
        await transporter.sendMail({
            from: '"AryaChat" <benitamo2003@gmail.com>',
            to: email,
            subject: 'کد تایید آریا چت',
            html: `<div style="direction:rtl; text-align:center; font-family:tahoma;">
                    <h2>خوش آمدید!</h2>
                    <p>کد تایید شما برای ورود به آریا چت:</p>
                    <h1 style="color:#048896; letter-spacing: 5px;">${code}</h1>
                   </div>`
        });
        console.log(`✉️ کد برای ${email} ارسال شد: ${code}`);
        res.json({ success: true });
    } catch (err) {
        console.error("❌ خطا در ارسال ایمیل:", err.message);
        res.status(500).json({ success: false, message: "خطا در ارسال ایمیل" });
    }
});

// ۲. تایید کد و بررسی وضعیت کاربر
app.post('/api/auth/verify-code', async (req, res) => {
    const { email, code } = req.body;
    const savedCode = otpStore.get(email);

    if (!savedCode || String(savedCode).trim() !== String(code).trim()) {
        return res.status(401).json({ success: false, message: 'کد اشتباه است' });
    }

    const token = jwt.sign({ email }, JWT_SECRET, { expiresIn: '30d' });
    otpStore.delete(email);

    try {
        // جستجوی کاربر با محدودیت زمانی برای شبکه شرکت
        const user = await User.findOne({ email }).maxTimeMS(2500); 
        
        if (user) {
            res.json({ success: true, newUser: false, user, token });
        } else {
            res.json({ success: true, newUser: true, token });
        }
    } catch (err) {
        console.log("⚠️ دیتابیس در دسترس نیست، ورود در حالت آفلاین...");
        res.json({ success: true, newUser: true, token, offline: true });
    }
});

// ۳. ثبت‌نام نهایی (با قابلیت عبور از سد دیتابیس شرکت)
app.post('/api/auth/complete-signup', async (req, res) => {
    const { email, firstName, lastName } = req.body;
    
    // ۱. تولید توکن (حتی قبل از ذخیره در دیتابیس)
    const token = jwt.sign({ email }, JWT_SECRET, { expiresIn: '30d' });

    try {
        // ۲. تلاش برای ذخیره با زمان انتظار خیلی کم (فقط ۱ ثانیه)
        await User.findOneAndUpdate(
            { email },
            { firstName, lastName },
            { upsert: true }
        ).maxTimeMS(1000); 

        console.log("✅ ذخیره شد");
        res.json({ success: true, token });

    } catch (err) {
        // ۳. اگر دیتابیس شرکت باز هم اذیت کرد، باز هم اجازه ورود بده
        console.log("⚠️ عبور اضطراری بدون دیتابیس");
        res.json({ success: true, token, offline: true });
    }
});

// مدل پیام‌ها
const Message = mongoose.model('Message', new mongoose.Schema({
    sender: String,
    receiver: String,
    text: String,
    fileUrl: String,   // برای عکس و فیلم
    fileType: String,  // image, video, audio
    time: { type: Date, default: Date.now }
}));

// اصلاح بخش سوکت برای ذخیره و ارسال پیام
io.on('connection', (socket) => {
    socket.on('chatMessage', async (data) => {
        try {
            // ذخیره در دیتابیس محلی
            const newMessage = await Message.create(data);
            // فرستادن به همه (فعلاً) - بعداً خصوصی‌ش می‌کنیم
            io.emit('message', newMessage); 
        } catch (err) {
            console.log("خطا در ذخیره پیام:", err);
        }
    });

    // فرستادن پیام‌های قدیمی به محض ورود به چت
    socket.on('getOldMessages', async () => {
        const oldMessages = await Message.find().sort({ time: 1 }).limit(50);
        socket.emit('loadOldMessages', oldMessages);
    });
});
// --- مسیرهای صفحات ---
app.get('/chat', (req, res) => res.sendFile(path.join(__dirname, '../frontend/chat.html')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, '../frontend/login.html')));

// اجرا روی پورت ۳۰۰۰ و آی‌پی عمومی برای دسترسی در شبکه داخلی
server.listen(3000, '0.0.0.0', () => {
    console.log(`🚀 سرور آریا چت بیدار شد!`);
    console.log(`🌐 آدرس محلی: http://localhost:3000`);
});