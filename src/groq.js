export async function getSopCategory(apiKey, userInput, history) {
    if (!apiKey) {
        throw new Error("GROQ_API_KEY is missing.");
    }

    const url = "https://api.groq.com/openai/v1/chat/completions";

    const selectorPrompt = `
        Tugas Anda adalah sebagai "Intent Selector". 
        Analisis pesan customer dan tentukan kategori SOP yang paling cocok.
        
        KATEGORI:
        A: TANPA KONSEP - Customer tidak punya referensi/tema.
        B: NEGOSIASI HARGA - Customer minta diskon atau komplain harga.
        C: MINTA CEPAT - Customer buru-buru atau tanya durasi.
        D: REVISI - Customer tanya soal revisi atau ganti konsep.
        E: BANDINGKAN VENDOR - Customer menyebut kompetitor lain.
        F: TIDAK SERIUS - Chat tidak jelas, hanya halo, atau tidak relevan.
        G: LAINNYA - Pertanyaan umum di luar kategori di atas.

        ATURAN:
        HANYA kembalikan satu huruf kategori (A/B/C/D/E/F/G). 
        Jangan berikan penjelasan apapun.
    `;

    const messages = [
        { role: "system", content: selectorPrompt }
    ];

    if (history && history.length > 0) {
        // Hanya ambil 3 pesan terakhir untuk konteks pemilihan kategori (opsional)
        messages.push(...history.slice(-6));
    }

    messages.push({ role: "user", content: userInput });

    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages: messages,
            temperature: 0.1 // Rendah agar konsisten
        })
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(`Groq Error: ${response.status}`);
    }

    return data.choices[0].message.content.trim().toUpperCase().charAt(0);
}
