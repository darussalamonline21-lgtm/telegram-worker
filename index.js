import { getSopCategory } from "./src/groq.js";
import { SOP_PROMPT } from "./sop.js";

export default {
    async fetch(request, env) {
        const url = new URL(request.url);

        // --- FITUR REGISTRASI MENU ---
        if (request.method === "GET" && url.pathname === "/set-menu") {
            const result = await setBotMenu(env.BOT_TOKEN);
            return new Response(JSON.stringify(result), {
                headers: { "Content-Type": "application/json" }
            });
        }

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

        // --- FITUR START & SET MENU OTOMATIS ---
        if (userText.toLowerCase() === "/start") {
            await setBotMenu(env.BOT_TOKEN);
            await sendTelegramMessage(env.BOT_TOKEN, chatId, "Selamat datang! Sistem Selektor SOP telah aktif.\n\nKirimkan pesan customer ke sini.");
            return new Response("OK", { status: 200 });
        }

        // --- FITUR RESET ---
        if (userText.toLowerCase() === "/reset") {
            if (env.CHAT_HISTORY) {
                await env.CHAT_HISTORY.delete(`history_${chatId}`);
            }
            await sendTelegramMessage(env.BOT_TOKEN, chatId, "🔄 Memori telah dihapus. Sesi baru dimulai!");
            return new Response("OK", { status: 200 });
        }

        // --- FITUR MEMORI (KV) ---
        let history = [];
        if (env.CHAT_HISTORY) {
            const storedHistory = await env.CHAT_HISTORY.get(`history_${chatId}`);
            if (storedHistory) {
                history = JSON.parse(storedHistory);
            }
        }

        try {
            // 1. Groq Bertindak sebagai Selector (Hanya pilih Kategori)
            const category = await getSopCategory(env.GROQ_API_KEY, userText, history);

            // 2. LOGIKA PENJAWAB (Sesuai Kategori)
            // Catatan: Anda bisa mengubah sop.js untuk mengekspor template jawaban.
            // Untuk sementara, saya biarkan AI memberikan jawaban berdasarkan SOP_PROMPT penuh 
            // ATAU kita bisa mapping jika sop.js sudah Anda ubah bentuknya.

            // Contoh implementasi selector:
            let responseText = `[AI SELECTED CATEGORY: ${category}]\n\n`;

            // Sementara gunakan AI untuk generate jawaban lengkap berdasarkan kategori terpilih
            // (Nanti bisa diganti dengan template kaku dari sop.js)
            responseText += await getFinalResponse(env.GROQ_API_KEY, userText, category, history);

            // 3. Simpan Riwayat
            if (env.CHAT_HISTORY) {
                history.push({ role: "user", content: userText });
                history.push({ role: "assistant", content: responseText });
                if (history.length > 20) history = history.slice(-20);
                await env.CHAT_HISTORY.put(`history_${chatId}`, JSON.stringify(history), { expirationTtl: 86400 });
            }

            // 4. Kirim ke Telegram
            await sendTelegramMessage(env.BOT_TOKEN, chatId, responseText);

        } catch (error) {
            console.error("ERROR:", error.message);
            await sendTelegramMessage(env.BOT_TOKEN, chatId, "Maaf kak sedang ada gangguan teknis.");
        }

        return new Response("OK", { status: 200 });
    }
};

// Fungsi pembantu untuk jawaban akhir (bisa dipindahkan ke src/groq.js juga)
async function getFinalResponse(apiKey, userInput, category, history) {
    const url = "https://api.groq.com/openai/v1/chat/completions";
    const messages = [
        { role: "system", content: `${SOP_PROMPT}\n\nINSTRUKSI KHUSUS: Gunakan SOP Kategori ${category} untuk menjawab.` },
        ...history.slice(-10),
        { role: "user", content: userInput }
    ];

    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages: messages,
            temperature: 0.7
        })
    });

    const data = await response.json();
    return data.choices[0].message.content;
}

async function setBotMenu(token) {
    const url = `https://api.telegram.org/bot${token}/setMyCommands`;
    const body = {
        commands: [
            { command: "reset", description: "Hapus memori & Mulai sesi baru" }
        ]
    };
    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    });
    return await response.json();
}

async function sendTelegramMessage(token, chatId, text) {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text })
    });
}
