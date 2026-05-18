const STORAGE_KEY = "smart-shopping-list-v1";
const AUTH_STORAGE_KEY = "smart-shopping-list-auth-v1";
const PASSWORD_HASH =
  "bf33d21d3411821c223aab06db08e58a00062b80d5525121348bbc24a6d1c674";

const supabaseConfig = window.SHOPPING_APP_SUPABASE || {};
const hasCloudDb =
  supabaseConfig.url &&
  supabaseConfig.anonKey &&
  !supabaseConfig.url.includes("PASTE_") &&
  !supabaseConfig.anonKey.includes("PASTE_") &&
  window.supabase;
const db = hasCloudDb
  ? window.supabase.createClient(supabaseConfig.url, supabaseConfig.anonKey)
  : null;

const authForm = document.querySelector("#authForm");
const passwordInput = document.querySelector("#passwordInput");
const authError = document.querySelector("#authError");
const authHelper = document.querySelector("#authHelper");
const authInputLabel = document.querySelector("#authInputLabel");
const logoutButton = document.querySelector("#logoutButton");
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
const membersPanel = document.querySelector("#membersPanel");
const membersSummary = document.querySelector("#membersSummary");
const memberForm = document.querySelector("#memberForm");
const memberEmailInput = document.querySelector("#memberEmailInput");
const membersList = document.querySelector("#membersList");

const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition || null;

let items = [];
let members = [];
let currentUser = null;
let currentList = null;
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
  "סוכר",
  "סבון",
  "סלט",
  "ענבים",
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
  "שמנת",
  "שניצל",
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

function setLocked(locked) {
  document.body.classList.toggle("locked", locked);
}

function configureAuthUi() {
  if (!hasCloudDb) {
    membersPanel.classList.add("hidden");
    setLocked(localStorage.getItem(AUTH_STORAGE_KEY) !== PASSWORD_HASH);
    return;
  }

  authHelper.textContent = "התחבר עם אימייל. אם אין לך משתמש, Supabase ישלח קישור כניסה.";
  authInputLabel.textContent = "אימייל";
  passwordInput.type = "email";
  passwordInput.placeholder = "name@example.com";
  passwordInput.autocomplete = "email";
  setLocked(true);
}

async function sha256(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function loadLocalItems() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveLocalItems() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  showSaved();
}

