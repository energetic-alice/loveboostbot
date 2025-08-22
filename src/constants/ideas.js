const romanticIdeas = {
  en: [
    { id: 1, text: 'Write a love letter and leave it in a surprise place.' },
    { id: 2, text: 'Plan a cozy home movie night with your favorite snacks.' },
    { id: 3, text: 'Make a playlist of songs that remind you of each other.' },
    { id: 4, text: 'Cook a special dinner together and set the table with candles.' },
    { id: 5, text: 'Create a scrapbook with your favorite memories as a couple.' },
    { id: 15, text: 'Have a "no phones" evening focused entirely on each other.' },
  ],
  ru: [
    { id: 6, text: 'Напишите любовное письмо и оставьте его в неожиданном месте.' },
    { id: 7, text: 'Организуйте уютный вечер кино с любимыми закусками.' },
    { id: 8, text: 'Составьте плейлист из песен, которые напоминают вам друг о друге.' },
    { id: 9, text: 'Приготовьте особенный ужин вместе и украсьте стол свечами.' },
    { id: 10, text: 'Создайте альбом с любимыми воспоминаниями вашей пары.' },
    { id: 30, text: 'Устройте вечер без телефонов, полностью сосредоточившись друг на друге.' },
  ],
};

const spicyIdeas = {
  en: [
    { id: 11, text: 'Try a new romantic massage technique tonight.' },
    { id: 12, text: 'Send a flirty voice message during the day.' },
    { id: 13, text: "Play a 'secret fantasies' game together." },
    { id: 16, text: 'Blindfold your partner and surprise them with gentle touches using different textures.' },
    { id: 17, text: 'Play a "truth or dare" game with a spicy twist.' },
    { id: 18, text: "Try role-playing a fantasy you've never explored before." },
    { id: 19, text: 'Give each other slow massages with scented oils.' },
    { id: 20, text: 'Exchange secret notes describing your favorite intimate moments.' },
  ],
  ru: [
    { id: 21, text: 'Завяжите партнеру глаза и удивите его прикосновениями с разными текстурами.' },
    { id: 22, text: 'Поиграйте в "правда или действие" с пикантным уклоном.' },
    { id: 23, text: 'Попробуйте ролевую игру, о которой вы давно мечтали.' },
    { id: 24, text: 'Сделайте друг другу медленный массаж с ароматическими маслами.' },
    { id: 25, text: 'Обменивайтесь записками с описанием любимых интимных моментов.' },
    { id: 26, text: 'Попробуйте новую технику массажа сегодня вечером.' },
    { id: 27, text: 'Отправьте кокетливое голосовое сообщение в течение дня.' },
    { id: 28, text: "Поиграйте в игру 'секретные фантазии'." },
  ],
};

const SUPPORTED_LANGUAGES = ['en', 'ru'];
const IDEA_TYPES = ['romantic', 'spicy'];

function getExamplesForLanguage(language, type) {
  const lang = SUPPORTED_LANGUAGES.includes(language) ? language : 'en';
  const list = type === 'spicy' ? spicyIdeas[lang] : romanticIdeas[lang];
  return list || (type === 'spicy' ? spicyIdeas.en : romanticIdeas.en);
}

export { SUPPORTED_LANGUAGES, IDEA_TYPES, getExamplesForLanguage };
