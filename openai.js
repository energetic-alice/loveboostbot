import OpenAI from 'openai';
import * as db from './db.js';
import { romanticIdeas, spicyIdeas } from './ideas.js';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function generatePersonalizedIdea(userId, type = 'romantic', language = 'en') {
  return new Promise(resolve => {
    db.getUserFeedback(userId, async feedback => {
      const likes = feedback.filter(item => item.feedback === 'like').map(item => item.idea_id);
      const dislikes = feedback.filter(item => item.feedback === 'dislike').map(item => item.idea_id);

      const exampleIdeas = type === 'romantic' ? romanticIdeas[language] : spicyIdeas[language];
      const examplesText = exampleIdeas.map(idea => `- ${idea.text}`).join('\n');

      let prompt = `Here are some example ${type === 'spicy' ? '18+ spicy' : 'romantic'} ideas for couples:\n${examplesText}\n\n`;

      prompt += `Now generate a NEW unique ${type === 'spicy' ? 'spicy (18+)' : 'romantic'} idea for a couple. `;
      if (likes.length > 0) {
        prompt += `The user enjoyed ideas with IDs: ${likes.join(', ')}. `;
      }
      if (dislikes.length > 0) {
        prompt += `Avoid ideas similar to those with IDs: ${dislikes.join(', ')}. `;
      }

      // 🎯 Чёткая инструкция:
      prompt += `The idea should:
      - Be short and simple (1-2 sentences).
      - Be easy to do at home or nearby without special preparation.
      - Not depend on weather conditions.
      - Not require buying anything that costs more than 500 rubles (or equivalent).
      - Be suitable for doing the same day when received.
      - Focus on emotional connection and playful interaction.
      - Only provide the idea itself. Do NOT include any explanations, reasons, benefits, or motivational phrases. Just the idea, as a single complete sentence or short paragraph.
      - Do NOT include activities that require specific items that might not be readily available at home, such as board games, special costumes, candles, or unique props. Only suggest ideas that can be done with common household items or no items at all.
      - The idea must be logically complete, with clear, coherent structure and natural flow. Avoid confusing or contradictory phrasing.`;

      if (type === 'spicy') {
        prompt += `
        Generate an **explicitly sexual 18+ idea** for couples.
        
        The idea must include clear elements of sexual activity, such as:
        - Foreplay techniques (e.g., sensual massage, teasing, strip games)
        - Dominance/submission dynamics (light BDSM, restraints, blindfolds)
        - Role-playing scenarios (teacher/student, boss/assistant, stranger fantasy, etc.)
        - Oral activities, erotic dares, body exploration, or intense physical intimacy.
        - The idea MUST involve **explicit sexual activity** or **intimate physical touch**.

        ❗ **Important instructions:**
        - The idea should be provocative and arousing, leaving no ambiguity that it’s about sex.
        - The idea should be a single, clear, and concise activity, not combining multiple actions.
        - Avoid any non-sexual activities like movies, playlists, picnics, or general bonding exercises.
        - No vague descriptions like “build emotional connection” — focus ONLY on sexual interaction.
        - Ensure the idea is logically clear, with no awkward phrasing or incomplete thoughts.
        - Focus on acts related to **foreplay, intercourse, role-play, oral sex, dominance/submission, light BDSM, or erotic games**.
        - Avoid any non-sexual activities like cooking, watching movies, or generic bonding exercises.

        Valid 18+ ideas:
        - "Tie your partner’s hands with a soft scarf and take turns teasing each other without using your hands."
        - "Try a ‘hot and cold’ game where you stimulate each other with ice cubes and warm breath."
        - "Blindfold your partner and give them gentle commands, exploring their body with different textures like silk or feathers."
        - "Role-play a forbidden romance scenario—like strangers meeting for a secret rendezvous."
        - "Use massage oil for an all-over body massage, slowly increasing intensity to build anticipation."
        - "Play a strip poker game where the loser must perform a chosen sexual favor."
        - "Try sensory deprivation with a blindfold and explore each other's bodies slowly with ice cubes or feathers."
        - "Role-play as strangers meeting for the first time, seducing each other from scratch."

        Invalid ideas:
        - "Cook a romantic dinner together." ❌ Not sexual
        - "Go for a long walk and hold hands." ❌ Not intimate enough

        **Write the idea as a clear, standalone suggestion without extra explanations.** 

        `;
      }

      prompt += language === 'ru' ? ` Ответь на русском языке.` : ` Respond in English.`;

      try {
        const response = await openai.chat.completions.create({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content:
                'Avoid using Markdown formatting such as **bold**, *italic*, or any special characters. Provide plain text only.',
            },
            { role: 'user', content: prompt },
          ],
          max_tokens: 120, // Увеличиваем лимит для полноты идей
        });

        let idea = response.choices[0].message.content.trim();

        // ✅ Удаление любых начальных и конечных кавычек (двойных и одинарных)
        idea = idea.replace(/^["'«»“”„”]+|["'«»“”„”]+$/g, '').trim();

        // Проверка на завершённость предложения
        if (!/[.!?]$/.test(idea)) {
          idea += '.';
        }

        resolve(idea);
      } catch (error) {
        console.error('Ошибка при генерации идеи:', error);
        resolve(
          language === 'ru'
            ? 'Не удалось сгенерировать идею. Попробуйте позже.'
            : 'Failed to generate an idea. Try again later.',
        );
      }
    });
  });
}

export { generatePersonalizedIdea };
