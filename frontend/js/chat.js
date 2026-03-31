const socket = io('/', { transports: ['polling', 'websocket'] });

const myEmail = localStorage.getItem("email");
let myName = localStorage.getItem("firstName") || "کاربر"; 
const messageContainer = document.getElementById('messages');
const msgInput = document.getElementById('msg');
const chatTitle = document.getElementById('chat-title');
const statusText = document.getElementById('status');

let activeChat = "Saved Messages"; 
let currentAvatarIndex = 0;
let userAvatars = [];

document.addEventListener('DOMContentLoaded', () => {
    if (!myEmail) { window.location.href = "/login.html"; return; }
    
    document.getElementById("profile-email").innerText = myEmail;
    loadProfileData(); 
    renderConnectedAccounts(); // نمایش لیست اکانت‌ها برای سوییچ

    if (Notification.permission !== "granted") {
        Notification.requestPermission();
    }

    // ارسال ایمیل به سرور برای لود اختصاصی پیام‌های همین کاربر
    socket.emit('getOldMessages', { userEmail: myEmail });

    // کلیک روی عکس اصلی پروفایل
    document.getElementById('main-avatar').onclick = () => openAvatarViewer(myEmail);
});

// --- مدیریت اکانت و پروفایل ---

// تابع کمکی برای اینکه مطمئن شویم اکانت فعلی همیشه در لیست ذخیره است
function syncCurrentAccount() {
    let accounts = JSON.parse(localStorage.getItem("allAccounts") || "[]");
    const currentAcc = {
        email: myEmail,
        name: myName,
        avatar: document.getElementById('main-avatar').src,
        token: localStorage.getItem("token")
    };
    const index = accounts.findIndex(a => a.email === myEmail);
    if (index === -1) {
        accounts.push(currentAcc);
    } else {
        accounts[index] = currentAcc;
    }
    localStorage.setItem("allAccounts", JSON.stringify(accounts));
}

function addAccount() {
    syncCurrentAccount(); // قبل از رفتن به لاگین جدید، اکانت فعلی رو ذخیره کن
    
    localStorage.removeItem("token");
    localStorage.removeItem("email");
    window.location.href = "/login.html";
}

function renderConnectedAccounts() {
    syncCurrentAccount(); // آپدیت لیست با اطلاعات آخرین اکانت فعال
    
    const accounts = JSON.parse(localStorage.getItem("allAccounts") || "[]");
    const container = document.getElementById('accounts-list'); 
    if (!container) return;

    container.innerHTML = "<h4 style='margin-bottom:10px; font-size:14px; border-bottom:1px solid #ddd; padding-bottom:5px;'>مدیریت حساب‌ها</h4>";
    
    accounts.forEach(acc => {
        const isActive = acc.email === myEmail;
        const div = document.createElement('div');
        div.style = `display:flex; align-items:center; gap:10px; margin-bottom:8px; padding:8px; border-radius:10px; transition: 0.3s; ${isActive ? 'background:#e3f2fd; border:1px solid #2196f3;' : 'background:#f8f9fa;'}`;
        
        div.innerHTML = `
            <img src="${acc.avatar}" style="width:35px; height:35px; border-radius:50%; object-fit:cover; border:1px solid #ccc;">
            <div style="flex:1; font-size:12px;">
                <b style="display:block; color:#333;">${acc.name}</b>
                <span style="color:#777; font-size:10px;">${acc.email}</span>
            </div>
            ${isActive ? 
                '<span style="background:#4caf50; color:white; font-size:9px; padding:2px 6px; border-radius:10px;">فعال</span>' : 
                `<button onclick="switchAccount('${acc.email}')" style="background:#2196f3; color:white; border:none; padding:4px 10px; border-radius:5px; cursor:pointer; font-size:11px;">ورود</button>`
            }
        `;
        container.appendChild(div);
    });
}

