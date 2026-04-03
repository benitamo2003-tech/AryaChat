const socket = io('/', { transports: ['polling', 'websocket'] });

const myEmail = localStorage.getItem("email");
let myName = localStorage.getItem("firstName") || "کاربر"; 
const messageContainer = document.getElementById('messages');
const msgInput = document.getElementById('msg');
const chatTitle = document.getElementById('chat-title');

let activeChat = "Saved Messages"; 
let activeChatType = "private"; 
let currentAvatarIndex = 0;
let userAvatars = [];

// --- شروع کار با لود صفحه ---
//document.addEventListener('DOMContentLoaded', () => {
//    if (!myEmail) { window.location.href = "/login.html"; return; }
    
 //   document.getElementById("profile-email").innerText = myEmail;
 //   loadProfileData(); 
 //   renderConnectedAccounts(); 

 //   if (Notification.permission !== "granted") {
 //       Notification.requestPermission();
 //   }

 //   socket.emit('join', myEmail); 
//    socket.emit('getChatList', myEmail);
 //   socket.emit('getOldMessages', { userEmail: myEmail, otherEmail: "Saved Messages", isGroup: false });
//});
document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem("token");
    const email = localStorage.getItem("email");

    // اگر اطلاعات ناقص بود، سریع بفرستش لاگین و همونجا متوقف شو
    if (!token || !email || token === "undefined") {
        localStorage.clear(); // پاکسازی برای اطمینان
        window.location.href = "/login.html";
        return; 
    }

    // بقیه کدها (socket.emit و ...) فقط وقتی اجرا می‌شه که لاگین معتبر باشه
    socket.emit('join', email);
    socket.emit('getChatList', email);
    // ... بقیه توابع
});
// --- دریافت لیست چت‌ها ---
socket.on('receiveChatList', (list) => {
    const chatListElem = document.getElementById('chat-list');
    if (!chatListElem) return;
    chatListElem.innerHTML = ""; 

    // دکمه ساخت گروه
    const createBtn = document.createElement('div');
    createBtn.innerHTML = `
        <div onclick="openCreateGroup()" style="margin-bottom:10px; padding:12px; background:#048796; color:white; border-radius:10px; text-align:center; cursor:pointer; font-weight:bold; display:flex; align-items:center; justify-content:center; gap:8px;">
            <span>👥</span> ساخت گروه جدید
        </div>`;
    chatListElem.appendChild(createBtn);

    list.forEach(item => updateSidebarUI(item));
});

// --- مدیریت پیام‌ها و نوتیفیکیشن (نسخه اصلاح شده) ---
socket.on('message', (data) => {
    const isMe = data.sender === myEmail;
    const isTarget = (activeChat === data.receiver || activeChat === data.sender);

    if (isTarget) {
        appendMessage(data, isMe ? 'me' : 'other');
        if (!isMe && data._id) {
            socket.emit('messageSeen', { msgId: data._id, sender: data.sender });
        }
    }

    // آپدیت لیست کناری برای آخرین پیام و تعداد سین نشده
    socket.emit('getChatList', myEmail);

    // نوتیفیکیشن فقط برای پیام‌هایی که در چت فعلی نیستند
    if (!isMe && !isTarget) {
        if (Notification.permission === "granted") {
            new Notification(data.senderName || "پیام جدید", {
                body: data.text || "یک فایل ارسال شد",
                icon: 'img/logo.png'
            });
        }
        new Audio('sounds/notify.mp3').play().catch(() => {});
    }
});

function sendMessage() {
    const text = msgInput.value.trim();
    if (!text) return;

    const messageData = {
        sender: myEmail,
        senderName: myName,
        text: text,
        receiver: activeChat, 
        type: activeChatType, 
        time: new Date(),
        seen: false
    };

    socket.emit('chatMessage', messageData);
    msgInput.value = "";
}

