export async function pickSOPWithGroq(userText, templates, apiKey) {
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

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model: "llama3-70b-8192",
            temperature: 0,
            messages: [
                { role: "system", content: "You classify intent only." },
                { role: "user", content: prompt }
            ]
        })
    });

    const json = await res.json();
    const idx = parseInt(json.choices[0].message.content.trim(), 10) - 1;

    return templates[idx]?.reply
        || "Mohon jelaskan kebutuhan desain kak agar kami bisa bantu dengan tepat.";
}