function switchAccount(email) {
    syncCurrentAccount(); // اول وضعیت اکانت فعلی (مثلا علی) رو ذخیره کن که غیب نشه

    const accounts = JSON.parse(localStorage.getItem("allAccounts") || "[]");
    const target = accounts.find(a => a.email === email);
    if(target) {
        localStorage.setItem("email", target.email);
        localStorage.setItem("firstName", target.name);
        localStorage.setItem("token", target.token);
        location.reload(); 
    }
}

function showProfile() {
    document.getElementById('profile-section').style.display = 'block';
}

function hideProfile() {
    document.getElementById('profile-section').style.display = 'none';
}

// باز کردن نمایشگر عکس (هوشمند)
async function openAvatarViewer(targetEmail) {
    try {
        const res = await fetch(`/api/user/profile?email=${targetEmail}`);
        const data = await res.json();
        
        if (data.success && data.user) {
            userAvatars = [data.user.avatar];
            if(data.user.avatarHistory) userAvatars = userAvatars.concat(data.user.avatarHistory);
            
            currentAvatarIndex = 0;
            updateViewerDisplay();
            
            // نمایش دکمه‌های حذف و ذخیره فقط برای صاحب حساب
            const ownerTools = document.getElementById('owner-tools');
            if (ownerTools) {
                ownerTools.style.display = (targetEmail === myEmail) ? 'flex' : 'none';
            }

            document.getElementById('avatar-viewer').style.display = 'flex';
            
            // قفل اسکرین‌شات فقط وقتی که داریم پروفایل کسی دیگه رو می‌بینیم
            document.removeEventListener('keyup', preventCapture);
            if (targetEmail !== myEmail) {
                document.addEventListener('keyup', preventCapture);
            }
        }
    } catch (err) { console.error(err); }
}

function updateViewerDisplay() {
    const img = document.getElementById('full-res-avatar');
    img.src = userAvatars[currentAvatarIndex];
    document.getElementById('avatar-counter').innerText = `${currentAvatarIndex + 1} از ${userAvatars.length}`;
}

function nextAvatar() {
    if (currentAvatarIndex < userAvatars.length - 1) {
        currentAvatarIndex++;
        updateViewerDisplay();
    }
}

function prevAvatar() {
    if (currentAvatarIndex > 0) {
        currentAvatarIndex--;
        updateViewerDisplay();
    }
}

function closeAvatarViewer() {
    document.getElementById('avatar-viewer').style.display = 'none';
    document.removeEventListener('keyup', preventCapture);
}

function downloadCurrentAvatar() {
    const url = userAvatars[currentAvatarIndex];
    const a = document.createElement('a');
    a.href = url;
    a.download = `AryaChat-Profile.png`;
    a.click();
}

function preventCapture(e) {
    if (e.key === 'PrintScreen' || (e.ctrlKey && e.key === 's')) {
        navigator.clipboard.writeText(""); 
        alert("⚠️ محافظت امنیتی: امکان اسکرین‌شات از پروفایل دیگران وجود ندارد.");
    }
}

// بارگذاری اطلاعات
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
            if(u.birthDate) checkBirthday(u.birthDate);
            
            // بروزرسانی آواتار در لیست اکانت‌ها
            updateAccountListInfo(u.avatar, myName);
        }
    } catch (err) { console.error("خطا در لود پروفایل:", err); }
}

function updateAccountListInfo(avatar, name) {
    let accounts = JSON.parse(localStorage.getItem("allAccounts") || "[]");
    const idx = accounts.findIndex(a => a.email === myEmail);
    if(idx !== -1) {
        accounts[idx].avatar = avatar;
        accounts[idx].name = name;
        localStorage.setItem("allAccounts", JSON.stringify(accounts));
    }
}

async function saveFullProfile() {
    const profileData = {
        email: myEmail,
        username: document.getElementById('edit-username').value.trim(),
        firstName: document.getElementById('edit-fullname').value.trim(),
        bio: document.getElementById('edit-bio').value.trim(),
        birthDate: document.getElementById('edit-birth').value
    };

    const res = await fetch('/api/user/update-full', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileData)
    });
    
    const result = await res.json();
    if(result.success) {
        document.getElementById('edit-modal').style.display = 'none';
        loadProfileData();
    } else {
        alert("خطا: آیدی تکراری است یا مشکلی پیش آمده.");
    }
}

