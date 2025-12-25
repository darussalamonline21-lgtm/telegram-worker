export async function getFlexibleResponseWithGroq(userText, templates, history, apiKey) {
    if (!apiKey) {
        console.error("DEBUG: GROQ_API_KEY is missing.");
        return "Maaf kak, ada kendala konfigurasi pada sistem AI.";
    }

    const sopContext = templates.map((t, i) => {
        return `KATEGORI: ${t.title}\nATURAN/JAWABAN DASAR: ${t.reply}`;
    }).join("\n\n---\n\n");

    const systemPrompt = `
ANDA ADALAH: CS Profesional Jasa Custom Ilustrasi Kaos.
TUGAS: Membalas chat customer dengan tenang, berwibawa, dan menerapkan "Customer Psychology".

PRINSIP KOMUNIKASI:
1. JANGAN bertele-tele. Maksimal 2-3 paragraf pendek.
2. Tetap tenang dan profesional (Authority).
3. Gunakan SOP di bawah ini sebagai PEDOMAN UTAMA. 
4. Anda boleh mengonstruksi kalimat sendiri agar lebih natural dan nyambung dengan pertanyaan customer, namun ISINYA TIDAK BOLEH melenceng dari SOP.

Daftar SOP (Materi Hafalan Anda):
${sopContext}

ATURAN TAMBAHAN:
- Jika customer bertanya hal di luar SOP, tetap jawab dengan gaya bahasa CS yang tenang dan arahkan kembali ke topik jasa desain kaos.
- Gunakan bahasa Indonesia yang ramah namun tidak merendah diri.
`;

    const messages = [
        { role: "system", content: systemPrompt },
        ...history.slice(-6), // Ambil 3 percakapan terakhir (user & assistant)
        { role: "user", content: userText }
    ];

    try {
        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                temperature: 0.7,
                messages: messages
            })
        });

        const json = await res.json();

        if (!res.ok) {
            console.error("DEBUG: Groq API Error:", JSON.stringify(json));
            return "Maaf kak, sistem pendukung kami sedang sedikit kendala. Mohon tunggu sebentar ya.";
        }

        return json.choices[0].message.content;

    } catch (error) {
        console.error("DEBUG: System Error in groq.js:", error.message);
        return "Maaf kak, terjadi gangguan pada sistem. Silakan coba kirim pesan lagi.";
    }
}
