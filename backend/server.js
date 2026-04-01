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

// ۱. تنظیمات حجم برای فایل‌های سنگین
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

// --- مدل کاربر ---
const User = mongoose.model('User', new mongoose.Schema({
    email: { type: String, unique: true, required: true },
    firstName: String,
    username: { type: String, unique: true, sparse: true, default: undefined }, 
    bio: { type: String, maxlength: 100 },
    birthDate: String,
    avatar: { type: String, default: 'img/default-avatar.png' },
    avatarHistory: [String]
}));

// --- مدل گروه (جدید) ---
const Group = mongoose.model('Group', new mongoose.Schema({
    name: String,
    creator: String,
    inviteCode: { type: String, unique: true },
    members: [String], // لیست ایمیل اعضا
    avatar: { type: String, default: 'img/group-default.png' },
    createdAt: { type: Date, default: Date.now }
}));

// --- مدل پیام (آپدیت شده برای گروه) ---
const Message = mongoose.model('Message', new mongoose.Schema({
    sender: String,
    senderName: String,
    receiver: String, // می‌تواند ایمیل شخص یا ID گروه باشد
    text: String,
    fileUrl: String, 
    fileType: String, 
    type: { type: String, default: 'private' }, // private, group, saved
    seen: { type: Boolean, default: false },
    time: { type: Date, default: Date.now }
}));

const otpStore = new Map();
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com', port: 465, secure: true,
    auth: { user: 'benitamo2003@gmail.com', pass: 'izaljwlkmrkonlib' }
});

// --- API های احراز هویت و پروفایل (بدون تغییر) ---