function uploadAvatar(input) {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function(e) {
        const base64 = e.target.result;
        const res = await fetch('/api/user/update-avatar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: myEmail, avatar: base64 })
        });
        if((await res.json()).success) {
            loadProfileData();
        }
    };
    reader.readAsDataURL(file);
}

async function deleteAvatar() {
    if(!confirm("آیا از حذف این عکس پروفایل مطمئن هستید؟")) return;
    const res = await fetch('/api/user/delete-avatar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: myEmail })
    });
    if((await res.json()).success) {
        loadProfileData();
        closeAvatarViewer();
    }
}
// باز کردن مودال ویرایش
function openEditModal() {
    const modal = document.getElementById('edit-modal');
    if (modal) {
        modal.style.display = 'flex';
        // پر کردن مقادیر فعلی
        document.getElementById('edit-fullname').value = myName;
        // گرفتن یوزرنیم از متن (بدون @)
        const currentUser = document.getElementById('info-username').innerText.replace('@', '');
        document.getElementById('edit-username').value = currentUser === "بدون آیدی" ? "" : currentUser;
        
        const currentBio = document.getElementById('info-bio').innerText;
        document.getElementById('edit-bio').value = currentBio === "بیوگرافی خالی است" ? "" : currentBio;
    }
}

// فعال کردن کلیک روی متن‌ها برای ویرایش
document.getElementById('info-username').onclick = openEditModal;
document.getElementById('info-bio').onclick = openEditModal;
document.getElementById('info-username').style.cursor = "pointer";
document.getElementById('info-bio').style.cursor = "pointer";

// بستن مودال
function closeEditModal() {
    document.getElementById('edit-modal').style.display = 'none';
}

// قابلیت کلیک روی اطلاعات پروفایل برای ویرایش سریع
document.getElementById('info-username').onclick = openEditModal;
document.getElementById('info-bio').onclick = openEditModal;
document.getElementById('info-email').onclick = () => alert("ایمیل قابل تغییر نیست، اما می‌توانید بقیه مشخصات را ویرایش کنید.");

// جستجوی لحظه‌ای (بدون نیاز به دکمه)
document.getElementById('search-input').addEventListener('input', async (e) => {
    const query = e.target.value.trim();
    const container = document.getElementById('search-results');
    
    if (query.length < 2) { 
        container.innerHTML = ""; 
        return; 
    }

    try {
        const res = await fetch(`/api/user/search?query=${query}`);
        const data = await res.json();

        container.innerHTML = ""; 

        if (data.success && data.users && data.users.length > 0) {
            data.users.forEach(u => {
                const div = document.createElement('div');
                div.className = 'search-item';
                div.style = "display:flex; align-items:center; gap:10px; padding:10px; cursor:pointer; background:#fff; border-bottom:1px solid #eee; transition:0.2s;";
                
                // وقتی روی کاربر کلیک شد، چت با او باز شود
                div.onclick = () => startChatWith(u);
                
                div.innerHTML = `
                    <img src="${u.avatar || 'img/default-avatar.png'}" style="width:40px; height:40px; border-radius:50%; object-fit:cover;">
                    <div style="flex:1">
                        <div style="font-weight:bold; font-size:14px; color:#333;">${u.firstName}</div>
                        <div style="font-size:11px; color:#048896;">${u.username ? '@' + u.username : u.email}</div>
                    </div>
                `;
                container.appendChild(div);
            });
        }
    } catch (err) {
        console.error("Search Error:", err);
    }
});

