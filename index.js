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

        // 1. Dapatkan jawaban dari AI (Groq) berdasarkan SOP
        const aiResponse = await getGroqResponse(env.GROQ_API_KEY, userText);

        // 2. Kirim jawaban ke Telegram
        await sendTelegramMessage(
            env.BOT_TOKEN,
            chatId,
            aiResponse
        );

        return new Response("OK", { status: 200 });
    }
};

async function getGroqResponse(apiKey, userInput) {
    if (!apiKey) {
        console.error("DEBUG: GROQ_API_KEY is missing.");
        return "Maaf kak, konfigurasi AI (Groq API Key) belum terpasang di dashboard Cloudflare.";
    }

    const url = "https://api.groq.com/openai/v1/chat/completions";

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
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                messages: [
                    { role: "system", content: "Anda adalah asisten CS profesional yang mengikuti SOP perusahaan." },
                    { role: "user", content: sopPrompt }
                ],
                temperature: 0.7
            })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error("DEBUG: Groq API Error:", JSON.stringify(data));
            return `Maaf kak, ada kendala teknis pada sistem pendukung (Groq Error ${response.status}).`;
        }

        return data.choices[0].message.content;
    } catch (error) {
        console.error("DEBUG: System Error:", error.message);
        return "Maaf kak, sistem sedang tidak merespon. Mohon hubungi kami beberapa saat lagi.";
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
