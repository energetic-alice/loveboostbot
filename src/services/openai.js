import OpenAI from 'openai';
import i18next from 'i18next';
import * as db from './db.js';
import config from '../config.js';
import { getExamplesForLanguage, IDEA_TYPES, SUPPORTED_LANGUAGES } from '../constants/ideas.js';
import { error as logError, info as logInfo } from '../logger.js';

const openai = new OpenAI({ apiKey: config.openaiApiKey });

const OPENAI_RETRY_ATTEMPTS = 3;
const OPENAI_RETRY_BASE_MS = 1000;

function isRetryableError(err) {
  const status = err?.status ?? err?.response?.status;
  if (status === 429 || (status >= 500 && status < 600)) return true;
  const code = err?.code ?? err?.cause?.code;
  return ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED'].includes(code);
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function generatePersonalizedIdea(userId, type = 'romantic', language = 'en') {
  const safeType = IDEA_TYPES.includes(type) ? type : 'romantic';
  const safeLang = SUPPORTED_LANGUAGES.includes(language) ? language : 'en';

  const feedback = await db.getUserFeedback(userId, safeType);

  const likes = feedback.filter(item => item.feedback.trim().toLowerCase() === 'like').map(item => item.idea_text);
  const dislikes = feedback
    .filter(item => item.feedback.trim().toLowerCase() === 'dislike')
    .map(item => item.idea_text);
  const lastIdeasTexts = feedback
    .filter(item => item.feedback.trim().toLowerCase() === 'shown')
    .slice(-10)
    .map(item => item.idea_text);
  const avoidIdeasText = [...new Set([...lastIdeasTexts, ...dislikes])].join('\n- ');

  const exampleIdeas = getExamplesForLanguage(safeLang, safeType);
  const examplesText = exampleIdeas.map(idea => `- ${idea.text}`).join('\n');

  let prompt = `Generate a NEW unique ${safeType === 'spicy' ? 'spicy (18+)' : 'romantic'} idea for a couple. `;
  prompt += `The idea should:
      - Be short and simple (1-2 sentences).
      - Be easy to do at home or nearby without special preparation.
      - Not depend on weather conditions.
      - Not require buying anything that costs more than 500 rubles (or equivalent).
      - Be suitable for doing the same day when received.
      - Focus on emotional connection and playful interaction.
      - Only provide the idea itself. Do NOT include any explanations, reasons, benefits, or motivational phrases. Just the idea, as a single complete sentence or short paragraph.
      - Do NOT include activities that require specific items that might not be readily available at home, such as board games, special costumes, candles, or unique props. Only suggest ideas that can be done with common household items or no items at all.
      - The idea must be logically complete, with clear, coherent structure and natural flow. Avoid confusing or contradictory phrasing.
      - Remove unnecessary punctuation and symbols.
      
      📝 **Rules for the idea:**
    - Must be **a single, complete, logical idea**.
    - No awkward wording or redundant phrases.
    - Keep the **tone natural, playful, and intimate**.
    - The idea must be clear and self-explanatory without additional explanations.
    - **In Russian, use smooth, natural phrasing**—avoid direct machine translation.
    - Avoid wordy, clunky, or unnatural sentences.  
    - Ensure proper **word agreement and structure**.`;

  if (safeType === 'spicy') {
    prompt += `
        Generate an **explicitly sexual 18+ idea** for couples.
        
        The idea must include clear elements of sexual activity, such as:
        - Foreplay techniques (e.g., sensual massage, teasing, strip games)
        - Dominance/submission dynamics (light BDSM, restraints, blindfolds)
        - Role-playing scenarios (teacher/student, boss/assistant, stranger fantasy, etc.)
        - Oral activities, erotic dares, body exploration, or intense physical intimacy.
        - The idea MUST involve **explicit sexual activity** or **intimate physical touch**.

          ❗ **Important rules:**
          - The idea should be provocative and arousing, with no ambiguity.
          - The idea should be a single, clear, and concise activity (one activity only).
          - ❌ **No non-sexual activities like movies, playlists, dinners, or general bonding.**
          - ❌ **No vague descriptions like "build emotional connection" — focus ONLY on sexual interaction.**
          - Ensure the idea is logically clear, with no awkward phrasing or incomplete thoughts.
          - Focus on acts related to **foreplay, intercourse, role-play, oral sex, dominance/submission, light BDSM, or erotic games**.
          - Avoid any non-sexual activities like cooking, watching movies, or generic bonding exercises.

          ✅ Examples of correct 18+ ideas:
          - "Tie your partner's hands with a soft scarf and take turns teasing each other without using your hands."
          - "Try a 'hot and cold' game where you stimulate each other with ice cubes and warm breath."
          - "Blindfold your partner and give them gentle commands, exploring their body with different textures like silk or feathers."
          - "Role-play a forbidden romance scenario—like strangers meeting for a secret rendezvous."
          - "Use massage oil for an all-over body massage, slowly increasing intensity to build anticipation."

          ❌ Invalid ideas:
          - "Cook a romantic dinner together." ❌ Not sexual
          - "Go for a long walk and hold hands." ❌ Not intimate enough

        **Write the idea as a clear, standalone suggestion without extra explanations.** 
        `;
  }

  if (likes.length > 0) {
    prompt += `\n\nThe user liked these ideas, generate something similar:\n- ${likes.join('\n- ')}. `;
  }
  if (dislikes.length > 0) {
    prompt += `\n\nThe user disliked these ideas, avoid anything similar:\n- ${dislikes.join('\n- ')}. `;
  }
  if (avoidIdeasText.length > 0) {
    prompt += `\n\nThese ideas have already been shown before. Avoid generating duplicates:\n- ${avoidIdeasText}. `;
  }

  prompt += `\n\nHere are some example ${safeType === 'spicy' ? '18+ spicy' : 'romantic'} ideas for couples:\n${examplesText}`;
  prompt +=
    safeLang === 'ru'
      ? `\n\nОтветь на русском языке и пиши как человек.
          
            🌐 **Localization rules (for Russian translation):**
            - Use **human-like**, fluent, and idiomatic Russian.
            - No unnatural constructions or repetitive words.
            - Ensure **correct grammar, syntax, and natural flow**.
            - Avoid excessive details, keep it **short and clear**.

            ❌ **Bad Example (machine-like):**  
            _"Изучите друг у друга разные зоны чувствительной зоны тела и исследуйте их на протяжении игривых минутных сессий."_

            ✅ **Good Example (human-like):**  
            _"Закройте глаза и исследуйте чувствительные зоны друг друга, ориентируясь только на ощущения."_`
      : `\n\nRespond in English.`;

  const messages = [
    {
      role: 'system',
      content:
        'Avoid using Markdown formatting such as **bold**, *italic*, or any special characters. Provide plain text only.',
    },
    { role: 'user', content: prompt },
  ];

  let lastErr;
  for (let attempt = 1; attempt <= OPENAI_RETRY_ATTEMPTS; attempt++) {
    try {
      const response = await openai.chat.completions.create({
        model: config.openaiModel,
        messages,
        max_tokens: config.openaiMaxTokens,
      });

      let idea = response.choices[0].message.content.trim();
      idea = idea.replace(/^[-–—]\s*/, '');
      idea = idea.replace(/^["'«»""„"]+|["'«»""„"]+$/g, '').trim();
      if (!/[.!?]$/.test(idea)) {
        idea += '.';
      }

      const ideaId = new Date().getTime();
      await db.saveUserIdea(userId, ideaId, idea, 'shown', safeType);

      return idea;
    } catch (err) {
      lastErr = err;
      if (attempt < OPENAI_RETRY_ATTEMPTS && isRetryableError(err)) {
        const delay = OPENAI_RETRY_BASE_MS * Math.pow(2, attempt - 1);
        logInfo(`OpenAI attempt ${attempt} failed, retrying in ${delay}ms:`, err.message);
        await sleep(delay);
      } else {
        break;
      }
    }
  }

  logError('Error generating idea:', lastErr);
  return safeLang === 'ru' ? i18next.t('generation_error_ru') : i18next.t('generation_error_en');
}