function showSaved(text = "נשמר עכשיו") {
  savedStatus.textContent = text;
  window.setTimeout(() => {
    savedStatus.textContent = hasCloudDb ? "מסונכרן בענן" : "נשמר מקומית";
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

async function ensureCloudList() {
  if (!hasCloudDb || !currentUser) return;

  await db.rpc("accept_my_invites");

  const { data: memberships, error: memberError } = await db
    .from("list_members")
    .select("list_id, role, shopping_lists(id, name, owner_id)")
    .eq("user_id", currentUser.id)
    .limit(1);

  if (memberError) throw memberError;

  if (memberships?.length) {
    currentList = memberships[0].shopping_lists;
    return;
  }

  const { data: list, error: listError } = await db
    .from("shopping_lists")
    .insert({ name: "רשימת קניות", owner_id: currentUser.id })
    .select()
    .single();

  if (listError) throw listError;
  currentList = list;

  const { error: ownerError } = await db.from("list_members").insert({
    list_id: list.id,
    user_id: currentUser.id,
    email: currentUser.email.toLowerCase(),
    role: "owner",
    invited_by: currentUser.id,
    accepted_at: new Date().toISOString(),
  });

  if (ownerError) throw ownerError;
}

async function loadCloudData() {
  if (!currentList) return;

  const [{ data: cloudItems, error: itemsError }, { data: cloudMembers, error: membersError }] =
    await Promise.all([
      db
        .from("shopping_items")
        .select("id, name, done, created_at")
        .eq("list_id", currentList.id)
        .order("created_at", { ascending: false }),
      db
        .from("list_members")
        .select("id, email, role, accepted_at")
        .eq("list_id", currentList.id)
        .order("created_at", { ascending: true }),
    ]);

  if (itemsError) throw itemsError;
  if (membersError) throw membersError;

  items = cloudItems || [];
  members = cloudMembers || [];
  render();
  renderMembers();
}

async function initCloudSession() {
  if (!hasCloudDb) return;

  const { data } = await db.auth.getSession();
  currentUser = data.session?.user || null;

  if (!currentUser) {
    setLocked(true);
    return;
  }

  setLocked(false);
  savedStatus.textContent = "מסונכרן בענן";
  try {
    await ensureCloudList();
    await loadCloudData();
  } catch (error) {
    authError.textContent = error.message || "לא הצלחתי לטעון את ה-DB";
  }
}

async function addItems(names) {
  const existing = new Set(items.map((item) => item.name.toLowerCase()));
  const additions = names
    .map(normalizeName)
    .filter(Boolean)
    .filter((name) => {
      const key = name.toLowerCase();
      if (existing.has(key)) return false;
      existing.add(key);
      return true;
    });

  if (!additions.length) return;

  if (hasCloudDb) {
    const rows = additions.map((name) => ({
      list_id: currentList.id,
      name,
      done: false,
      created_by: currentUser.id,
    }));
    const { error } = await db.from("shopping_items").insert(rows);
    if (error) throw error;
    await loadCloudData();
    showSaved();
    return;
  }

  items = [
    ...additions.map((name) => ({
      id: crypto.randomUUID(),
      name,
      done: false,
      createdAt: Date.now(),
    })),
    ...items,
  ];
  saveLocalItems();
  render();
}

async function updateItemDone(item, done) {
  if (hasCloudDb) {
    const { error } = await db.from("shopping_items").update({ done }).eq("id", item.id);
    if (error) throw error;
    await loadCloudData();
    return;
  }

  item.done = done;
  saveLocalItems();
  render();
}

async function deleteItem(id) {
  if (hasCloudDb) {
    const { error } = await db.from("shopping_items").delete().eq("id", id);
    if (error) throw error;
    await loadCloudData();
    return;
  }

  items = items.filter((candidate) => candidate.id !== id);
  saveLocalItems();
  render();
}

async function removeDoneItems() {
  if (hasCloudDb) {
    const { error } = await db
      .from("shopping_items")
      .delete()
      .eq("list_id", currentList.id)
      .eq("done", true);
    if (error) throw error;
    await loadCloudData();
    return;
  }

  items = items.filter((item) => !item.done);
  saveLocalItems();
  render();
}

async function clearItems() {
  if (hasCloudDb) {
    const { error } = await db.from("shopping_items").delete().eq("list_id", currentList.id);
    if (error) throw error;
    await loadCloudData();
    return;
  }

  items = [];
  saveLocalItems();
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

    checkbox.addEventListener("change", () => updateItemDone(item, checkbox.checked));
    deleteButton.addEventListener("click", () => deleteItem(item.id));
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

function renderMembers() {
  membersList.innerHTML = "";

  if (!hasCloudDb) {
    membersSummary.textContent = "זמין אחרי חיבור DB ענני";
    return;
  }

  membersSummary.textContent = `${members.length} אנשים עם גישה לרשימה`;
  members.forEach((member) => {
    const node = document.createElement("li");
    node.className = "member-item";
    node.innerHTML = `
      <span>${member.email}</span>
      <span class="member-role">${member.accepted_at ? member.role : "ממתין לאישור במייל"}</span>
    `;
    membersList.append(node);
  });
}

async function parseInput() {
  try {
    const names = extractItems(input.value);
    await addItems(names);
    if (names.length) input.value = "";
  } catch (error) {
    authError.textContent = error.message || "לא הצלחתי לשמור";
  }
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

async function handleAuthSubmit(event) {
  event.preventDefault();
  authError.textContent = "";

  if (hasCloudDb) {
    const email = passwordInput.value.trim().toLowerCase();
    if (!email) return;
    const { error } = await db.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin + window.location.pathname },
    });
    authError.textContent = error
      ? error.message
      : "שלחתי לך קישור כניסה למייל. פתח אותו מהמכשיר הזה.";
    return;
  }

  const hash = await sha256(passwordInput.value);
  if (hash !== PASSWORD_HASH) {
    authError.textContent = "סיסמה לא נכונה";
    passwordInput.select();
    return;
  }

  localStorage.setItem(AUTH_STORAGE_KEY, hash);
  passwordInput.value = "";
  authError.textContent = "";
  setLocked(false);
}

async function logout() {
  if (hasCloudDb) {
    await db.auth.signOut();
    currentUser = null;
    currentList = null;
    items = [];
    members = [];
    render();
    renderMembers();
    setLocked(true);
    return;
  }

  localStorage.removeItem(AUTH_STORAGE_KEY);
  setLocked(true);
  passwordInput.focus();
}

async function addMember(event) {
  event.preventDefault();
  if (!hasCloudDb || !currentList) return;

  const email = memberEmailInput.value.trim().toLowerCase();
  if (!email) return;

  const { error } = await db.from("list_members").insert({
    list_id: currentList.id,
    email,
    role: "member",
    invited_by: currentUser.id,
  });

  if (error) {
    authError.textContent = error.message;
    return;
  }

  memberEmailInput.value = "";
  await loadCloudData();
}

authForm.addEventListener("submit", handleAuthSubmit);
logoutButton.addEventListener("click", logout);
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
memberForm.addEventListener("submit", addMember);
whatsappButton.addEventListener("click", openWhatsApp);
removeDoneButton.addEventListener("click", removeDoneItems);
clearListButton.addEventListener("click", clearItems);
recordButton.addEventListener("click", () => {
  if (!recognition) return;
  if (isRecording) {
    shouldKeepRecording = false;
    recognition.stop();
    return;
  }
  startRecording();
});

if (hasCloudDb) {
  db.auth.onAuthStateChange((_event, session) => {
    currentUser = session?.user || null;
    initCloudSession();
  });
} else {
  items = loadLocalItems();
}

configureAuthUi();
setupSpeechRecognition();
render();
renderMembers();
initCloudSession();
