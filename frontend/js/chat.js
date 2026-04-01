const socket = io('/', { transports: ['polling', 'websocket'] });

const myEmail = localStorage.getItem("email");
let myName = localStorage.getItem("firstName") || "کاربر"; 
const messageContainer = document.getElementById('messages');
const msgInput = document.getElementById('msg');
const chatTitle = document.getElementById('chat-title');
const statusText = document.getElementById('status');

let activeChat = "Saved Messages"; 
let activeChatType = "private"; 
let currentAvatarIndex = 0;
let userAvatars = [];

// نمایش اولیه اطلاعات
    document.getElementById("profile-email").innerText = myEmail;
    loadProfileData(); // بارگذاری اطلاعات کامل از دیتابیس

    if (Notification.permission !== "granted") {
        Notification.requestPermission();
    }

    socket.emit('getOldMessages');


    socket.emit('join', myEmail); 
    socket.emit('getChatList', myEmail);
    socket.emit('getOldMessages', { userEmail: myEmail, otherEmail: "Saved Messages", isGroup: false });

   // دریافت لیست چت‌ها از سرور و نمایش دکمه ساخت گروه
socket.on('receiveChatList', (list) => {
    const chatListElem = document.getElementById('chat-list');
    if (!chatListElem) return;
    chatListElem.innerHTML = ""; 

    // دکمه ساخت گروه - همیشه در بالای لیست
    const createBtn = document.createElement('div');
    createBtn.innerHTML = `
        <div onclick="openCreateGroup()" style="margin-bottom:10px; padding:12px; background:#048796; color:white; border-radius:10px; text-align:center; cursor:pointer; font-weight:bold; display:flex; align-items:center; justify-content:center; gap:8px;">
            <span>👥</span> ساخت گروه جدید
        </div>`;
    chatListElem.appendChild(createBtn);

    // اضافه کردن چت‌ها
    list.forEach(item => {
        updateSidebarUI(item);
    });
});

    document.getElementById('main-avatar').onclick = () => openAvatarViewer(myEmail);
    
    // کلیک روی هدر برای دیدن پروفایل
    document.querySelector('.chat-header').onclick = () => {
        if (activeChatType === 'private' && activeChat !== "Saved Messages") {
            openAvatarViewer(activeChat);
        }
    };

// --- مدیریت پروفایل (SPA) ---//

function showProfile() {
    document.getElementById('profile-section').style.display = 'block';
}

function hideProfile() {
    document.getElementById('profile-section').style.display = 'none';
}

function openEditInfo() {
    document.getElementById('edit-modal').style.display = 'flex';
    // پر کردن مقادیر فعلی در اینپوت‌ها
    document.getElementById('edit-fullname').value = myName;
    document.getElementById('edit-username').value = document.getElementById('info-username').innerText.replace('@', '');
    document.getElementById('edit-bio').value = document.getElementById('info-bio').innerText;
}


// ذخیره اطلاعات کامل
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
        loadProfileData(); // رفرش اطلاعات نمایشی
    } else {
        alert("خطا: احتمالاً این آیدی قبلاً توسط شخص دیگری انتخاب شده است.");
    }
}

// آپلود و تغییر عکس پروفایل
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
            document.getElementById('main-avatar').src = base64;
        }
    };
    reader.readAsDataURL(file);
}

function checkBirthday(birthDate) {
    const today = new Date().toISOString().slice(5, 10); // MM-DD
    const bDay = birthDate.slice(5, 10);
    if (today === bDay) {
        alert(`🎉 ${myName} عزیز، تولدت مبارک! 🎉`);
    }
}
// --- بخش اصلی: ارسال پیام و فایل ---

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
    
    // آپدیت لیست بعد از ارسال پیام
    setTimeout(() => {
        socket.emit('getChatList', myEmail);
    }, 500); 
}

// تابع ارسال فایل (اصلاح شده)
async function sendFile(input) {
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
            senderName: myName,
            fileUrl: e.target.result,
            fileType: fileType,
            receiver: activeChat,
            type: activeChatType,
            text: "", 
            time: new Date()
        };
        socket.emit('chatMessage', messageData);
        input.value = ""; 
    };
    reader.readAsDataURL(file);
}

