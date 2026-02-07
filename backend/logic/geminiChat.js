/**
 * Goldilocks Chat Module — conversational AI assistant powered by Google Gemini
 * Maintains conversation history per session and has full awareness of
 * the user's current home state, energy data, and carbon impact.
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

const MODELS = ['gemini-2.0-flash', 'gemini-2.0-flash-lite'];

// In-memory chat sessions keyed by user ID
const chatSessions = new Map();

/**
 * Build the system instruction that gives Gemini full context
 */
function buildSystemInstruction(context) {
  const { user, profile, indoor, outdoor, electricity, recommendation, moldRisk, costEstimate, todaySavings, carbon, weather } = context;

  const fmt = (v, d = 1) => (v != null && !isNaN(v)) ? Number(v).toFixed(d) : '?';

  return `You are Goldilocks, an AI assistant built into a smart home app for Kingston, Ontario residents. The app uses an Arduino sensor to monitor indoor conditions and helps people find the "just right" balance between comfort, energy costs, and environmental impact.

You should be friendly, concise, and helpful. You can answer questions about:
- Current indoor/outdoor conditions and what they mean
- Energy costs, electricity rates, and savings tips
- Mold risk and air quality
- Carbon emissions impact (personal and community-wide)
- The Goldilocks recommendation engine and why it suggests what it does
- Kingston-specific information (weather patterns, utility rates, housing)
- Health impacts of ventilation for seniors, children, and vulnerable populations
- Kingston's Golden Age initiative and how smart ventilation contributes

CURRENT LIVE DATA:
- Indoor temperature: ${fmt(indoor?.temp_C)}°C${indoor?.humidity_estimated ? `, estimated humidity: ${fmt(indoor?.humidity_RH, 0)}%` : indoor?.humidity_RH != null ? `, humidity: ${fmt(indoor?.humidity_RH, 0)}%` : ''}
- Indoor pressure: ${fmt(indoor?.pressure_hPa, 0)} hPa
- Outdoor: ${fmt(outdoor?.temp_C)}°C, ${fmt(outdoor?.humidity_RH, 0)}% RH, ${outdoor?.description || 'unknown'}, feels like ${fmt(outdoor?.feels_like_C)}°C
- Weather forecast: ${(weather?.forecast || []).slice(0, 3).map(f => `${f.dt_txt?.split(' ')[1]?.substring(0, 5) || '?'}: ${fmt(f.temp_C)}°C ${f.description}`).join(' | ') || 'unavailable'}
- Location: ${weather?.location || 'Kingston, ON'}

ENERGY:
- Electricity plan: ${user?.plan_type || 'TOU'} (${electricity?.season || 'winter'})
- Current rate: ${fmt(electricity?.price_cents_per_kWh)}¢/kWh (${electricity?.periodLabel || '?'})
- HVAC cost estimate: $${fmt(costEstimate?.hvac_cost, 4)}/hr | Savings if ventilating: $${fmt(costEstimate?.savings, 4)}/hr
- Today's savings: $${fmt(todaySavings?.dollars_saved_est || 0, 2)} | ${fmt(todaySavings?.kwh_saved_est || 0, 2)} kWh

RECOMMENDATION:
- Current: ${recommendation?.state || '?'} (${recommendation?.confidence || '?'} confidence)
- Reasons: ${(recommendation?.reasons || []).join('; ') || 'N/A'}
- Text: ${recommendation?.text || 'N/A'}

HEALTH & MOLD:
- Mold risk level: ${moldRisk?.risk_level || '?'} (score: ${moldRisk?.risk_score ?? '?'}/100)
- Details: ${moldRisk?.explanation || 'N/A'}

CARBON IMPACT:
- Total CO₂ saved: ${fmt(carbon?.total?.co2_saved_kg || 0, 2)} kg over ${carbon?.total?.days_tracked || 0} days
- Today: ${fmt(carbon?.today?.co2_saved_g || 0, 0)}g CO₂ saved
- Heating source: ${user?.heating_source || 'gas'}
- Community projection: ${carbon?.community?.annual_community_tonnes?.toLocaleString() || '?'} tonnes/year if Kingston-wide
- Equivalences: ${fmt(carbon?.equivalences?.km_not_driven || 0, 1)} km not driven, ${carbon?.equivalences?.phone_charges || 0} phone charges

USER PROFILE:
- Comfort zone: ${user?.comfort_min || 20}–${user?.comfort_max || 23}°C
- Housing: ${profile?.housing_type || 'apartment'}, floor ${profile?.floor_level || '?'}
- Postal code: ${user?.postal_code || 'K7L'}
- Lifestyle: ${profile?.lifestyle_notes || 'not specified'}

RULES:
- Keep responses concise (2-4 sentences for simple questions, more for complex ones)
- Use specific numbers from the live data when relevant
- If asked about something you don't have data for, say so honestly
- Be enthusiastic about energy savings and environmental impact
- Reference Kingston's Golden Age initiative when discussing community impact
- If the user seems concerned about health, mention how proper ventilation helps
- You can use emoji sparingly for friendliness`;
}

/**
 * Start or resume a chat session with full context
 */
async function chat(userMessage, context, apiKey) {
  if (!apiKey) {
    return { reply: 'Gemini API key not configured.', error: 'No API key' };
  }

  const userId = context.user?.id || 1;
  const sessionKey = `user_${userId}`;

  const genAI = new GoogleGenerativeAI(apiKey);

  for (const modelName of MODELS) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: buildSystemInstruction(context),
        generationConfig: {
          temperature: 0.8,
          maxOutputTokens: 500,
        },
      });

      // Get or create chat session
      let session = chatSessions.get(sessionKey);

      if (!session) {
        session = model.startChat({ history: [] });
        chatSessions.set(sessionKey, session);
      }

      const result = await session.sendMessage(userMessage);
      const response = result.response;
      const reply = response.text().trim();
      const usage = response.usageMetadata || {};

      return {
        reply,
        model: modelName,
        tokens_used: (usage.promptTokenCount || 0) + (usage.candidatesTokenCount || 0),
      };
    } catch (err) {
      console.error(`Gemini chat error (${modelName}):`, err.message);
      chatSessions.delete(sessionKey);
      // Try next model
      if (modelName === MODELS[MODELS.length - 1]) {
        return { reply: 'Sorry, I had trouble thinking about that. Please try again!', error: err.message };
      }
    }
  }
}

/**
 * Reset chat session (e.g., when context changes significantly)
 */
function resetChat(userId) {
  chatSessions.delete(`user_${userId || 1}`);
}

module.exports = { chat, resetChat };
