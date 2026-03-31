const socket = io('/', { transports: ['polling', 'websocket'] });

const myName = localStorage.getItem("firstName") || "کاربر"; 
const myEmail = localStorage.getItem("email");
const messageContainer = document.getElementById('messages');
const msgInput = document.getElementById('msg');
const chatTitle = document.getElementById('chat-title');
const statusText = document.getElementById('status');

let activeChat = "Saved Messages"; 

document.addEventListener('DOMContentLoaded', () => {
    if (!myEmail) { window.location.href = "/login.html"; return; }
    document.getElementById("profile-email").innerText = myEmail;
    
    // درخواست اجازه برای نوتیفیکیشن
    if (Notification.permission !== "granted") {
        Notification.requestPermission();
    }

    socket.emit('getOldMessages');
});

// لود پیام‌های قدیمی
socket.on('loadOldMessages', (messages) => {
    messageContainer.innerHTML = ""; 
    messages.forEach(msg => {
        const side = msg.sender === myEmail ? 'me' : 'other';
        appendMessage(msg, side);
    });
});

// ارسال پیام متنی
function sendMessage() {
    const text = msgInput.value.trim();
    if (!text) return;

    const messageData = {
        sender: myEmail,
        senderName: myName, // ارسال نام به جای ایمیل
        text: text,
        receiver: activeChat,
        type: 'text',
        time: new Date(),
        seen: false
    };

    socket.emit('chatMessage', messageData);
    appendMessage(messageData, 'me');
    msgInput.value = "";
}

// ارسال فایل
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
            senderName: myName,
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

// دریافت پیام
socket.on('message', (data) => {
    if (data.sender !== myEmail) {
        appendMessage(data, 'other');
        // ارسال تاییدیه دیده شدن پیام به سرور
        socket.emit('messageSeen', { msgId: data._id, sender: data.sender });
        
        // نمایش نوتیفیکیشن
        if (document.hidden) {
            new Notification(data.senderName, { body: data.text || "یک فایل فرستاد" });
        }
    }
});

// آپدیت تیک پیام‌ها
socket.on('updateTick', (msgId) => {
    const tickElem = document.getElementById(`tick-${msgId}`);
    if (tickElem) tickElem.innerText = '✔✔';
});

function appendMessage(data, side) {
    const div = document.createElement('div');
    div.classList.add('msg', side);
    
    let content = "";
    const senderDisplayName = side === 'me' ? "شما" : (data.senderName || data.sender);

    if (data.fileType === 'image') {
        content = `
            <div class="media-container">
                <img src="${data.fileUrl}" onclick="viewMedia('${data.fileUrl}')" style="max-width:100%; border-radius:10px; cursor:zoom-in;">
                <div class="media-options">
                    <button onclick="downloadFile('${data.fileUrl}', 'img.png')"><i class="fa-solid fa-download"></i></button>
                    <button onclick="forwardMessage('${data.fileUrl}')"><i class="fa-solid fa-share"></i></button>
                </div>
            </div>`;
    } else if (data.fileType === 'video') {
        content = `
            <div class="media-container">
                <video src="${data.fileUrl}" controls style="max-width:100%; border-radius:10px;"></video>
                <div class="media-options">
                    <button onclick="downloadFile('${data.fileUrl}', 'vid.mp4')"><i class="fa-solid fa-download"></i></button>
                </div>
            </div>`;
    } else if (data.fileType === 'audio') {
        content = `
            <div class="media-container">
                <audio src="${data.fileUrl}" controls preload="auto" style="width:100%"></audio>
                <div class="media-options">
                    <button onclick="downloadFile('${data.fileUrl}', 'audio.mp3')"><i class="fa-solid fa-download"></i></button>
                </div>
            </div>`;
    } else {
        content = `<div class="text">${data.text}</div>`;
    }

    const tickStatus = data.seen ? '✔✔' : '✔';
    const ticks = side === 'me' ? `<span class="ticks" id="tick-${data._id || data.time}">${tickStatus}</span>` : '';

    div.innerHTML = `
        <div style="font-size: 11px; color: ${side === 'me' ? '#eee' : '#1e3050'}; font-weight: bold;">${senderDisplayName}</div>
        ${content}
        <div style="font-size: 9px; display: flex;  color: ${side === 'me' ? '#ddd' : 'gray'}; margin-top:4px;">
            <span>${new Date(data.time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
            ${ticks}
        </div>
    `;
    messageContainer.appendChild(div);
    messageContainer.scrollTop = messageContainer.scrollHeight;
}

// توابع کمکی
function downloadFile(url, name) {
    const a = document.createElement('a');
    a.href = url; a.download = name; a.click();
}

function viewMedia(url) {
    window.open(url, '_blank');
}

function forwardMessage(content) {
    const email = prompt("ایمیل مقصد را وارد کنید:");
    if (email) {
        activeChat = email;
        msgInput.value = "Fwd: " + (content.length > 50 ? "File" : content);
        sendMessage();
    }
}

function logout() { localStorage.clear(); window.location.href = "/login.html"; }

socket.on('connect', () => { statusText.innerText = "● آنلاین"; statusText.style.color = "#2ecc71"; });
socket.on('disconnect', () => { statusText.innerText = "○ آفلاین"; statusText.style.color = "#e67e22"; });

msgInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });