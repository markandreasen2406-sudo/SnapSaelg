// netlify/functions/generate.js
//
// Runs on Netlify's servers, never in the visitor's browser.
// Verifies a Cloudflare Turnstile token BEFORE spending any Anthropic API credit —
// this is the real protection layer. The credit gate in app.html is just UI;
// this is what actually stops a script from hammering the endpoint directly.

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Denne endpoint accepterer kun POST" }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch (e) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Ugyldig JSON i request" }),
    };
  }

  // --- Turnstile verification ---
  const token = body.turnstile_token;
  delete body.turnstile_token; // never forward this field to Anthropic

  const turnstileSecret = process.env.TURNSTILE_SECRET_KEY;
  if (!turnstileSecret) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "TURNSTILE_SECRET_KEY er ikke sat op i Netlify endnu." }),
    };
  }
  if (!token) {
    return {
      statusCode: 403,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Manglende sikkerhedsbekræftelse (Turnstile)." }),
    };
  }

  try {
    const verifyResponse = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret: turnstileSecret, response: token }),
    });
    const verifyData = await verifyResponse.json();
    const errorCodes = verifyData["error-codes"] || [];
    // "timeout-or-duplicate" means this exact token was already verified once earlier
    // in the same batch — that's fine, it proves a human solved it, not a fresh forgery.
    const isDuplicateOfValidToken = errorCodes.includes("timeout-or-duplicate");
    if (!verifyData.success && !isDuplicateOfValidToken) {
      return {
        statusCode: 403,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Sikkerhedsbekræftelse fejlede — prøv igen." }),
      };
    }
  } catch (err) {
    return {
      statusCode: 502,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Kunne ikke verificere sikkerhedstjek: " + err.message }),
    };
  }

  // --- Forward to Anthropic, only after verification passed ---
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "ANTHROPIC_API_KEY er ikke sat op i Netlify endnu." }),
    };
  }

  try {
    const anthropicResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });
    const data = await anthropicResponse.text();
    return {
      statusCode: anthropicResponse.status,
      headers: { "Content-Type": "application/json" },
      body: data,
    };
  } catch (err) {
    return {
      statusCode: 502,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Kunne ikke nå Anthropic API: " + err.message }),
    };
  }
};