// تابع برای شروع چت با کاربر پیدا شده
function startChatWith(user) {
    activeChat = user.email; // ایمیل طرف مقابل می‌شود آیدی چت
    chatTitle.innerText = user.firstName;
    document.getElementById('search-results').innerHTML = ""; // بستن نتایج سرچ
    document.getElementById('search-input').value = ""; // پاک کردن فیلد سرچ
    
    // لود پیام‌های قدیمی با این شخص خاص (باید در سرور تعریف شده باشد)
    messageContainer.innerHTML = `<p style="text-align:center; color:gray; font-size:12px;">شروع گفتگو با ${user.firstName}</p>`;
    socket.emit('getPrivateMessages', { me: myEmail, other: user.email });
}

// --- مدیریت پیام‌ها و سیستم چت ---

socket.on('loadOldMessages', (messages) => {
    messageContainer.innerHTML = ""; 
    messages.forEach(msg => {
        const side = msg.sender === myEmail ? 'me' : 'other';
        appendMessage(msg, side);
    });
});

function sendMessage() {
    const text = msgInput.value.trim();
    if (!text) return;

    const messageData = {
        sender: myEmail,
        senderName: myName,
        text: text,
        receiver: activeChat, // این خیلی مهمه! اگه تو پی‌وی باشی، ایمیل طرفه
        type: 'text',
        time: new Date(),
        seen: false
    };

    // فقط پیام رو به سرور بفرست، خودت دستی append نکن 
    // اجازه بده سوکت پیام رو برگردونه تا مطمئن بشیم ثبت شده
    socket.emit('chatMessage', messageData);
    msgInput.value = "";
}

// تابعی برای اضافه کردن مخاطب به لیست سمت راست (Sidebar)
function addToChatList(userEmail, userName, userAvatar) {
    const listContainer = document.getElementById('chat-list'); // مطمئن شو این ID در HTML هست
    
    // اگر قبلاً در لیست بود، دوباره اضافه نکن
    if (document.getElementById(`chat-item-${userEmail}`)) return;

    const div = document.createElement('div');
    div.id = `chat-item-${userEmail}`;
    div.className = 'chat-item';
    div.style = "display:flex; align-items:center; gap:10px; padding:10px; cursor:pointer; border-bottom:1px solid #f0f0f0;";
    div.onclick = () => {
        activeChat = userEmail;
        chatTitle.innerText = userName;
        socket.emit('getOldMessages', { userEmail: myEmail, otherEmail: userEmail });
    };

    div.innerHTML = `
        <img src="${userAvatar || 'img/default-avatar.png'}" style="width:40px; height:40px; border-radius:50%;">
        <div style="flex:1">
            <div style="font-weight:bold; font-size:14px;">${userName}</div>
            <div id="last-msg-${userEmail}" style="font-size:11px; color:gray;">پیام جدید...</div>
        </div>
    `;
    listContainer.prepend(div);
}

function sendFile(input) {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        let fileType = 'file';
        if (file.type.startsWith('image/')) fileType = 'image';
        else if (file.type.startsWith('video/')) fileType = 'video';
        else if (file.type.startsWith('audio/')) fileType = 'audio';

        const messageData = {
            sender: myEmail,
            senderName: localStorage.getItem("firstName") || "کاربر",
            receiver: activeChat,
            fileUrl: e.target.result,
            fileType: fileType,
            type: 'file',
            time: new Date(),
            seen: false
        };

        socket.emit('chatMessage', messageData);
        appendMessage(messageData, 'me');
    };
    reader.readAsDataURL(file);
}

socket.on('message', (data) => {
    // ۱. بررسی اینکه پیام مربوط به من هست یا نه
    const isMeSender = data.sender === myEmail;
    const isMeReceiver = data.receiver === myEmail;

    if (isMeSender || isMeReceiver) {
        
        // پیدا کردن طرف مقابل برای لیست چت
        const chatPartnerEmail = isMeSender ? data.receiver : data.sender;
        const chatPartnerName = isMeSender ? (chatTitle.innerText) : data.senderName;

        // ۲. اضافه کردن به لیست سمت چپ (اگه Saved Messages نبود)
        if (data.receiver !== "Saved Messages") {
            updateSidebarList(chatPartnerEmail, chatPartnerName, data.text);
        }

        // ۳. نمایش در صفحه چت (فقط اگر چت با اون شخص بازه یا سیو مسیجه)
        if (activeChat === data.receiver || activeChat === data.sender) {
            appendMessage(data, isMeSender ? 'me' : 'other');
            
            // ارسال سیگنال سین (فقط برای پیام‌های دریافتی)
            if (!isMeSender && data._id) {
                socket.emit('messageSeen', { msgId: data._id, sender: data.sender });
            }
        }

        // ۴. نوتیفیکیشن (اگه صفحه چت باز نیست و من گیرنده‌ام)
        if (isMeReceiver && activeChat !== data.sender && !document.hasFocus()) {
            new Notification(data.senderName, { body: data.text });
        }
    }
});