// وقتی پیامی میاد (چه من فرستادم چه اون)
socket.on('message', (data) => {
    const isMe = data.sender === myEmail;
    const isTarget = (activeChat === data.receiver || activeChat === data.sender);

    if (isTarget) {
        appendMessage(data, isMe ? 'me' : 'other');
        // اگر پیام از طرف مقابل بود، سین بزن
        if (!isMe && data._id) {
            socket.emit('messageSeen', { msgId: data._id, sender: data.sender });
        }
    }

    // --- نکته طلایی: آپدیت لیست چت برای نمایش نام مخاطب ---
    socket.emit('getChatList', myEmail);

    // --- بخش نوتیفیکیشن ---
    if (!isMe) {
        showDesktopNotification(data);
    }
});

// تابع اختصاصی نوتیفیکیشن
function showDesktopNotification(data) {
    if (Notification.permission === "granted") {
        const notif = new Notification(data.senderName || "پیام جدید", {
            body: data.text || "یک فایل ارسال شد",
            icon: 'img/logo.png' // آدرس لوگوی خودت رو بذار
        });
        notif.onclick = () => { window.focus(); };
    }
    // پخش صدا
    const audio = new Audio('sounds/notify.mp3');
    audio.play().catch(() => {});
}

socket.on('loadHistory', (messages) => {
    messageContainer.innerHTML = ""; 
    if (messages.length === 0) {
        messageContainer.innerHTML = `<p style="text-align:center; color:gray; font-size:11px; margin-top:20px;">هنوز پیامی اینجا نیست.</p>`;
    }
    messages.forEach(msg => {
        const side = msg.sender === myEmail ? 'me' : 'other';
        appendMessage(msg, side);
    });
    messageContainer.scrollTop = messageContainer.scrollHeight;
});

function appendMessage(data, side) {
    const div = document.createElement('div');
    div.classList.add('msg', side);
    
    let content = "";
    if (data.fileUrl) {
        if (data.fileType === 'image') content = `<img src="${data.fileUrl}" onclick="viewMedia('${data.fileUrl}')" style="max-width:100%; border-radius:10px; cursor:pointer;">`;
        else if (data.fileType === 'video') content = `<video src="${data.fileUrl}" controls style="max-width:100%; border-radius:10px;"></video>`;
        else if (data.fileType === 'audio') content = `<audio src="${data.fileUrl}" controls style="width:100%"></audio>`;
    } else {
        content = `<div class="text">${data.text}</div>`;
    }

    const tickStatus = data.seen ? '✔✔' : '✔';
    const ticks = (side === 'me' && data.type === 'private') ? `<span class="ticks" id="tick-${data._id || data.time}" style="color:${data.seen ? '#4fc3f7':'#ccc'}">${tickStatus}</span>` : '';

    div.innerHTML = `
        <div style="font-size: 10px; opacity: 0.8; margin-bottom:4px;">${data.senderName || data.sender}</div>
        ${content}
        <div style="font-size: 9px; display: flex; justify-content: space-between; margin-top:4px; opacity:0.7;">
            <span>${new Date(data.time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
            ${ticks}
        </div>
    `;
    messageContainer.appendChild(div);
    messageContainer.scrollTop = messageContainer.scrollHeight;
}

// --- بخش جستجوی کاربر (اصلاح شده) ---

const searchInput = document.getElementById('search-input');
const searchResults = document.getElementById('search-results');

if (searchInput) {
    searchInput.addEventListener('input', async (e) => {
        const query = e.target.value.trim();
        if (query.length < 2) { searchResults.innerHTML = ""; return; }

        try {
            const res = await fetch(`/api/user/search?query=${query}`);
            const data = await res.json();
            searchResults.innerHTML = "";
            if (data.success) {
                data.users.forEach(u => {
                    if (u.email === myEmail) return;
                    const item = document.createElement('div');
                    item.className = "search-item";
                    item.style = "padding:10px; border-bottom:1px solid #eee; cursor:pointer; display:flex; align-items:center; gap:10px; background:white;";
                    item.innerHTML = `<img src="${u.avatar || 'img/default-avatar.png'}" style="width:30px; height:30px; border-radius:50%;"> <b>${u.firstName}</b>`;
                    item.onclick = () => {
                        startPrivateChat(u);
                        searchResults.innerHTML = "";
                        searchInput.value = "";
                    };
                    searchResults.appendChild(item);
                });
            }
        } catch (err) { console.error(err); }
    });
}

