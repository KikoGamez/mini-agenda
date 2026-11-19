// Mini Agenda: función que habla con Claude.
// La clave de Anthropic vive solo aquí (secreto ANTHROPIC_API_KEY de Supabase), nunca en la web.
import Anthropic from "npm:@anthropic-ai/sdk";
import { createClient } from "npm:@supabase/supabase-js@2";

// Modelo y tope diario, configurables con secretos de Supabase.
const MODEL = Deno.env.get("ANTHROPIC_MODEL") ?? "claude-opus-5-5";
const DAILY_LIMIT = Number(Deno.env.get("DAILY_LIMIT") ?? "40");
// Modelos que admiten el respaldo automático si uno rechaza la petición.
const FALLBACK_MODELS = ["claude-opus-5-5", "claude-opus-5", "claude-sonnet-5-5", "claude-fable-5-1", "claude-fable-5-2"];
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

const anthropic = new Anthropic(); // lee ANTHROPIC_API_KEY

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply({ error: "invalid_request" }, 405);

  // Solo personas que han iniciado sesión.
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return reply({ error: "no_auth" }, 401);

  // Tope diario por persona.
  const { data: used, error: usageError } = await supabase.rpc("bump_ai_usage");
  if (usageError) return reply({ error: "upstream_error" }, 500);
  if (Number(used) > DAILY_LIMIT) return reply({ error: "daily_limit" }, 429);

  let body: { prompt?: unknown; images?: unknown };
  try { body = await req.json(); } catch { return reply({ error: "invalid_request" }, 400); }
  const prompt = String(body.prompt ?? "").slice(0, 60000);
  if (!prompt.trim()) return reply({ error: "invalid_request" }, 400);
  const images = (Array.isArray(body.images) ? body.images : [])
    .filter((i) => i && IMAGE_TYPES.includes(i.media_type) && typeof i.data === "string")
    .slice(0, 5);

  const content: Anthropic.ContentBlockParam[] = [
    ...images.map((i) => ({
      type: "image" as const,
      source: { type: "base64" as const, media_type: i.media_type, data: i.data },
    })),
    { type: "text", text: prompt },
  ];

  try {
    let stop: string | null;
    let blocks: { type: string; text?: string }[];
    if (FALLBACK_MODELS.includes(MODEL)) {
      const res = await anthropic.beta.messages.create({
        model: MODEL,
        max_tokens: 16000,
        output_config: { effort: "medium" },
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        messages: [{ role: "user", content }],
      });
      stop = res.stop_reason;
      blocks = res.content;
    } else {
      const res = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 16000,
        output_config: { effort: "medium" },
        messages: [{ role: "user", content }],
      });
      stop = res.stop_reason;
      blocks = res.content;
    }
    if (stop === "refusal") return reply({ error: "refused" });
    const text = blocks.filter((b) => b.type === "text").map((b) => b.text ?? "").join("");
    return reply({ text, truncated: stop === "max_tokens" });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return reply({ error: "rate_limited" }, 429);
    if (e instanceof Anthropic.AuthenticationError) return reply({ error: "ai_key" }, 500);
    if (e instanceof Anthropic.BadRequestError) return reply({ error: "image_rejected" }, 400);
    if (e instanceof Anthropic.APIError) return reply({ error: "upstream_error" }, 502);
    return reply({ error: "upstream_error" }, 500);
  }
});
