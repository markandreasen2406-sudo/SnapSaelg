exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ error: "Denne endpoint accepterer kun POST" }) };
  }
  let body;
  try { body = JSON.parse(event.body); }
  catch (e) { return { statusCode: 400, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ error: "Ugyldig JSON i request" }) }; }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) { return { statusCode: 500, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ error: "ANTHROPIC_API_KEY er ikke sat op i Netlify endnu." }) }; }
  try {
    const anthropicResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify(body),
    });
    const data = await anthropicResponse.text();
    return { statusCode: anthropicResponse.status, headers: { "Content-Type": "application/json" }, body: data };
  } catch (err) {
    return { statusCode: 502, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ error: "Kunne ikke nå Anthropic API: " + err.message }) };
  }
};
