const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// --- تنظیمات دیتابیس ---
// استفاده از دیتابیس محلی (Local) برای دور زدن مشکل آی‌پی و مودم
const MONGO_URI = "mongodb://127.0.0.1:27017/AryaChatDB";

mongoose.connect(MONGO_URI)
    .then(() => console.log('✅ تبریک! به دیتابیس محلی وصل شدیم. مشکل شبکه حل شد.'))
    .catch(err => {
        console.error('❌ دیتابیس محلی هم وصل نشد. مطمئن شو MongoDB روی ویندوزت بازه.');
    });
// مدل کاربر
const User = mongoose.model('User', new mongoose.Schema({
    email: { type: String, unique: true },
    firstName: String,
    lastName: String,
    avatar: String,
    createdAt: { type: Date, default: Date.now }
}));

// حافظه موقت کدها
const otpStore = new Map();

// تنظیمات ایمیل
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true, // استفاده از SSL برای پورت 465
    auth: {
        user: 'benitamo2003@gmail.com',
        pass: 'izaljwlkmrkonlib'
    }
});

// --- مسیرهای احراز هویت (Auth Routes) ---

// ۱. ارسال کد
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

// ۲. تایید کد و چک کردن کاربر
app.post('/api/auth/verify-code', async (req, res) => {
    const { email, code } = req.body;
    const savedCode = otpStore.get(email);

    if (!savedCode || String(savedCode).trim() !== String(code).trim()) {
        return res.status(401).json({ success: false, message: 'کد اشتباه است' });
    }

    // --- بخش اصلاح شده برای عبور از سد دیتابیس ---
    try {
        const token = jwt.sign({ email }, JWT_SECRET, { expiresIn: '30d' });
        otpStore.delete(email);

        // تلاش برای پیدا کردن کاربر، اگر ارور داد یا نبود، مستقیم برو برای ثبت‌نام
        let user = null;
        try {
            user = await User.findOne({ email });
        } catch (dbErr) {
            console.log("⚠️ دیتابیس هنوز وصل نیست، اما اجازه ورود صادر شد.");
        }

        if (user) {
            res.json({ success: true, newUser: false, user, token });
        } else {
            // اگر کاربر پیدا نشد یا دیتابیس قطع بود، بفرستش مرحله ثبت نام
            res.json({ success: true, newUser: true, token });
        }
    } catch (err) {
        res.status(500).json({ success: false });
    }
});
// ۳. ثبت‌نام نهایی
app.post('/api/auth/complete-signup', async (req, res) => {
    const { email, firstName, lastName } = req.body;
    try {
        const user = await User.create({ email, firstName, lastName });
        const token = jwt.sign({ email }, JWT_SECRET, { expiresIn: '30d' });
        res.json({ success: true, user, token });
    } catch (err) { res.status(500).json({ success: false }); }
});

// مسیرهای صفحات
app.get('/chat', (req, res) => res.sendFile(path.join(__dirname, '../frontend/chat.html')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, '../frontend/login.html')));

server.listen(3000, '0.0.0.0', () => {
    console.log(`🚀 سرور با موفقیت روی http://localhost:3000 اجرا شد`);
});