function appendMessage(data, side) {
    const div = document.createElement('div');
    div.classList.add('msg', side);
    
    let content = data.fileUrl ? 
        (data.fileType === 'image' ? `<img src="${data.fileUrl}" onclick="viewMedia('${data.fileUrl}')" style="max-width:100%; border-radius:10px; cursor:pointer;">` :
        data.fileType === 'video' ? `<video src="${data.fileUrl}" controls style="max-width:100%; border-radius:10px;"></video>` :
        `<audio src="${data.fileUrl}" controls style="width:100%"></audio>`) :
        `<div class="text">${data.text}</div>`;

    const tickStatus = data.seen ? '✔✔' : '✔';
    const ticks = (side === 'me' && data.type === 'private') ? `<span class="ticks" id="tick-${data._id || data.time}" style="color:${data.seen ? '#4fc3f7':'#ccc'}">${tickStatus}</span>` : '';

    div.innerHTML = `
        <div style="font-size: 10px; opacity: 0.8; margin-bottom:4px;">${data.senderName || data.sender}</div>
        ${content}
        <div style="font-size: 9px; display: flex; justify-content: space-between; margin-top:4px; opacity:0.7;">
            <span>${new Date(data.time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
            ${ticks}
        </div>`;
    messageContainer.appendChild(div);
    messageContainer.scrollTop = messageContainer.scrollHeight;
}

// --- مدیریت پروفایل و ادیت اینفو ---
async function loadProfileData() {
    try {
        const res = await fetch(`/api/user/profile?email=${myEmail}`);
        const data = await res.json();
        if (data.success && data.user) {
            const u = data.user;
            myName = u.firstName || "کاربر";
            document.getElementById('info-username').innerText = u.username ? `@${u.username}` : "بدون آیدی";
            document.getElementById('info-email').innerText = u.email;
            document.getElementById('info-bio').innerText = u.bio || "بیوگرافی خالی است";
            document.getElementById('main-avatar').src = u.avatar || 'img/default-avatar.png';
            document.getElementById('display-name-top').innerText = myName;
            localStorage.setItem("firstName", myName);
        }
    } catch (err) { console.error(err); }
}

async function saveFullProfile() {
    const profileData = {
        email: myEmail,
        username: document.getElementById('edit-username').value.trim(),
        firstName: document.getElementById('edit-fullname').value.trim(),
        bio: document.getElementById('edit-bio').value.trim()
    };

    try {
        const res = await fetch('/api/user/update-full', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(profileData)
        });
        const result = await res.json();
        if(result.success) {
            document.getElementById('edit-modal').style.display = 'none';
            loadProfileData(); 
            alert("تغییرات ذخیره شد ✅");
        } else {
            alert("خطا: آیدی ممکن است تکراری باشد.");
        }
    } catch (err) { alert("ارتباط با سرور قطع است"); }
}

function openEditModal() {
    document.getElementById('edit-modal').style.display = 'flex';
    document.getElementById('edit-fullname').value = myName;
    document.getElementById('edit-username').value = document.getElementById('info-username').innerText.replace('@', '');
    document.getElementById('edit-bio').value = document.getElementById('info-bio').innerText;
}

// --- پنل سمت راست (مشاهده مخاطب) ---
async function openUserInfo() {
    if (activeChat === "Saved Messages") return;
    try {
        const res = await fetch(`/api/user/profile?email=${activeChat}`);
        const data = await res.json();
        if (data.success) {
            const u = data.user;
            document.getElementById('panel-img').src = u.avatar || 'img/default-avatar.png';
            document.getElementById('panel-name').innerText = u.firstName;
            document.getElementById('panel-bio').innerText = u.bio || "بدون بیوگرافی";
            document.getElementById('panel-username').innerText = u.username ? '@' + u.username : u.email;
            document.getElementById('right-panel').classList.add('open');
        }
    } catch (err) { console.error(err); }
}

