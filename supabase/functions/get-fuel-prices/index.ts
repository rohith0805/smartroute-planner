import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { city } = await req.json().catch(() => ({ city: "Hyderabad" }));

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const today = new Date().toISOString().split("T")[0];

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          max_tokens: 150,
          temperature: 0,
          messages: [
            {
              role: "system",
              content: "You are a fuel price database. You have access to the latest fuel prices across all Indian cities. Always return accurate, non-zero prices based on the most recent data you know. Petrol prices in India typically range from ₹94-110/L, diesel ₹87-95/L, CNG ₹75-90/kg depending on the city.",
            },
            {
              role: "user",
              content: `What are the latest known fuel prices in ${city}, India? Return the most recent accurate prices you have data for. Do not return 0 for any value.`,
            },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "return_fuel_prices",
                description: "Return fuel prices",
                parameters: {
                  type: "object",
                  properties: {
                    petrol: { type: "number" },
                    diesel: { type: "number" },
                    cng: { type: "number" },
                    city: { type: "string" },
                    date: { type: "string" },
                  },
                  required: ["petrol", "diesel", "cng", "city", "date"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: {
            type: "function",
            function: { name: "return_fuel_prices" },
          },
        }),
        signal: controller.signal,
      }
    );

    clearTimeout(timeout);

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: "Rate limited, please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ success: false, error: "Payment required." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiData = await response.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];

    if (toolCall?.function?.arguments) {
      const prices = JSON.parse(toolCall.function.arguments);
      return new Response(
        JSON.stringify({ success: true, prices }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fallback: try parsing content directly
    const content = aiData.choices?.[0]?.message?.content;
    if (content) {
      const jsonMatch = content.match(/\{[^}]+\}/);
      if (jsonMatch) {
        const prices = JSON.parse(jsonMatch[0]);
        return new Response(
          JSON.stringify({ success: true, prices }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    throw new Error("Unexpected AI response format");
  } catch (e) {
    console.error("get-fuel-prices error:", e);
    const isTimeout = e instanceof DOMException && e.name === "AbortError";
    return new Response(
      JSON.stringify({
        success: false,
        error: isTimeout ? "Request timed out, please try again" : (e instanceof Error ? e.message : "Unknown error"),
      }),
      {
        status: isTimeout ? 504 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