// تابع کمکی برای آپدیت لیست سمت چپ
function updateSidebarList(email, name, lastMsg) {
    let list = document.getElementById('chat-list'); // این همون کانتینر لیست چت‌هاست
    if(!list) return;

    let item = document.getElementById(`item-${email}`);
    if (!item) {
        item = document.createElement('div');
        item.id = `item-${email}`;
        item.className = 'chat-sidebar-item'; // استایل دلخواهت رو بده
        item.style = "padding:10px; border-bottom:1px solid #eee; cursor:pointer;";
        list.prepend(item);
    }
    
    item.onclick = () => {
        activeChat = email;
        chatTitle.innerText = name;
        socket.emit('getOldMessages', { userEmail: myEmail, otherEmail: email });
    };

    item.innerHTML = `
        <div style="font-weight:bold;">${name}</div>
        <div style="font-size:11px; color:gray;">${lastMsg.substring(0, 20)}...</div>
    `;
}
// آپدیت شدن تیک‌ها وقتی طرف مقابل پیام رو سین می‌کنه
socket.on('updateTick', (msgId) => {
    const tickElem = document.getElementById(`tick-${msgId}`);
    if (tickElem) {
        tickElem.innerText = '✔✔';
        tickElem.style.color = '#4fc3f7'; // آبی شدن تیک‌ها مثل تلگرام
    }
});

socket.on('updateTick', (msgId) => {
    const tickElem = document.getElementById(`tick-${msgId}`);
    if (tickElem) tickElem.innerText = '✔✔';
});

function appendMessage(data, side) {
    const div = document.createElement('div');
    div.classList.add('msg', side);
    
    let content = "";
    // بهبود نمایش نام در Saved Messages
    let senderDisplayName = (data.receiver === "Saved Messages") ? "پیام ذخیره شده" : (data.senderName || data.sender);
    if (side === 'me' && data.receiver !== "Saved Messages") senderDisplayName = "شما";

    if (data.fileType === 'image') {
        content = `<div class="media-container"><img src="${data.fileUrl}" onclick="viewMedia('${data.fileUrl}')" style="max-width:100%; border-radius:10px; cursor:zoom-in;"></div>`;
    } else if (data.fileType === 'video') {
        content = `<div class="media-container"><video src="${data.fileUrl}" controls style="max-width:100%; border-radius:10px;"></video></div>`;
    } else if (data.fileType === 'audio') {
        content = `<div class="media-container"><audio src="${data.fileUrl}" controls preload="auto" style="width:100%"></audio></div>`;
    } else {
        content = `<div class="text">${data.text}</div>`;
    }

    const tickStatus = data.seen ? '✔✔' : '✔';
    const ticks = side === 'me' ? `<span class="ticks" id="tick-${data._id || data.time}">${tickStatus}</span>` : '';

    div.innerHTML = `
        <div style="font-size: 11px; color: ${side === 'me' ? '#eee' : '#1e3050'}; font-weight: bold;">${senderDisplayName}</div>
        ${content}
        <div style="font-size: 9px; display: flex; color: ${side === 'me' ? '#ddd' : 'gray'}; margin-top:4px;">
            <span>${new Date(data.time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
            <span style="flex:1"></span>
            ${ticks}
        </div>
    `;
    messageContainer.appendChild(div);
    messageContainer.scrollTop = messageContainer.scrollHeight;
}