function closeRightPanel() {
    document.getElementById('right-panel').classList.remove('open');
}

// --- مدیریت چند حسابی ---
// --- مدیریت چند حسابی اصلاح شده ---
function addAccount() {
    // ۱. اطلاعات اکانت فعلی را برای یادآوری ذخیره کن
    const currentAcc = { 
        email: localStorage.getItem("email"), 
        name: localStorage.getItem("firstName"), 
        token: localStorage.getItem("token"),
        avatar: localStorage.getItem("userAvatar") || "img/default-avatar.png"
    };

    let all = JSON.parse(localStorage.getItem("allAccounts") || "[]");
    
    // اگر اکانت فعلی در لیست نبود، اضافه‌اش کن
    if (currentAcc.email && !all.find(a => a.email === currentAcc.email)) {
        all.push(currentAcc);
        localStorage.setItem("allAccounts", JSON.stringify(all));
    }

    // ۲. ست کردن سیگنال و پاک کردن توکن فعلی (بسیار مهم)
    localStorage.setItem("is_adding_new", "true");
    localStorage.removeItem("token"); 
    localStorage.removeItem("email");
    localStorage.removeItem("firstName");

    // ۳. حالا بدون هیچ تداخلی برو به صفحه لاگین
    window.location.href = "/login.html";
}

// ضمناً درDOMContentLoaded این خط را حتماً داشته باش:
socket.on('connect', () => {
    socket.emit('join', myEmail);
    socket.emit('getChatList', myEmail); // به محض وصل شدن لیست را بخواه
});

function logout() {
    let accounts = JSON.parse(localStorage.getItem("allAccounts") || "[]");
    accounts = accounts.filter(acc => acc.email !== myEmail);
    localStorage.setItem("allAccounts", JSON.stringify(accounts));

    if (accounts.length > 0) {
        const next = accounts[0];
        localStorage.setItem("email", next.email);
        localStorage.setItem("firstName", next.name);
        localStorage.setItem("token", next.token);
        location.reload();
    } else {
        localStorage.clear();
        window.location.href = "/login.html";
    }
}

// تابع سوئیچ کردن بین اکانت‌ها
function switchAccount(targetEmail) {
    let all = JSON.parse(localStorage.getItem("allAccounts") || "[]");
    const target = all.find(acc => acc.email === targetEmail);
    
    if (target) {
        // ۱. اطلاعات اکانت فعلی رو قبل از رفتن ذخیره کن که نپره
        saveCurrentAccountData();

        // ۲. اطلاعات اکانت جدید رو جایگزین کن
        localStorage.setItem("token", target.token);
        localStorage.setItem("email", target.email);
        localStorage.setItem("firstName", target.name);
        
        // ۳. رفرش صفحه برای بارگذاری اطلاعات اکانت جدید
        location.reload();
    }
}

// ذخیره اطلاعات فعلی در لیست کلی (برای اینکه قاطی نشه)
function saveCurrentAccountData() {
    const email = localStorage.getItem("email");
    if (!email) return;

    let all = JSON.parse(localStorage.getItem("allAccounts") || "[]");
    const index = all.findIndex(a => a.email === email);
    
    const currentData = {
        email: email,
        name: localStorage.getItem("firstName"),
        token: localStorage.getItem("token"),
        avatar: localStorage.getItem(`avatar_${email}`) // عکس مخصوص همین ایمیل
    };

    if (index > -1) all[index] = currentData;
    else all.push(currentData);
    
    localStorage.setItem("allAccounts", JSON.stringify(all));
}