function startPrivateChat(user) {
    activeChat = user.email;
    activeChatType = "private";
    chatTitle.innerText = user.firstName;
    messageContainer.innerHTML = "";
    
    // درخواست تاریخچه
    socket.emit('getOldMessages', { userEmail: myEmail, otherEmail: user.email, isGroup: false });
    
    // بلافاصله لیست رو رفرش کن تا اسم طرف بیاد (حتی اگه پیامی نداده باشی)
    socket.emit('getChatList', myEmail);
}

// --- بخش مدیریت گروه‌ها (Modal بدون Alert) ---

function openCreateGroup() {
    document.getElementById('group-modal').style.display = 'flex';
}

function closeGroupModal() {
    document.getElementById('group-modal').style.display = 'none';
}

async function confirmCreateGroup() {
    const name = document.getElementById('group-name-input').value;
    const username = document.getElementById('group-username-input').value;
    // فرض بر این است که المنت‌های HTML در پاسخ قبلی اضافه شده‌اند
    if (!name) return;

    try {
        const res = await fetch('/api/groups/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, username, creator: myEmail })
        });
        const data = await res.json();
        if (data.success) {
            closeGroupModal();
            socket.emit('getChatList', myEmail);
        }
    } catch (err) { console.error("Error creating group", err); }
}

function updateSidebarUI(item) {
    const list = document.getElementById('chat-list');
    const div = document.createElement('div');
    div.className = 'chat-item';
    div.style = "display:flex; align-items:center; gap:10px; padding:12px; cursor:pointer; position:relative;";

    // ایجاد دایره تعداد پیام (اگر عدد بزرگتر از ۰ بود)
    let unreadHtml = "";
    if (item.unreadCount && item.unreadCount > 0) {
        unreadHtml = `<span class="unread-badge" style="background:#86B6F6; color:white; border-radius:50%; padding:2px 8px; font-size:11px; margin-left:auto;">${item.unreadCount}</span>`;
    }

    div.innerHTML = `
        <div class="avatar-sm" style="width:40px; height:40px; background:#eee; border-radius:50%; display:flex; align-items:center; justify-content:center;">👤</div>
        <div style="flex:1; overflow:hidden;">
            <b style="font-size:14px;">${item.name}</b>
            <div style="font-size:11px; color:gray; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${item.lastMsg}</div>
        </div>
        ${unreadHtml} 
    `;

    div.onclick = () => {
        activeChat = item.email;
        activeChatType = item.type;
        chatTitle.innerText = item.name;
        
        // وقتی روی چت کلیک شد، به سرور بگو همه پیام‌ها رو سین کن (تا عدد غیب بشه)
        socket.emit('markAllAsSeen', { myEmail: myEmail, partnerEmail: item.email });
        
        socket.emit('getOldMessages', { userEmail: myEmail, otherEmail: item.email, isGroup: false });
    };
    list.appendChild(div);
}

// --- توابع پروفایل و حساب‌ها ---

async function loadProfileData() {
    const res = await fetch(`/api/user/profile?email=${myEmail}`);
    const data = await res.json();
    if (data.success && data.user) {
        myName = data.user.firstName;
        document.getElementById('display-name-top').innerText = myName;
        document.getElementById('main-avatar').src = data.user.avatar || 'img/default-avatar.png';
        document.getElementById('info-email').innerText = data.user.email;
        document.getElementById('info-username').innerText = data.user.username || "بدون آیدی";
    }
}

async function openAvatarViewer(targetEmail) {
    const res = await fetch(`/api/user/profile?email=${targetEmail}`);
    const data = await res.json();
    if (data.success && data.user) {
        userAvatars = [data.user.avatar, ...(data.user.avatarHistory || [])];
        currentAvatarIndex = 0;
        updateViewerDisplay();
        document.getElementById('owner-tools').style.display = (targetEmail === myEmail) ? 'flex' : 'none';
        document.getElementById('avatar-viewer').style.display = 'flex';
    }
}

