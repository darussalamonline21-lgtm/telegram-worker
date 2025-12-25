import { SOP_PROMPT } from "./sop.js";

export default {
    async fetch(request, env) {
        const url = new URL(request.url);

        // --- FITUR REGISTRASI MENU (GET /set-menu) ---
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
            await sendTelegramMessage(env.BOT_TOKEN, chatId, "Selamat datang! Menu bot telah diaktifkan.\n\nAnda bisa menggunakan tombol 'Menu' di samping kolom ketikan untuk melakukan /reset percakapan.");
            return new Response("OK", { status: 200 });
        }

        // --- FITUR RESET ---
        if (userText.toLowerCase() === "/reset") {
            if (env.CHAT_HISTORY) {
                await env.CHAT_HISTORY.delete(`history_${chatId}`);
            }
            await sendTelegramMessage(env.BOT_TOKEN, chatId, "🔄 Memori percakapan telah dihapus. Sesi baru dimulai!");
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

        // 1. Dapatkan jawaban dari AI (Groq) berdasarkan SOP & Memori
        const aiResponse = await getGroqResponse(env.GROQ_API_KEY, userText, history);

        // 2. Simpan Riwayat Baru ke KV (Maksimal 10 pesan terakhir)
        if (env.CHAT_HISTORY) {
            history.push({ role: "user", content: userText });
            history.push({ role: "assistant", content: aiResponse });

            // Batasi 10 pesan terakhir (20 item)
            if (history.length > 20) {
                history = history.slice(-20);
            }

            await env.CHAT_HISTORY.put(`history_${chatId}`, JSON.stringify(history), { expirationTtl: 86400 });
        }

        // 3. Kirim jawaban ke Telegram
        await sendTelegramMessage(
            env.BOT_TOKEN,
            chatId,
            aiResponse
        );

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

async function getGroqResponse(apiKey, userInput, history) {
    if (!apiKey) {
        console.error("DEBUG: GROQ_API_KEY is missing.");
        return "Maaf kak, konfigurasi AI (Groq API Key) belum terpasang di dashboard Cloudflare.";
    }

    const url = "https://api.groq.com/openai/v1/chat/completions";

    const messages = [
        { role: "system", content: SOP_PROMPT }
    ];

    if (history && history.length > 0) {
        messages.push(...history);
    }

    messages.push({ role: "user", content: `Pesan Customer: "${userInput}"\n\nBerikan balasan yang sesuai SOP dalam bahasa Indonesia yang ramah namun tegas.` });

    try {
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