// نمایش لیست اکانت‌ها در پنل پروفایل
function renderConnectedAccounts() {
    const listDiv = document.getElementById("accounts-list");
    const all = JSON.parse(localStorage.getItem("allAccounts") || "[]");
    const myEmail = localStorage.getItem("email");
    
    listDiv.innerHTML = "";
    if (all.length <= 1) {
        listDiv.innerHTML = "<p style='font-size:11px; color:gray;'>حساب دیگری یافت نشد</p>";
        return;
    }

    all.forEach(acc => {
        if (acc.email === myEmail) return;
        const div = document.createElement("div");
        div.className = "account-item";
        div.innerHTML = `
            <img src="${acc.avatar || 'img/default-avatar.png'}" style="width:30px; height:30px; border-radius:50%;">
            <span>${acc.name}</span>
            <button onclick="switchAccount('${acc.email}')">سوئیچ</button>
        `;
        listDiv.appendChild(div);
    });
}
// --- توابع کمکی ---
function showProfile() {
    const email = localStorage.getItem("email"); // ایمیل اکانت فعلی
    
    document.getElementById('profile-section').style.display = 'block';
    document.getElementById('profile-overlay').style.display = 'block';

    // ۱. لود عکس اصلی مخصوص این ایمیل
    const mainAvatar = localStorage.getItem(`main_avatar_${email}`) || "img/default-avatar.png";
    document.getElementById('main-avatar').src = mainAvatar;

    // ۲. لود نام و بیو مخصوص این ایمیل
    document.getElementById('display-name-top').innerText = localStorage.getItem("firstName") || "کاربر";
    document.getElementById('info-email').innerText = email;

    // ۳. لود گالری عکس‌های مخصوص این ایمیل
    renderAvatarGallery(email);

    // ۴. لود لیست اکانت‌های دیگر برای سوئیچ
    renderConnectedAccounts();
}

function hideProfile() {
    document.getElementById('profile-section').style.display = 'none';
    document.getElementById('profile-overlay').style.display = 'none';
}
function viewMedia(url) { window.open(url, '_blank'); }

// اینتراکشن‌ها
msgInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });
document.querySelector('.chat-header').onclick = openUserInfo;
document.getElementById('main-avatar').onclick = () => openAvatarViewer(myEmail);

// لود تاریخچه پیام‌ها
socket.on('loadHistory', (messages) => {
    messageContainer.innerHTML = messages.length ? "" : `<p style="text-align:center; color:gray; font-size:11px; margin-top:20px;">هنوز پیامی اینجا نیست.</p>`;
    messages.forEach(msg => appendMessage(msg, msg.sender === myEmail ? 'me' : 'other'));
    messageContainer.scrollTop = messageContainer.scrollHeight;
});

// پیدا کردن این تابع و جایگزینی با این نسخه
function updateSidebarUI(item) {
    const list = document.getElementById('chat-list');
    const div = document.createElement('div');
    div.className = 'chat-item';
    // اگر چت فعلی بود، استایل اکتیو بگیرد
    if(activeChat === item.email) div.style.background = "#eef5f6";

    let unreadHtml = (item.unreadCount > 0) ? `<span class="unread-badge" style="background:#048796; color:white; border-radius:12px; padding:2px 8px; font-size:10px; margin-left:5px;">${item.unreadCount}</span>` : "";

    div.innerHTML = `
        <div class="avatar-sm" style="width:40px; height:40px; background:#ddd; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:20px;">
            ${item.email === "Saved Messages" ? "🔖" : "👤"}
        </div>
        <div style="flex:1; overflow:hidden; margin-right:10px; text-align:right;">
            <b style="font-size:14px;">${item.name}</b>
            <div style="font-size:11px; color:gray; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${item.lastMsg}</div>
        </div>
        ${unreadHtml}`;

    div.onclick = () => {
        activeChat = item.email;
        activeChatType = item.type;
        chatTitle.innerText = item.name;
        messageContainer.innerHTML = "";
        socket.emit('markAllAsSeen', { myEmail, partnerEmail: item.email });
        socket.emit('getOldMessages', { userEmail: myEmail, otherEmail: item.email, isGroup: false });
        // هایلایت کردن آیتم انتخاب شده
        document.querySelectorAll('.chat-item').forEach(el => el.style.background = "none");
        div.style.background = "#eef5f6";
    };
    list.appendChild(div);
}

