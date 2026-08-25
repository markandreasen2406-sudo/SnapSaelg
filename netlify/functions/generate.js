// netlify/functions/generate.js
//
// Runs on Netlify's servers, never in the visitor's browser.
// Uses the Anthropic API key that Netlify's AI Gateway injects automatically,
// and forwards the request app.html sends to Anthropic.

export default async (req) => {
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Denne endpoint accepterer kun POST" }),
      { status: 405, headers: { "Content-Type": "application/json" } }
    );
  }

  let body;
  try {
    body = await req.json();
  } catch (e) {
    return new Response(
      JSON.stringify({ error: "Ugyldig JSON i request" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  const baseUrl = process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com";
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "ANTHROPIC_API_KEY er ikke sat op i Netlify endnu." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const anthropicResponse = await fetch(`${baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });
    const data = await anthropicResponse.text();
    return new Response(data, {
      status: anthropicResponse.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Kunne ikke nå Anthropic API: " + err.message }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }
};
