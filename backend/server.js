require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
const nodemailer = require("nodemailer");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "../frontend")));

// اتصال به دیتابیس
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("✅ MongoDB Connected"))
    .catch(err => console.error("❌ DB Connection Error:", err));

// مدل کاربر
const User = mongoose.model("User", new mongoose.Schema({
    email: { type: String, unique: true },
    firstName: String,
    lastName: String,
    createdAt: { type: Date, default: Date.now }
}));

const otpStore = new Map();
const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: "benitamo2003@gmail.com", pass: "izaljwlkmrkonlib" }
});

// مسیر ارسال کد
app.post("/api/auth/send-code", async (req, res) => {
    const { email } = req.body;
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    otpStore.set(email, code);
    
    try {
        await transporter.sendMail({
            from: '"AryaChat" <benitamo2003@gmail.com>',
            to: email,
            subject: "کد تایید آریا چت",
            text: `کد تایید شما: ${code}`
        });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false }); }
});

// مسیر تایید کد
app.post("/api/auth/verify-code", async (req, res) => {
    const { email, code } = req.body;
    if (otpStore.get(email) !== code) return res.status(401).json({ success: false, message: "کد نامعتبر" });

    try {
        const user = await User.findOne({ email });
        const token = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: "30d" });
        otpStore.delete(email);

        if (user) {
            res.json({ success: true, newUser: false, user, token });
        } else {
            res.json({ success: true, newUser: true });
        }
    } catch (e) { res.status(500).json({ success: false }); }
});

// مسیر تکمیل ثبت نام
app.post("/api/auth/complete-signup", async (req, res) => {
    const { email, firstName, lastName } = req.body;
    try {
        const user = await User.create({ email, firstName, lastName });
        const token = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: "30d" });
        res.json({ success: true, user, token });
    } catch (e) { res.status(500).json({ success: false }); }
});

// روت‌های صفحات
app.get("*", (req, res) => {
    if (req.path === "/chat") return res.sendFile(path.join(__dirname, "../frontend/chat.html"));
    res.sendFile(path.join(__dirname, "../frontend/login.html"));
});

app.listen(3000, () => console.log("🚀 Server: http://localhost:3000"));