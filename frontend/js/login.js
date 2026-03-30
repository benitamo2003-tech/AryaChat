let userEmail = "";

// تابع کمکی برای تغییر مرحله (Slide)
function showStep(stepId) {
    document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
    document.getElementById(stepId).classList.add('active');
}

// ۱. ارسال کد به ایمیل
async function sendCode() {
    userEmail = document.getElementById('email').value.trim();
    if (!userEmail) return alert("لطفاً ایمیل خود را وارد کنید");

    try {
        const res = await fetch('/api/auth/send-code', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: userEmail })
        });
        const data = await res.json();
        if (data.success) {
            showStep('step-otp');
        } else {
            alert("خطا در ارسال کد. دوباره تلاش کنید.");
        }
    } catch (err) {
        alert("ارتباط با سرور برقرار نشد.");
    }
}

// ۲. تایید کد و چک کردن وضعیت کاربر (ثبت نام شده یا جدید)
async function verifyCode() {
    const code = document.getElementById('otp').value.trim();
    if (!code) return alert("کد تایید را وارد کنید");

    try {
        const res = await fetch('/api/auth/verify-code', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: userEmail, code })
        });
        const data = await res.json();

        if (data.success) {
            if (data.newUser) {
                // کاربر جدید است -> مرحله دریافت نام
                showStep('step-name');
            } else {
                // کاربر قدیمی -> ذخیره توکن و ورود مستقیم
                localStorage.setItem("token", data.token);
                localStorage.setItem("user_info", JSON.stringify(data.user));
                window.location.href = "/chat";
            }
        } else {
            alert(data.message || "کد اشتباه است");
        }
    } catch (err) {
        alert("خطا در تایید کد.");
    }
}

// ۳. تکمیل پروفایل برای کاربران جدید
async function completeRegistration() {
    const fname = document.getElementById('fname').value.trim();
    const lname = document.getElementById('lname').value.trim();

    if (!fname) return alert("وارد کردن نام الزامی است");

    try {
        const res = await fetch('/api/auth/send-code', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: userEmail, firstName: fname, lastName: lname })
        });
        const data = await res.json();

        if (data.success) {
            localStorage.setItem("token", data.token);
            localStorage.setItem("user_info", JSON.stringify(data.user));
            window.location.href = "/chat";
        }
    } catch (err) {
        alert("خطا در ثبت اطلاعات.");
    }
}