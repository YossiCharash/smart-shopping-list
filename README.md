# רשימת קניות חכמה

אפליקציית web בעברית ליצירת רשימת קניות מטקסט או מהקלטה, ניהול מוצרים בדשבורד ושליחה ל-WhatsApp בלחיצה.

## הרצה מקומית

```powershell
python -m http.server 5173 --bind 127.0.0.1
```

ואז לפתוח:

```text
http://127.0.0.1:5173/
```

## DB ענני ומשתמשים

האפליקציה מוכנה לעבוד עם Supabase:

1. צור פרויקט חדש ב-Supabase.
2. פתח את SQL Editor והריץ את כל הקובץ `supabase-schema.sql`.
3. עבור אל Project Settings > API והעתק:
   - Project URL
   - anon public key
4. פתח את `supabase-config.js` והחלף את הערכים:

```js
window.SHOPPING_APP_SUPABASE = {
  url: "https://YOUR_PROJECT.supabase.co",
  anonKey: "YOUR_ANON_KEY",
};
```

5. העלה את השינוי ל-GitHub Pages.

אחרי החיבור:

- הכניסה תהיה עם אימייל וקישור חד-פעמי.
- הרשימה תישמר בענן ותופיע מכל מחשב או טלפון.
- אפשר להוסיף אנשים לפי אימייל במסך "אנשים ברשימה".
- מי שהוספת צריך להיכנס לאתר עם אותו אימייל כדי לקבל גישה.

אם Supabase לא מוגדר, האתר ממשיך לעבוד במצב המקומי הישן עם סיסמה ו-localStorage.

## הקלטה

הקלטה דרך הדפדפן עובדת רק בדפדפנים שתומכים ב-Web Speech API, בדרך כלל Chrome או Edge. צריך לאשר הרשאת מיקרופון.

בענן חובה להריץ דרך HTTPS. ב-localhost זה אמור לעבוד גם ללא HTTPS, אבל הדפדפן המובנה של Codex עלול לחסום הרשאת מיקרופון.

## פריסה בענן

האפליקציה היא אתר סטטי, לכן אפשר להעלות אותה ל-GitHub Pages, Vercel, Netlify או Cloudflare Pages.