function updateViewerDisplay() {
    document.getElementById('full-res-avatar').src = userAvatars[currentAvatarIndex] || 'img/default-avatar.png';
    document.getElementById('avatar-counter').innerText = `${currentAvatarIndex + 1} از ${userAvatars.length}`;
}

function closeAvatarViewer() { document.getElementById('avatar-viewer').style.display = 'none'; }
function nextAvatar() { if (currentAvatarIndex < userAvatars.length - 1) { currentAvatarIndex++; updateViewerDisplay(); } }
function prevAvatar() { if (currentAvatarIndex > 0) { currentAvatarIndex--; updateViewerDisplay(); } }

function renderConnectedAccounts() {
    const accounts = JSON.parse(localStorage.getItem("allAccounts") || "[]");
    const container = document.getElementById('accounts-list'); 
    if (!container) return;
    container.innerHTML = "";
    accounts.forEach(acc => {
        const div = document.createElement('div');
        div.className = "account-item";
        div.style = `padding:8px; cursor:pointer; margin-bottom:5px; border-radius:5px; background:${acc.email === myEmail ? '#e3f2fd' : '#f5f5f5'}`;
        div.innerHTML = `<b>${acc.name}</b><br><small>${acc.email}</small>`;
        if(acc.email !== myEmail) div.onclick = () => switchAccount(acc.email);
        container.appendChild(div);
    });
}

function switchAccount(email) {
    const accounts = JSON.parse(localStorage.getItem("allAccounts") || "[]");
    const target = accounts.find(a => a.email === email);
    if(target) {
        localStorage.setItem("email", target.email);
        localStorage.setItem("firstName", target.name);
        localStorage.setItem("token", target.token);
        location.reload(); 
    }
}

// اینتراکشن‌ها
msgInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });

// وقتی سرور می‌گه لیست رو آپدیت کن
socket.on('requestChatListUpdate', () => {
    socket.emit('getChatList', myEmail);
});

// اصلاح تابع سین کردن در سمت کلاینت
socket.on('updateTick', (msgId) => {
    const tickElem = document.getElementById(`tick-${msgId}`);
    if (tickElem) {
        tickElem.innerText = '✔✔';
        tickElem.style.color = '#4fc3f7';
    }
});

function showProfile() { document.getElementById('profile-section').style.display = 'block'; }
function hideProfile() { document.getElementById('profile-section').style.display = 'none'; }
function viewMedia(url) { window.open(url, '_blank'); }
function openRightPanel(targetEmail) {
    document.getElementById('right-panel').classList.add('open');
    
    // گرفتن اطلاعات از سرور
    fetch(`/api/user/profile?email=${targetEmail}`)
    .then(res => res.json())
    .then(data => {
        if(data.success) {
            document.getElementById('panel-avatar').src = data.user.avatar || 'img/default-avatar.png';
            document.getElementById('panel-name').innerText = data.user.firstName;
            document.getElementById('panel-subtext').innerText = data.user.username || targetEmail;
            document.getElementById('panel-bio').innerText = data.user.bio || "No bio yet";
        }
    });
}

function closeRightPanel() {
    document.getElementById('right-panel').classList.remove('open');
}



// باز کردن پنل پروفایل
async function openUserInfo() {
    if (activeChat === "Saved Messages") return;

    try {
        const res = await fetch(`/api/user/profile?email=${activeChat}`);
        const data = await res.json();

        if (data.success) {
            const u = data.user;
            const panel = document.getElementById('right-panel');
            
            // پر کردن اطلاعات
            document.getElementById('panel-img').src = u.avatar || 'img/default-avatar.png';
            document.getElementById('panel-name').innerText = u.firstName;
            document.getElementById('panel-bio').innerText = u.bio || "بدون بیوگرافی";
            document.getElementById('panel-username').innerText = u.username ? '@' + u.username : u.email;

            // به جای کلاس، مستقیم استایل بده که مطمئن شویم باز می‌شود
            panel.style.display = 'block'; 
            panel.style.right = '0'; // اگر در CSS مقدار منفی دارد
        }
    } catch (err) { console.error("خطا در دریافت پروفایل:", err); }
}