function checkBirthday(birthDate) {
    const today = new Date().toISOString().slice(5, 10);
    if (today === birthDate.slice(5, 10)) {
        alert(`🎉 ${myName} عزیز، تولدت مبارک! 🎉`);
    }
}

function downloadFile(url, name) { const a = document.createElement('a'); a.href = url; a.download = name; a.click(); }
function viewMedia(url) { window.open(url, '_blank'); }
function logout() {
    if (!confirm("آیا می‌خواهید از این حساب خارج شوید؟")) return;

    let accounts = JSON.parse(localStorage.getItem("allAccounts") || "[]");
    
    // ۱. حذف اکانت فعلی از لیست اکانت‌های متصل
    accounts = accounts.filter(acc => acc.email !== myEmail);
    localStorage.setItem("allAccounts", JSON.stringify(accounts));

    // ۲. چک کردن اینکه آیا اکانت دیگه‌ای باقی مونده؟
    if (accounts.length > 0) {
        // رفتن به اولین اکانت باقی‌مانده
        const nextAcc = accounts[0];
        localStorage.setItem("email", nextAcc.email);
        localStorage.setItem("firstName", nextAcc.name);
        localStorage.setItem("token", nextAcc.token);
        
        alert(`از حساب فعلی خارج شدید. در حال انتقال به حساب ${nextAcc.name}...`);
        location.reload(); // لود مجدد با اکانت بعدی
    } else {
        // اگر هیچ اکانتی نبود، کلاً پاک کن و برو لاگین
        localStorage.clear();
        window.location.href = "/login.html";
    }
}

// پیدا کردن المنت‌های سرچ
const searchInput = document.getElementById('search-input');
const searchResults = document.getElementById('search-results');

if (searchInput) {
    searchInput.addEventListener('input', async (e) => {
        const query = e.target.value.trim();
        
        if (query.length < 2) {
            searchResults.innerHTML = "";
            return;
        }

        try {
            const res = await fetch(`/api/user/search?query=${query}`);
            const data = await res.json();

            searchResults.innerHTML = ""; // پاک کردن نتایج قبلی

            if (data.success && data.users.length > 0) {
                data.users.forEach(u => {
                    // اگر اکانت خودم بود نشون نده
                    if (u.email === myEmail) return;

                    const item = document.createElement('div');
                    item.style = "display:flex; align-items:center; gap:10px; padding:10px; cursor:pointer; border-bottom:1px solid #eee; background:#fff;";
                    item.innerHTML = `
                        <img src="${u.avatar || 'img/default-avatar.png'}" style="width:35px; height:35px; border-radius:50%; object-fit:cover;">
                        <div>
                            <div style="font-size:13px; font-weight:bold;">${u.firstName}</div>
                            <div style="font-size:10px; color:gray;">${u.username ? '@'+u.username : u.email}</div>
                        </div>
                    `;
                    
                    // وقتی روی کاربر کلیک کرد، چت با او باز شود
                    item.onclick = () => {
                        startPrivateChat(u);
                        searchResults.innerHTML = "";
                        searchInput.value = "";
                    };
                    searchResults.appendChild(item);
                });
            } else {
                searchResults.innerHTML = "<div style='padding:10px; font-size:12px; color:red;'>کاربری پیدا نشد.</div>";
            }
        } catch (err) {
            console.error("خطا در سرچ:", err);
        }
    });
}

function startPrivateChat(user) {
    activeChat = user.email;
    chatTitle.innerText = user.firstName;
    messageContainer.innerHTML = `<p style="text-align:center; color:gray; font-size:11px;">شروع گفتگو با ${user.firstName}</p>`;
    
    // درخواست پیام‌های خصوصی از سرور
    socket.emit('getOldMessages', { userEmail: myEmail, otherEmail: user.email });
}

socket.on('connect', () => { if(statusText) statusText.innerText = "● آنلاین"; });
socket.on('disconnect', () => { if(statusText) statusText.innerText = "○ آفلاین"; });

msgInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });