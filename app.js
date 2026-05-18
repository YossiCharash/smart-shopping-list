const STORAGE_KEY = "smart-shopping-list-v1";

const input = document.querySelector("#messageInput");
const parseButton = document.querySelector("#parseButton");
const recordButton = document.querySelector("#recordButton");
const clearInputButton = document.querySelector("#clearInputButton");
const manualItemInput = document.querySelector("#manualItemInput");
const manualAddButton = document.querySelector("#manualAddButton");
const shoppingList = document.querySelector("#shoppingList");
const itemTemplate = document.querySelector("#itemTemplate");
const emptyState = document.querySelector("#emptyState");
const summaryLine = document.querySelector("#summaryLine");
const whatsappButton = document.querySelector("#whatsappButton");
const removeDoneButton = document.querySelector("#removeDoneButton");
const clearListButton = document.querySelector("#clearListButton");
const savedStatus = document.querySelector("#savedStatus");
const voiceState = document.querySelector("#voiceState");

const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition || null;

let items = loadItems();
let recognition = null;
let isRecording = false;
let shouldKeepRecording = false;
let baseTranscript = "";
let recordedText = "";
let finalTranscripts = [];

const fillerWords = [
  "צריך",
  "צריכה",
  "צריכים",
  "לקנות",
  "תקנה",
  "תקני",
  "תביא",
  "תביאי",
  "אני",
  "רוצה",
  "וגם",
  "עם",
  "לי",
  "לנו",
  "בבקשה",
  "מהסופר",
  "מהמכולת",
];

const groceryWords = [
  "אורז",
  "אבוקדו",
  "ביצים",
  "ביצה",
  "ביסלי",
  "בננות",
  "בננה",
  "בצל",
  "בצלים",
  "בשר",
  "גמבה",
  "גמבות",
  "גבינה",
  "גבינות",
  "גזר",
  "גזרים",
  "דגים",
  "דג",
  "חלב",
  "חלה",
  "חלות",
  "חטיפים",
  "חטיף",
  "חיתולים",
  "חמאה",
  "חומוס",
  "חזה",
  "טחינה",
  "יוגורט",
  "יין",
  "לחם",
  "לחמניות",
  "לימון",
  "לימונים",
  "מלפפונים",
  "מלפפון",
  "מים",
  "מגבונים",
  "מעדנים",
  "מצות",
  "מרכך",
  "נייר",
  "נקניק",
  "ענבים",
  "סוכר",
  "סבון",
  "סלט",
  "עגבניות",
  "עגבניה",
  "עוף",
  "פסטה",
  "פיתות",
  "פיתה",
  "פירות",
  "פלפל",
  "פלפלים",
  "קוטג",
  "קוטג'",
  "קפה",
  "קורנפלקס",
  "קטשופ",
  "שוקולד",
  "שמן",
  "שמפו",
  "שניצל",
  "שמנת",
  "תפוח",
  "תפוחים",
  "תירס",
  "תה",
];

const amountWords = [
  "אחד",
  "אחת",
  "שני",
  "שתי",
  "שלוש",
  "שלושה",
  "ארבע",
  "ארבעה",
  "חמש",
  "חמישה",
  "שש",
  "שישה",
  "שבע",
  "שבעה",
  "שמונה",
  "תשע",
  "תשעה",
  "עשר",
  "עשרה",
  "קילו",
  "חצי",
  "ליטר",
  "בקבוק",
  "בקבוקי",
  "חבילת",
  "חבילה",
  "קופסת",
  "קופסה",
];

function loadItems() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveItems() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  savedStatus.textContent = "נשמר עכשיו";
  window.setTimeout(() => {
    savedStatus.textContent = "נשמר מקומית";
  }, 1100);
}

function normalizeName(name) {
  return name
    .replace(/[.!?;:]/g, ",")
    .replace(/\s+/g, " ")
    .trim();
}

function splitKnownProducts(text) {
  const words = text.split(" ").filter(Boolean);
  const parts = [];
  let current = [];
  const stripWord = (word) => word.replace(/[^\u0590-\u05ff'"]/g, "");
  const productKey = (word) => {
    const clean = stripWord(word);
    return clean.startsWith("ו") && groceryWords.includes(clean.slice(1))
      ? clean.slice(1)
      : clean;
  };
  const hasProduct = (tokens) =>
    tokens.some((token) => groceryWords.includes(productKey(token)));

  words.forEach((word, index) => {
    const cleanWord = stripWord(word);
    const key = productKey(word);
    const previous = words[index - 1] || "";
    const previousClean = stripWord(previous);
    const startsProduct = groceryWords.includes(key);
    const previousIsAmount = amountWords.includes(previousClean);
    const startsNewQuantity = amountWords.includes(cleanWord) && hasProduct(current);

    if (startsNewQuantity || (startsProduct && current.length && !previousIsAmount)) {
      parts.push(current.join(" "));
      current = [];
    }

    current.push(key !== cleanWord ? key : word);
  });

  if (current.length) parts.push(current.join(" "));
  return parts;
}

function extractItems(text) {
  const cleaned = text
    .replace(/\r?\n/g, ",")
    .replace(/\s+(וגם|ו)\s+/g, ",")
    .replace(/\s+ו(?=[א-ת])/g, ",")
    .replace(/\s+בנוסף\s+/g, ",")
    .replace(/\s+עוד\s+/g, ",");

  return cleaned
    .split(",")
    .flatMap((part) => splitKnownProducts(normalizeName(part)))
    .map((part) => {
      const words = normalizeName(part)
        .split(" ")
        .filter((word) => !fillerWords.includes(word));
      return normalizeName(words.join(" "));
    })
    .filter((name) => name.length > 1);
}

function addItems(names) {
  const existing = new Set(items.map((item) => item.name.toLowerCase()));
  const additions = names
    .map(normalizeName)
    .filter(Boolean)
    .filter((name) => {
      const key = name.toLowerCase();
      if (existing.has(key)) return false;
      existing.add(key);
      return true;
    })
    .map((name) => ({
      id: crypto.randomUUID(),
      name,
      done: false,
      createdAt: Date.now(),
    }));

  if (!additions.length) return;
  items = [...additions, ...items];
  saveItems();
  render();
}

function render() {
  shoppingList.innerHTML = "";

  items.forEach((item) => {
    const node = itemTemplate.content.firstElementChild.cloneNode(true);
    const checkbox = node.querySelector(".item-check");
    const name = node.querySelector(".item-name");
    const deleteButton = node.querySelector(".delete-item");

    node.classList.toggle("done", item.done);
    checkbox.checked = item.done;
    name.textContent = item.name;

    checkbox.addEventListener("change", () => {
      item.done = checkbox.checked;
      saveItems();
      render();
    });

    deleteButton.addEventListener("click", () => {
      items = items.filter((candidate) => candidate.id !== item.id);
      saveItems();
      render();
    });

    shoppingList.append(node);
  });

  const activeCount = items.filter((item) => !item.done).length;
  const doneCount = items.length - activeCount;
  summaryLine.textContent = items.length
    ? `${activeCount} לקנות, ${doneCount} כבר סומנו`
    : "אין מוצרים עדיין";
  emptyState.classList.toggle("hidden", items.length > 0);
  whatsappButton.disabled = activeCount === 0;
}

function parseInput() {
  const names = extractItems(input.value);
  addItems(names);
  if (names.length) input.value = "";
}

function buildWhatsAppMessage() {
  const activeItems = items.filter((item) => !item.done).map((item) => item.name);
  return `רשימת הקניות שמחכה לי עכשיו:\n${activeItems
    .map((item) => `• ${item}`)
    .join("\n")}`;
}

function openWhatsApp() {
  if (whatsappButton.disabled) return;
  const message = encodeURIComponent(buildWhatsAppMessage());
  window.open(`https://wa.me/?text=${message}`, "_blank", "noopener,noreferrer");
}

function setupSpeechRecognition() {
  if (!SpeechRecognition) {
    voiceState.textContent = "הקלטה נתמכת בכרום או Edge";
    recordButton.disabled = true;
    return;
  }

  if (!window.isSecureContext) {
    voiceState.textContent = "הקלטה דורשת HTTPS";
    recordButton.disabled = true;
    return;
  }

  recognition = new SpeechRecognition();
  recognition.lang = "he-IL";
  recognition.interimResults = true;
  recognition.continuous = true;

  recognition.addEventListener("start", () => {
    isRecording = true;
    recordButton.classList.add("recording");
    recordButton.querySelector("span:last-child").textContent = "סיים הקלטה";
    voiceState.textContent = "מקליט עד שתלחץ סיום";
  });

  recognition.addEventListener("result", (event) => {
    let interimText = "";

    Array.from(event.results).forEach((result, index) => {
      const transcript = result[0].transcript.trim();
      if (result.isFinal) {
        finalTranscripts[index] = transcript;
      } else {
        interimText = `${interimText} ${transcript}`.trim();
      }
    });

    recordedText = [baseTranscript, finalTranscripts.filter(Boolean).join(" ")]
      .filter(Boolean)
      .join(" ");
    input.value = `${recordedText} ${interimText}`.trim();
  });

  recognition.addEventListener("end", () => {
    if (shouldKeepRecording) {
      try {
        baseTranscript = input.value.trim();
        recordedText = baseTranscript;
        finalTranscripts = [];
        recognition.start();
        return;
      } catch {
        shouldKeepRecording = false;
      }
    }

    isRecording = false;
    recordButton.classList.remove("recording");
    recordButton.querySelector("span:last-child").textContent = "הקלטה";
    voiceState.textContent = "ההקלטה הסתיימה";
    if (input.value.trim()) parseInput();
    baseTranscript = "";
    recordedText = "";
    finalTranscripts = [];
  });

  recognition.addEventListener("error", (event) => {
    if (event.error === "aborted" && !shouldKeepRecording) return;
    if (event.error === "no-speech" && shouldKeepRecording) {
      voiceState.textContent = "עדיין מאזין";
      return;
    }

    shouldKeepRecording = false;
    isRecording = false;
    recordButton.classList.remove("recording");
    recordButton.querySelector("span:last-child").textContent = "הקלטה";
    voiceState.textContent =
      event.error === "not-allowed"
        ? "צריך לאשר מיקרופון בדפדפן"
        : "לא הצלחתי להקליט כרגע";
  });
}

async function requestMicrophoneAccess() {
  if (!navigator.mediaDevices?.getUserMedia) return true;

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());
    return true;
  } catch {
    voiceState.textContent = "צריך לאשר מיקרופון בדפדפן";
    return false;
  }
}

async function startRecording() {
  if (!recognition) return;

  const hasAccess = await requestMicrophoneAccess();
  if (!hasAccess) return;

  try {
    baseTranscript = input.value.trim();
    recordedText = baseTranscript;
    finalTranscripts = [];
    shouldKeepRecording = true;
    recognition.start();
  } catch {
    voiceState.textContent = "ההקלטה כבר פעילה";
  }
}

parseButton.addEventListener("click", parseInput);
clearInputButton.addEventListener("click", () => {
  input.value = "";
  input.focus();
});
manualAddButton.addEventListener("click", () => {
  addItems([manualItemInput.value]);
  manualItemInput.value = "";
  manualItemInput.focus();
});
manualItemInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") manualAddButton.click();
});
whatsappButton.addEventListener("click", openWhatsApp);
removeDoneButton.addEventListener("click", () => {
  items = items.filter((item) => !item.done);
  saveItems();
  render();
});
clearListButton.addEventListener("click", () => {
  items = [];
  saveItems();
  render();
});
recordButton.addEventListener("click", () => {
  if (!recognition) return;
  if (isRecording) {
    shouldKeepRecording = false;
    recognition.stop();
    return;
  }
  startRecording();
});

setupSpeechRecognition();
render();