// تابع بستن را هم اصلاح کن
function closeRightPanel() {
    const panel = document.getElementById('right-panel');
    panel.style.display = 'none';
    panel.classList.remove('open');
}

// اتصال به کلیک روی هدر چت
document.querySelector('.chat-header').onclick = openUserInfo;

async function saveFullProfile() {
    const fullName = document.getElementById('edit-fullname').value;
    const username = document.getElementById('edit-username').value;
    const bio = document.getElementById('edit-bio').value;

    if (!fullName) { alert("نام الزامی است"); return; }

    try {
        const res = await fetch('/api/user/update', { // مطمئن شو مسیر در بک‌انند همین است
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                email: myEmail, 
                firstName: fullName, 
                username: username, 
                bio: bio 
            })
        });
        const data = await res.json();
        if (data.success) {
            alert("تغییرات ذخیره شد!");
            document.getElementById('edit-modal').style.display = 'none';
            loadProfileData(); // رفرش کردن اطلاعات در صفحه
        }
    } catch (err) { alert("خطا در ذخیره اطلاعات"); }
}

// تابع باز کردن مودال ادیت با مقادیر فعلی
function openEditModal() {
    document.getElementById('edit-fullname').value = myName;
    document.getElementById('edit-username').value = document.getElementById('info-username').innerText.replace('@', '');
    document.getElementById('edit-bio').value = document.getElementById('info-bio').innerText;
    document.getElementById('edit-modal').style.display = 'flex';
}

socket.on('message', (data) => {
    const isMe = data.sender === myEmail;
    const isTarget = (activeChat === data.receiver || activeChat === data.sender);

    if (isTarget) {
        appendMessage(data, isMe ? 'me' : 'other');
    } else if (!isMe) {
        // فقط اگر در صفحه چتِ آن شخص نیستیم نوتیفیکیشن بده
        if (Notification.permission === "granted") {
            new Notification(data.senderName || "AryaChat", {
                body: `پیام جدید از ${data.senderName}: ${data.text || "فایل"}`,
                icon: 'img/logoAryaChat.png'
            });
        }
        const audio = new Audio('sounds/notify.mp3');
        audio.play().catch(() => {});
    }
    socket.emit('getChatList', myEmail);
});

function addAccount() {
    // ۱. اطلاعات اکانت فعلی را در لیست ذخیره می‌کنیم که نپرد
    const currentAcc = {
        email: localStorage.getItem("email"),
        name: localStorage.getItem("firstName"),
        token: localStorage.getItem("token")
    };
    let all = JSON.parse(localStorage.getItem("allAccounts") || "[]");
    if (currentAcc.email && !all.find(a => a.email === currentAcc.email)) {
        all.push(currentAcc);
        localStorage.setItem("allAccounts", JSON.stringify(all));
    }

    // ۲. یک کلید موقت می‌سازیم که صفحه لاگین بفهمد "قصد افزودن" داریم
    localStorage.setItem("is_adding_new", "true");
    
    // ۳. حالا بدون پاک کردن توکن قبلی، فقط به صفحه لاگین برو
    window.location.href = "/login.html";
}
function logout() {
    const accounts = JSON.parse(localStorage.getItem("allAccounts") || "[]");
    const currentEmail = localStorage.getItem("email");

    // فقط اکانت فعلی را از لیست حذف کن
    const filteredAccounts = accounts.filter(acc => acc.email !== currentEmail);
    localStorage.setItem("allAccounts", JSON.stringify(filteredAccounts));

    // اگر اکانت دیگری باقی مانده، برو روی آن، وگرنه برو صفحه لاگین
    if (filteredAccounts.length > 0) {
        const nextAcc = filteredAccounts[0];
        localStorage.setItem("email", nextAcc.email);
        localStorage.setItem("firstName", nextAcc.name);
        localStorage.setItem("token", nextAcc.token);
        location.reload();
    } else {
        localStorage.clear();
        window.location.href = "/login.html";
    }
}