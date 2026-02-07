/**
 * LLM Suggestions Module — uses OpenRouter to generate personalized advice
 * based on sensor data, recommendations, user profile, and history.
 */

const fetch = require('node-fetch');

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

/**
 * Build a context-rich prompt from dashboard state
 */
function fmt(val, decimals = 1) {
  if (val == null || typeof val !== 'number' || isNaN(val)) return '?';
  return val.toFixed(decimals);
}

function buildPrompt({ user, profile, indoor, outdoor, electricity, recommendation, moldRisk, costEstimate, recentNotifications, todaySavings }) {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit' });
  const dateStr = now.toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric' });

  return `You are Goldilocks, a friendly and concise smart home assistant for a resident in Kingston, Ontario. Your name reflects the idea of finding the "just right" balance for indoor comfort, energy savings, and environmental impact. Generate 1–2 short, actionable notifications for the user based on the current data below. Each notification should be 1–2 sentences max.

CURRENT STATE (${dateStr}, ${timeStr}):
- Indoor: ${fmt(indoor?.temp_C)}°C, ${indoor?.humidity_RH != null ? fmt(indoor.humidity_RH, 0) + '% RH' : 'humidity N/A'}
- Outdoor: ${fmt(outdoor?.temp_C)}°C, ${fmt(outdoor?.humidity_RH, 0)}% RH, ${outdoor?.description || 'unknown conditions'}
- Electricity: ${electricity?.planType || '?'} plan, currently ${electricity?.periodLabel || '?'} at ${fmt(electricity?.price_cents_per_kWh)}¢/kWh (${electricity?.season || '?'})
- Current recommendation: ${recommendation?.state || '?'} (${recommendation?.confidence || '?'} confidence)
- Recommendation reasons: ${(recommendation?.reasons || []).join('; ')}
- Mold risk: ${moldRisk?.risk_level || '?'} (score ${moldRisk?.risk_score ?? '?'}/100) — ${moldRisk?.explanation || 'N/A'}
- Cost estimate: HVAC $${fmt(costEstimate?.hvac_cost, 4)}/hr vs window $0, potential savings $${fmt(costEstimate?.savings, 4)}/hr
- Today's savings so far: $${fmt(todaySavings?.dollars_saved_est || 0, 2)}

USER PROFILE:
- Comfort zone: ${user.comfort_min}–${user.comfort_max}°C
- Housing: ${profile?.housing_type || 'apartment'}, floor ${profile?.floor_level || '?'}
- Lifestyle: ${profile?.lifestyle_notes || 'none specified'}
- Plan: ${user.plan_type}

RECENT NOTIFICATIONS (avoid repeating these):
${recentNotifications.length > 0 ? recentNotifications.map(n => `- "${n.message_text}"`).join('\n') : '- None'}

RULES:
- Be specific with numbers (temps, percentages, costs)
- Mention timing if relevant (e.g., "off-peak starts at 7pm")
- If mold risk is MEDIUM or HIGH, prioritize that
- If there's a savings opportunity, mention the dollar amount
- If weather is about to change, warn them
- Keep tone friendly but brief — think push notification style
- Do NOT repeat advice from recent notifications above
- Remember: good ventilation and mold prevention especially benefit seniors, children, and those with respiratory conditions — frame health benefits when relevant
- Connect energy savings to community impact when natural (Kingston's Golden Age initiative)

Respond with a JSON array of objects: [{"message": "...", "trigger_type": "mold_risk|savings_opportunity|weather_alert|pattern|general"}]
Return ONLY the JSON array, no other text.`;
}

/**
 * Call OpenRouter API to generate suggestions
 */
async function generateSuggestions(context, apiKey) {
  if (!apiKey || apiKey === 'your_openrouter_api_key_here') {
    return { suggestions: [], error: 'No OpenRouter API key configured' };
  }

  const prompt = buildPrompt(context);

  try {
    const response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'Goldilocks Kingston',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.0-flash-001',
        messages: [
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 300,
      }),
    });

    const data = await response.json();

    if (data.error) {
      console.error('OpenRouter API error:', data.error);
      return { suggestions: [], error: data.error.message || 'OpenRouter API error' };
    }

    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) {
      return { suggestions: [], error: 'Empty response from LLM' };
    }

    // Parse JSON from response (handle potential markdown wrapping)
    let parsed;
    try {
      const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsed = JSON.parse(jsonStr);
    } catch (e) {
      console.error('Failed to parse LLM response:', content);
      return { suggestions: [], error: 'Failed to parse LLM response', raw: content };
    }

    // Validate structure
    const suggestions = Array.isArray(parsed) ? parsed.filter(s => s.message && s.trigger_type) : [];

    // Token usage for logging
    const usage = data.usage || {};

    return {
      suggestions,
      model: data.model,
      tokens_used: (usage.prompt_tokens || 0) + (usage.completion_tokens || 0),
      prompt_summary: `Dashboard state at ${new Date().toISOString()}`,
    };
  } catch (err) {
    console.error('LLM suggestion error:', err.message);
    return { suggestions: [], error: err.message };
  }
}

module.exports = { generateSuggestions, buildPrompt };
