export default {
    async fetch(request, env) {
        if (request.method !== "POST") {
            return new Response("OK", { status: 200 });
        }

        let data;
        try {
            data = await request.json();
        } catch {
            return new Response("OK", { status: 200 });
        }

        if (!data.message || !data.message.text) {
            return new Response("OK", { status: 200 });
        }

        const chatId = data.message.chat.id;
        const userText = data.message.text;

        // 1. Dapatkan jawaban dari AI (Gemini) berdasarkan SOP
        const aiResponse = await getGeminiResponse(env.GEMINI_API_KEY, userText);

        // 2. Kirim jawaban ke Telegram
        await sendTelegramMessage(
            env.BOT_TOKEN,
            chatId,
            aiResponse
        );

        return new Response("OK", { status: 200 });
    }
};

async function getGeminiResponse(apiKey, userInput) {
    if (!apiKey) {
        console.error("DEBUG: GEMINI_API_KEY is missing or undefined.");
        return "Maaf kak, konfigurasi AI (API Key) belum terpasang di dashboard Cloudflare.";
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const sopPrompt = `
ANDA ADALAH: CS Profesional Jasa Custom Desain Ilustrasi Kaos.
TUGAS: Membalas chat customer berdasarkan SOP yang ketat.

PRINSIP UTAMA:
1. Selalu sopan, profesional, tenang.
2. Tidak defensif, tidak emosi, tidak berdebat soal harga.
3. Singkat, padat, fokus ke alur -> kejelasan -> keputusan.
4. Jangan mendidik customer berlebihan.

KLASIFIKASI & INSTRUKSI:
A. TANPA KONSEP: Minta tema/referensi kasar. Jangan tentukan sendiri dari awal.
B. MINTA MURAH/NEGOSIASI: Tegaskan kualitas & waktu pengerjaan. Jangan beri diskon emosional.
C. MINTA CEPAT: Jelaskan butuh waktu untuk kualitas. Tawarkan opsi prioritas (rush fee) jika perlu.
D. REVISI BERULANG: Batasi sesuai kesepakatan awal. Jika ganti konsep, kenakan biaya tambahan.
E. BANDINGKAN VENDOR: Jangan menyerang vendor lain. Fokus ke standar kualitas sendiri.
F. TIDAK SERIUS: Dorong keputusan cepat atau minta kabar kembali jika sudah siap.

DILARANG:
- "Susah kak kalau gitu"
- "Harga segitu gak masuk"
- "Customer lain aja bisa"
- "Kan sudah saya bilang"

Pesan Customer: "${userInput}"

Berikan balasan yang sesuai SOP dalam bahasa Indonesia yang ramah namun tegas.
  `;

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ parts: [{ text: sopPrompt }] }]
            })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error("DEBUG: Gemini API Error Response:", JSON.stringify(data));
            const errorMessage = data.error?.message || "Tidak diketahui";
            return `Maaf kak, AI menolak (Error ${response.status}): ${errorMessage}`;
        }

        if (data.candidates && data.candidates[0] && data.candidates[0].content) {
            return data.candidates[0].content.parts[0].text;
        } else {
            console.error("DEBUG: Unexpected Gemini response format atau Safety Filter:", JSON.stringify(data));
            if (data.promptFeedback?.blockReason) {
                return `Maaf kak, pesan diblokir oleh sistem keamanan AI (Alasan: ${data.promptFeedback.blockReason}).`;
            }
            return "Maaf kak, AI memberikan respon kosong. Silakan coba kalimat lain.";
        }
    } catch (error) {
        console.error("DEBUG: Fetch/System Error:", error.message);
        return "Maaf kak, sistem pendukung sedang tidak merespon. Mohon tunggu ya.";
    }
}

async function sendTelegramMessage(token, chatId, text) {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;

    await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            chat_id: chatId,
            text
        })
    });
}
