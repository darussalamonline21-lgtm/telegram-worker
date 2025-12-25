export default {
  async fetch(request, env) {
    // Terima hanya POST (Telegram webhook)
    if (request.method !== "POST") {
      return new Response("OK", { status: 200 });
    }

    let data;
    try {
      data = await request.json();
    } catch {
      return new Response("OK", { status: 200 });
    }

    // Filter: hanya pesan teks user
    if (!data.message || !data.message.text) {
      return new Response("OK", { status: 200 });
    }

    const chatId = data.message.chat.id;

    // Balasan test
    await sendTelegramMessage(
      env.BOT_TOKEN,
      chatId,
      "BOT HIDUP"
    );

    // Wajib respon cepat ke Telegram
    return new Response("OK", { status: 200 });
  }
};

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
