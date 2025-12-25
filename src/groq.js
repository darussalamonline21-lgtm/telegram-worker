export async function pickSOPWithGroq(userText, templates, apiKey) {
    if (!apiKey) {
        console.error("DEBUG: GROQ_API_KEY is missing in env.");
        return "Maaf kak, API Key AI (Groq) tidak ditemukan. Mohon periksa pengaturan Cloudflare Kakak.";
    }

    const prompt = `
You are a classifier.
Your task is to select the SINGLE most relevant SOP category.
Do NOT write a reply.
Do NOT combine categories.

Customer message:
"${userText}"

SOP categories:
${templates.map((t, i) => `${i + 1}. ${t.title}`).join("\n")}

Rules:
- Choose the category that BEST matches the customer's intent.
- If the customer mentions price comparison or cheap price → choose price-related.
- If the customer has no clear idea or says "bebas" → choose no-concept.
- If the customer pushes urgency → choose rush.
- Return ONLY the number.
`;

    try {
        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile", // Menggunakan model terbaru yang stabil
                temperature: 0,
                messages: [
                    { role: "system", content: "You classify intent only." },
                    { role: "user", content: prompt }
                ]
            })
        });

        const json = await res.json();

        if (!res.ok) {
            console.error("DEBUG: Groq API Error Detailed:", JSON.stringify(json));
            return `Maaf kak, ada kendala teknis pada sistem selektor (Groq Error ${res.status}).`;
        }

        if (!json.choices || !json.choices[0] || !json.choices[0].message) {
            console.error("DEBUG: Unexpected Groq JSON structure:", JSON.stringify(json));
            return "Maaf kak, respon dari AI tidak sesuai format.";
        }

        const idx = parseInt(json.choices[0].message.content.trim(), 10) - 1;

        return templates[idx]?.reply
            || "Mohon jelaskan kebutuhan desain kak agar kami bisa bantu dengan tepat.";

    } catch (error) {
        console.error("DEBUG: Fetch/System Error in groq.js:", error.message);
        throw error; // Biarkan ditangkap oleh index.js catch block
    }
}
