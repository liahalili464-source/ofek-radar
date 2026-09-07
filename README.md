# OFEK RADAR

Web app לניהול מחזורי ראיונות ומיון מועמדים, מותאם RTL ובנוי לפריסה ב-Vercel עם Supabase כ-Backend.

## מה קיים בגרסת הפיתוח הנוכחית

- מסך התחברות בעברית, עם מעבר בין Admin / Interviewer בדמו.
- Dark / Light mode ושפה עיצובית המבוססת על המסכים והלוגו שסופקו.
- דשבורד מחזורי ראיונות + עמוד סיכום למחזור ספציפי.
- פתיחת מחזור: פרטים, יחידות, ימי ראיונות, משך ראיון ובדיקת קיבולת.
- Excel Import אמיתי בדפדפן: XLS/XLSX, Preview, זיהוי אוטומטי ומיפוי עמודות, איתור ת.ז כפולות/חסרות ונרמול שורות.
- רשימת מועמדים וכרטיס מועמד עם מידע מקור + שאלון + ראיונות + חוות דעת + ציר זמן.
- בונה שאלון ללא קוד: הוספה, עריכה, מחיקה, שינוי סדר, סוגי שדות, אפשרויות, חובה/רשות ומיפוי לשדות מועמד.
- טופס מועמד ציבורי לדמו ב-`/form/demo`.
- ניהול משתמשים בדמו + API אמיתי ליצירת Supabase Auth users כאשר ה-Backend מחובר.
- צד מראיין עם סדר יום אישי וכרטיסי מועמדים.
- מנוע שיבוץ Round-Robin/edge-coloring: כל מועמד פוגש כל יחידה בדיוק פעם אחת, בלי שמועמד או יחידה ישובצו פעמיים באותו סלוט.
- תמיכה בהפסקות בתוך ימי ראיונות ובדיקת Capacity לפני בניית לוח.
- סכמת PostgreSQL מלאה יחסית + RLS לפי מנהל/מראיין + public questionnaire RPC מאובטח בטוקן.
- Route handlers ליצירת מחזורים, משתמשים, ייבוא מועמדים, שמירת לו״ז ושאלון ציבורי.

## הרצה מקומית

```bash
npm install
npm run dev
```

פתחי `http://localhost:3000`.

### מצב Demo

אם אין משתני Supabase, המערכת נשארת פתוחה לצורך פיתוח ובדיקת הממשק.

- `admin` → צד מנהל
- `interviewer1` → צד מראיין
- כל סיסמה עובדת במצב Demo בלבד.

בונה השאלון וניהול המשתמשים נשמרים ב-localStorage במצב Demo.

## חיבור Supabase

1. צרי פרויקט Supabase בסביבה שאושרה לשימוש.
2. הריצי `supabase/schema.sql`.
3. אופציונלי: הריצי `supabase/seed.sql` ליצירת יחידות בסיס.
4. העתיקי `.env.example` ל-`.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

5. ב-Supabase Auth צרי את משתמש המנהל הראשון עם email פנימי בסגנון `admin@ofek-radar.local`.
6. הכניסי שורה תואמת ל-`profiles` עם אותו UUID ו-`role='admin'`.
7. מעכשיו מנהל יכול ליצור משתמשים נוספים דרך `/api/admin/users` / ממשק הניהול לאחר החיבור.

> `SUPABASE_SERVICE_ROLE_KEY` הוא Server-only. אסור להוסיף לו `NEXT_PUBLIC_` ואסור לחשוף אותו בדפדפן.

## Vercel

אחרי העלאה ל-GitHub:

1. Import Project ב-Vercel.
2. הגדירי את שלושת משתני הסביבה.
3. Build command: `npm run build`.
4. Deploy.

## מבנה מרכזי

```text
app/
  login/                 כניסה
  cycles/                כל המחזורים
  cycles/[id]/           סיכום מחזור
  cycles/new/            פתיחה/עריכת מחזור
  candidates/            רשימת מועמדים
  candidates/[id]/       כרטיס מועמד
  questionnaire/         בונה שאלון
  form/[token]/          שאלון ציבורי
  schedule/              Capacity + שיבוץ אוטומטי
  interviewer/           צד מראיין
  users/                 משתמשים
  settings/              ברירות מחדל
  api/                    Route handlers ל-Supabase
lib/scheduling.ts         מנוע השיבוץ
supabase/schema.sql       DB + RLS + RPC
```

## הערת אבטחת מידע

המערכת מיועדת להחזיק מידע אישי על מועמדים. לפני הכנסת ת.ז, טלפונים, תמונות או חוות דעת אמיתיות יש להשתמש רק בתשתית ובשירותי ענן שאושרו על ידי גורמי אבטחת המידע הרלוונטיים. גרסת הדמו משתמשת בנתונים פיקטיביים בלבד.

## השלב הבא בפיתוח

- חיבור כל מסכי ה-UI בפועל ל-Supabase במקום נתוני דמו.
- יצירת מחזור מלאה ב-flow אחד כולל יצירת questionnaire links.
- זמינות פרטנית למראיינים/יחידות וחסימות זמן.
- שינוי ידני ונעילת סלוטים לאחר יצירת לוח.
- ייצוא Excel/PDF ודוחות.
- Audit log אוטומטי לכל שינוי רגיש.