// این لیسنر را هم اضافه کن که وقتی پیام جدید می‌آید لیست آپدیت شود
socket.on('requestChatListUpdate', () => {
    socket.emit('getChatList', myEmail);
});

// --- بخش مدیریت آپلود عکس پروفایل ---

function setupAvatarUpload() {
    const avatarInput = document.createElement('input');
    avatarInput.type = 'file';
    avatarInput.id = 'avatarInput';
    avatarInput.accept = 'image/*';
    avatarInput.style.display = 'none';
    document.body.appendChild(avatarInput);

    // وقتی روی عکس پروفایل در پنل کلیک می‌کنی، پنجره انتخاب فایل باز شود
    const profileImg = document.getElementById('main-avatar');
    if (profileImg) {
        profileImg.onclick = () => {
            // به جای باز کردن مستقیم انتخاب فایل، گالری داخلی اپلیکیشن را نشان بده
            // کاربر از داخل گالری اپلیکیشن می‌تواند دکمه "افزودن" (که همان input.click است) را بزند
            const email = localStorage.getItem("email");
            renderAvatarGallery(email); 
            // حالا کاربر لیست عکس‌ها را می‌بیند و می‌تواند حذف کند یا عکس جدید اضافه کند
        };
    }

    avatarInput.onchange = async function(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async function() {
            const base64Image = reader.result;

            try {
                const response = await fetch('/api/user/update-avatar', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        email: localStorage.getItem("email"), 
                        avatar: base64Image 
                    })
                });

                const data = await response.json();
                if (data.success) {
                    localStorage.setItem("userAvatar", base64Image);
                    // آپدیت آنی عکس در صفحه
                    if(document.getElementById('main-avatar')) document.getElementById('main-avatar').src = base64Image;
                    alert("عکس پروفایل با موفقیت تغییر کرد!");
                }
            } catch (err) {
                console.error("Avatar Upload Error:", err);
                alert("خطا در ارتباط با سرور");
            }
        };
        reader.readAsDataURL(file);
    };
}

// صدا زدن تابع در ابتدای لود شدن صفحه چت
setupAvatarUpload();

async function deleteAvatar(photoIndex) {
    const email = localStorage.getItem("email");
    try {
        const res = await fetch('/api/user/delete-avatar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, photoIndex })
        });
        const data = await res.json();
        if (data.success) {
            alert("عکس حذف شد");
            location.reload(); // یا آپدیت کردن گالری
        }
    } catch (err) { console.error(err); }
}

// موقع نمایش پروفایل، عکس‌های مخصوص این کاربر رو لود کن
function loadUserAvatars(user) {
    const gallery = document.getElementById("avatar-gallery");
    gallery.innerHTML = "";
    
    // فرض بر اینه که سرور آرایه‌ای از عکس‌ها رو در user.avatarHistory برمی‌گردونه
    if (user.avatarHistory && user.avatarHistory.length > 0) {
        user.avatarHistory.forEach((imgSrc, index) => {
            const div = document.createElement("div");
            div.style = "position:relative;";
            div.innerHTML = `
                <img src="${imgSrc}" style="width:50px; height:50px; border-radius:5px; object-fit:cover;">
                <button onclick="deleteAvatar(${index})" style="position:absolute; top:0; right:0; background:red; color:white; border:none; border-radius:50%; width:15px; height:15px; font-size:10px; cursor:pointer;">×</button>
            `;
            gallery.appendChild(div);
        });
    }
}


// جلوگیری از راست‌کلیک فقط روی عکس‌های پروفایل
document.addEventListener('contextmenu', function(e) {
    if (e.target.classList.contains('protected-avatar') || e.target.closest('.avatar-container')) {
        e.preventDefault();
        return false;
    }
}, false);