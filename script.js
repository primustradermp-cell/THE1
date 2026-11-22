const reflections = [
  {
    arabic: "الْحَمْدُ لِلَّهِ",
    quote: "“Verily, in the remembrance of Allah do hearts find rest.”",
    source: "Qur’an 13:28 • Alhamdulillah — All praise is due to Allah",
  },
  {
    arabic: "فَإِنَّ مَعَ الْعُسْرِ يُسْرًا",
    quote: "“For indeed, with hardship comes ease.”",
    source: "Qur’an 94:5 • A promise of hope in every season",
  },
  {
    arabic: "لَئِن شَكَرْتُمْ لَأَزِيدَنَّكُمْ",
    quote: "“If you are grateful, I will surely increase you in favor.”",
    source: "Qur’an 14:7 • Gratitude turns what we have into abundance",
  },
  {
    arabic: "تَبَسُّمُكَ فِي وَجْهِ أَخِيكَ صَدَقَةٌ",
    quote: "“Your smile in the face of your brother is charity.”",
    source: "Prophet Muhammad ﷺ (Jami‘ at-Tirmidhi) • Beauty in everyday kindness",
  },
  {
    arabic: "وَهُوَ مَعَكُمْ أَيْنَ مَا كُنتُمْ",
    quote: "“And He is with you wherever you are.”",
    source: "Qur’an 57:4 • You are never truly alone",
  },
];

let currentIndex = 0;

const arabicEl = document.getElementById("reflection-arabic");
const quoteEl = document.getElementById("reflection-quote");
const sourceEl = document.getElementById("reflection-source");
const nextBtn = document.getElementById("next-reflection");

if (arabicEl && quoteEl && sourceEl && nextBtn) {
  nextBtn.addEventListener("click", () => {
    currentIndex = (currentIndex + 1) % reflections.length;
    const item = reflections[currentIndex];

    arabicEl.classList.add("is-fading");
    quoteEl.classList.add("is-fading");
    sourceEl.classList.add("is-fading");

    window.setTimeout(() => {
      arabicEl.textContent = item.arabic;
      quoteEl.textContent = item.quote;
      sourceEl.textContent = item.source;

      arabicEl.classList.remove("is-fading");
      quoteEl.classList.remove("is-fading");
      sourceEl.classList.remove("is-fading");
    }, 180);
  });
}
