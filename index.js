import { SOP_PROMPT } from "./sop.js";

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

    const fullPrompt = `
${SOP_PROMPT}

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
                    { role: "user", content: fullPrompt }
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