app.post('/api/auth/send-code', async (req, res) => {
    const { email } = req.body;
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    otpStore.set(email, code);
    try {
        await transporter.sendMail({
            from: '"AryaChat" <benitamo2003@gmail.com>',
            to: email, subject: 'کد تایید آریا چت',
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

app.get('/api/user/profile', async (req, res) => {
    try {
        const user = await User.findOne({ email: req.query.email });
        res.json({ success: true, user });
    } catch (err) { res.status(500).json({ success: false }); }
});

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

app.post('/api/user/update-avatar', async (req, res) => {
    const { email, avatar } = req.body;
    try {
        const user = await User.findOne({ email });
        if (user) {
            const oldAvatar = user.avatar;
            const update = (oldAvatar && oldAvatar !== 'img/default-avatar.png') 
                ? { avatar, $push: { avatarHistory: { $each: [oldAvatar], $position: 0 } } }
                : { avatar };
            await User.findOneAndUpdate({ email }, update);
            res.json({ success: true });
        }
    } catch (err) { res.status(500).json({ success: false }); }
});

app.get('/api/user/search', async (req, res) => {
    const { query } = req.query;
    if (!query) return res.json({ success: false, users: [] });
    try {
        const cleanQuery = query.startsWith('@') ? query.slice(1) : query;
        const users = await User.find({
            $or: [
                { email: { $regex: cleanQuery, $options: 'i' } },
                { username: { $regex: cleanQuery, $options: 'i' } },
                { firstName: { $regex: cleanQuery, $options: 'i' } }
            ]
        }).limit(10).select('email firstName username avatar');
        res.json({ success: true, users });
    } catch (err) { res.status(500).json({ success: false }); }
});

// --- API های جدید گروه ---

app.post('/api/groups/create', async (req, res) => {
    const { name, creator, members } = req.body;
    const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    try {
        const newGroup = new Group({ name, creator, members: [creator, ...members], inviteCode });
        await newGroup.save();
        res.json({ success: true, group: newGroup });
    } catch (err) { res.status(500).json({ success: false }); }
});

app.get('/api/groups/join/:code', async (req, res) => {
    const { code } = req.params;
    const email = req.query.email;
    try {
        const group = await Group.findOne({ inviteCode: code });
        if (!group) return res.status(404).json({ success: false, message: "کد نامعتبر" });
        if (!group.members.includes(email)) {
            await Group.updateOne({ inviteCode: code }, { $push: { members: email } });
        }
        res.redirect('/chat');
    } catch (err) { res.status(500).send("خطای سرور"); }
});

// --- مدیریت چت (Socket.io) ---

io.on('connection', (socket) => {
    
    socket.on('join', (userEmail) => {
        socket.join(userEmail);
        console.log(`👤 ${userEmail} Connected`);
    });

    socket.on('joinGroup', (groupId) => {
        socket.join(groupId);
        console.log(`👥 Joined Group: ${groupId}`);
    });

    
    socket.on('chatMessage', async (data) => {
        try {
            const newMessage = new Message(data);
            const savedMsg = await newMessage.save();

            if (data.type === 'group') {
                io.to(data.receiver).emit('message', savedMsg);
            } else {
                // ارسال به خودم (فرستنده)
                socket.emit('message', savedMsg);
                
                // ارسال به گیرنده
                if (data.receiver && data.receiver !== "Saved Messages") {
                    io.to(data.receiver).emit('message', savedMsg);
                    
                    // --- فیکس آپدیت لیست ---
                    // به گیرنده می‌گیم لیست چت‌هات رو بروز کن تا نام فرستنده بیاد بالا
                    io.to(data.receiver).emit('requestChatListUpdate'); 
                }
            }
            // به خود فرستنده هم می‌گیم لیستش رو بروز کنه
            socket.emit('requestChatListUpdate');

        } catch (err) { console.log(err); }
    });


    socket.on('getOldMessages', async ({ userEmail, otherEmail, isGroup }) => {
        try {
            let query = isGroup 
                ? { receiver: otherEmail, type: 'group' }
                : (!otherEmail || otherEmail === "Saved Messages")
                    ? { sender: userEmail, receiver: "Saved Messages" }
                    : { $or: [{ sender: userEmail, receiver: otherEmail }, { sender: otherEmail, receiver: userEmail }], type: 'private' };
            
            const msgs = await Message.find(query).sort({ time: 1 });
            socket.emit('loadHistory', msgs);
        } catch (err) { console.log(err); }
    });

    socket.on('messageSeen', async ({ msgId, sender }) => {
        try {
            const msg = await Message.findByIdAndUpdate(msgId, { seen: true }, { new: true });
            if (msg) {
                // خبر دادن به فرستنده که تیک رو آبی کن
                io.to(msg.sender).emit('updateTick', msgId);
                // خبر دادن به گیرنده (خودم) که تیک رو در صفحه خودش هم آبی ببینه
                io.to(msg.receiver).emit('updateTick', msgId);
            }
        } catch (err) { console.log(err); }
    });

    socket.on('getChatList', async (email) => {
    try {
        const myGroups = await Group.find({ members: email });
        // پیدا کردن تمام پیام‌های شخصی من
        const allPrivateMsgs = await Message.find({
            $or: [{ sender: email }, { receiver: email }],
            receiver: { $ne: "Saved Messages" },
            type: 'private'
        }).sort({ time: -1 });

        const chatPartners = {};
        for (const m of allPrivateMsgs) {
            const partner = (m.sender === email) ? m.receiver : m.sender;
            if (!chatPartners[partner]) {
                // --- بخش جدید: شمارش پیام‌های سین نشده ---
                const unreadCount = await Message.countDocuments({
                    sender: partner,
                    receiver: email,
                    seen: false
                });

                chatPartners[partner] = { 
                    email: partner, 
                    lastMsg: m.text || "فایل", 
                    name: (m.sender === email ? "مخاطب" : m.senderName),
                    type: 'private',
                    unreadCount: unreadCount // اضافه کردن تعداد به لیست
                };
            }
        }
        socket.on('markAllAsSeen', async ({ myEmail, partnerEmail }) => {
    try {
        // تمام پیام‌هایی که از طرف مقابل به من رسیده رو به Seen تبدیل کن
        await Message.updateMany(
            { sender: partnerEmail, receiver: myEmail, seen: false },
            { $set: { seen: true } }
        );
        // حالا لیست جدید رو بفرست تا عدد صفر بشه
        socket.emit('requestChatListUpdate'); 
        io.to(partnerEmail).emit('updateAllTicks'); // تیک‌های طرف مقابل رو هم دوتا کن
    } catch (err) { console.log(err); }
});
        // ارسال لیست نهایی
        socket.emit('receiveChatList', [...Object.values(chatPartners)]);
    } catch (err) { console.log(err); }
    });

    socket.on('disconnect', () => { console.log('❌ Disconnected'); });
});

// مسیرهای نهایی
app.get('/chat', (req, res) => res.sendFile(path.join(__dirname, '../frontend/chat.html')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, '../frontend/login.html')));

server.listen(3000, '0.0.0.0', () => {
    console.log(`🚀 سرور آریا چت (با قابلیت گروه) روی پورت 3000 بیدار شد!`);
});