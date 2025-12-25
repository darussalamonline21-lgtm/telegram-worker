import { pickSOPWithGroq } from "./src/groq.js";
import { SOP_TEMPLATES } from "./sop.js";

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

        // --- FITUR START ---
        if (userText.toLowerCase() === "/start") {
            await setBotMenu(env.BOT_TOKEN);
            await sendTelegramMessage(env.BOT_TOKEN, chatId, "Selamat datang! Sistem Selektor SOP (Template Kaku) telah aktif.\n\nSilakan kirimkan pesan customer ke sini, saya akan memilihkan jawaban terbaik.");
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
        // Catatan: Walaupun pickSOPWithGroq saat ini belum menggunakan history, 
        // kita tetap simpan agar sistem tetap memiliki basis data jika nanti ingin dikembangkan.
        let history = [];
        if (env.CHAT_HISTORY) {
            const storedHistory = await env.CHAT_HISTORY.get(`history_${chatId}`);
            if (storedHistory) {
                history = JSON.parse(storedHistory);
            }
        }

        try {
            // 1. Groq Bertindak sebagai Selector (Memilih jawaban dari SOP_TEMPLATES)
            const responseText = await pickSOPWithGroq(userText, SOP_TEMPLATES, env.GROQ_API_KEY);

            // 2. Simpan Riwayat
            if (env.CHAT_HISTORY) {
                history.push({ role: "user", content: userText });
                history.push({ role: "assistant", content: responseText });
                if (history.length > 20) history = history.slice(-20);
                await env.CHAT_HISTORY.put(`history_${chatId}`, JSON.stringify(history), { expirationTtl: 86400 });
            }

            // 3. Kirim ke Telegram
            await sendTelegramMessage(env.BOT_TOKEN, chatId, responseText);

        } catch (error) {
            console.error("ERROR:", error.message);
            await sendTelegramMessage(env.BOT_TOKEN, chatId, "Maaf kak, ada sedikit kendala koneksi dengan sistem selektor.");
        }

        return new Response("OK", { status: 200 });
    }
};

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
