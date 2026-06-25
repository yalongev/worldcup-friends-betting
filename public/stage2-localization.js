(function () {
    function isIgnoredElement(node) {
        if (!node || !node.parentElement) return false;
        const tagName = node.parentElement.tagName;
        return tagName === 'SCRIPT' || tagName === 'STYLE' || tagName === 'NOSCRIPT';
    }

    function isIgnoredContainer(el) {
        if (!el || !el.tagName) return false;
        const tagName = el.tagName;
        return tagName === 'SCRIPT' || tagName === 'STYLE' || tagName === 'NOSCRIPT';
    }

    const exactMap = new Map([
        ['לובי טורניר המונדיאל', 'World Cup Tournament Lobby'],
        ['🏆 קבוצות המונדיאל שלי 🏆', '🏆 My World Cup Groups 🏆'],
        ['לובי הטורנירים הרשמי שלך', 'Your official tournament hub'],
        ['הקבוצות הפעילות שלי:', 'My active groups:'],
        ['רוצה להוביל טורניר משלך? 🛠️', 'Want to run your own tournament? 🛠️'],
        ['➕ הקם קבוצה חדשה', '➕ Create a New Group'],
        ['עדיין לא הצטרפת לאף קבוצה.', 'You have not joined any group yet.'],
        ['שלום,', 'Hello,'],
        ['טוען קבוצה...', 'Loading group...'],
        ['טוען חברים בקבוצה...', 'Loading group members...'],
        ['הימורים שלי', 'My Predictions'],
        ['לוח תוצאות', 'Leaderboard'],
        ['העתק לינק הזמנה', 'Copy Invite Link'],
        ['ניהול ותשלומים', 'Admin & Payments'],
        ['הימורים נעולים', 'Predictions Locked'],
        ['הועתק ללוח!', 'Copied!'],
        ['יצירת קבוצת הימורי מונדיאל', 'Create World Cup Betting Group'],
        ['🛠️ הקמת קבוצת הימורים חדשה', '🛠️ Create a New Betting Group'],
        ['🏆 יצירת קבוצת הימורים חדשה', '🏆 Create a New Betting Group'],
        ['שם הקבוצה:', 'Group Name:'],
        ['למשל: החבר\'ה מהעבודה', 'Example: Office Crew'],
        ['הכינוי שלך (המנהל):', 'Your Nickname (Admin):'],
        ['למשל: משה המלך', 'Example: Mike The Boss'],
        ['שלב התחלת הטורניר:', 'Tournament Start Stage:'],
        ['ממשחק הפתיחה (טורניר מלא) 🌍', 'From opening match (full tournament) 🌍'],
        ['משמינית הגמר ועד הגמר ⚽', 'From round of 16 to final ⚽'],
        ['מרבע הגמר ועד הגמר 🏆', 'From quarterfinal to final 🏆'],
        ['🔗 קישור לקבוצת PayBox (לאיסוף הכסף):', '🔗 PayBox Group Link (for collecting payments):'],
        ['ℹ️ הסבר', 'ℹ️ Help'],
        ['💰 עלות השתתפות לאדם (ב-₪):', '💰 Entry Fee per Person (ILS):'],
        ['הדבק כאן את קישור השיתוף של פייבוקס', 'Paste your PayBox invite link here'],
        ['למשל: 50', 'Example: 50'],
        ['📱 איך מקימים קבוצת PayBox ומביאים לינק?', '📱 How to create a PayBox group and get a link'],
        ['🚀 פתח\n                                    את\n                                    PayBox כעת', '🚀 Open PayBox now'],
        ['הבנתי,', 'Got it,'],
        ['תודה!', 'Thanks!'],
        ['צור', 'Create'],
        ['קבוצה וקבל קישור', 'Group & Get Link'],
        ['חזור ללובי הקבוצות שלי', 'Back to My Groups Lobby'],
        ['הזנת ניחושים - מונדיאל', 'Submit Predictions - World Cup'],
        ['טוען נתוני קבוצה...', 'Loading group details...'],
        ['👋 ברוך הבא לטורניר!', '👋 Welcome to the tournament!'],
        ['שם מלא לקבוצה:', 'Full name for this group:'],
        ['הקלד שם פרטי ומשפחה', 'Enter your first and last name'],
        ['נראה שזו הכניסה הראשונה שלך מקבוצת הוואטסאפ. איך קוראים לך?', 'Looks like this is your first time joining from the group invite. What is your name?'],
        ['הצטרף לקבוצה והמשך להימורים', 'Join Group and Continue'],
        ['🏆 הימורי המונדיאל שלי 🏆', '🏆 My World Cup Predictions 🏆'],
        ['טוען סטטוס תשלום...', 'Loading payment status...'],
        ['🥇 מקום ראשון (האלופה)', '🥇 First Place (Champion)'],
        ['🥈 מקום שני (סגנית)', '🥈 Second Place (Runner-up)'],
        ['⚽ מלך השערים (מקום 1)', '⚽ Top Scorer (1st)'],
        ['שמור את הניחושים שלי', 'Save My Predictions'],
        ['⬅️ ביטול וחזרה ללובי', '⬅️ Cancel and Return to Lobby'],
        ['ניהול קבוצה ותשלומים', 'Group Management & Payments'],
        ['⬅️ חזרה ללובי', '⬅️ Back to Lobby'],
        ['🛠️ פאנל ניהול ותשלומים', '🛠️ Admin & Payments Panel'],
        ['ניהול קבוצת:', 'Managing Group:'],
        ['טוען נתונים...', 'Loading data...'],
        ['👥 סטטוס תשלומים בקבוצה:', '👥 Group Payment Status:'],
        ['עדכן עלות כניסה', 'Update Entry Fee'],
        ['עדכן קישור PayBox', 'Update PayBox Link'],
        ['שמור', 'Save'],
        ['בטל', 'Cancel'],
        ['לוח תוצאות וניחושים', 'Leaderboard & Predictions'],
        ['⬅️ לובי קבוצות', '⬅️ Groups Lobby'],
        ['📋 העתק לינק הזמנה לחברים', '📋 Copy Invite Link'],
        ['📊 לוח התוצאות', '📊 Leaderboard'],
        ['טוען נתונים...', 'Loading data...'],
        ['💰 עלות כניסה', '💰 Entry Fee'],
        ['👥 משתתפים ששילמו', '👥 Paid Participants'],
        ['🏆 סך הכל בקופה למנצח', '🏆 Total Winner Pot'],
        ['📊 תובנות מהקבוצה:', '📊 Group Insights:'],
        ['מחשב נתונים סטטיסטיים...', 'Calculating stats...'],
        ['טוען נתוני טבלה מ-football-data.org...', 'Loading standings from football-data.org...'],
        ['🏆 טבלת בתי המונדיאל', '🏆 World Cup Group Table'],
        ['👥 חברי הקבוצה והניחושים שלהם:', '👥 Group Members and Predictions:'],
        ['שם המשתתף', 'Participant'],
        ['🥇 אלופה', '🥇 Champion'],
        ['🥈 סגנית', '🥈 Runner-up'],
        ['⚽ מלך השערים', '⚽ Top Scorer'],
        ['💰 סטטוס', '💰 Status'],
        ['Super Admin Dashboard - מנהל מערכת', 'Super Admin Dashboard'],
        ['🛠️ כניסת מנהל על', '🛠️ Super Admin Login'],
        ['אנא הזן סיסמת Super Admin כדי לצפות בנתוני המערכת:', 'Enter the Super Admin password to access platform analytics:'],
        ['התחבר למערכת', 'Sign In'],
        ['📊 לוח בקרת מנהל מערכת - Super Admin', '📊 Super Admin Control Board'],
        ['🛠️ שנה שם הקבוצה:', '🛠️ Rename Group:'],
        ['🔐 נעילת הימורים ותחילת הטורניר', '🔐 Lock Predictions & Start Tournament'],
        ['השאר אותם כצופים:', 'Keep them as spectators:'],
        ['הסר אותם לחלוטין:', 'Remove them entirely:'],
        ['🔒 נעל הימורים עכשיו', '🔒 Lock Predictions Now'],
        ['💰 עלות לכל משתתף', '💰 Entry fee per participant'],
        ['✅ סה"כ שולם', '✅ Total paid'],
        ['⚠️ סה"כ לא שולם', '⚠️ Total unpaid'],
        ['🔗 קישור PayBox', '🔗 PayBox link'],
        ['עלות ב₪', 'Amount in ILS'],
        ['שנה כינוי בקבוצה זו:', 'Change nickname for this group:'],
        ['💳 תשלום ב-PayBox', '💳 Pay with PayBox'],
        ['טוען נבחרות...', 'Loading teams...'],
        ['טוען מועמדים...', 'Loading candidates...'],
        ['👥 סה"כ משתמשים ייחודיים', '👥 Total unique users'],
        ['🏆 סה"כ קבוצות שנפתחו', '🏆 Total groups created'],
        ['🏃‍♂️ ממוצע חברים בקבוצה', '🏃‍♂️ Avg members per group'],
        ['🔄 משתמשים ביותר מקבוצה אחת', '🔄 Users in multiple groups'],
        ['📅 קבוצות חדשות שנוצרו (לפי ימי השבוע)', '📅 New groups by weekday'],
        ['🍕 פילוח קבוצות לפי סוגי התמודדות', '🍕 Group split by tournament start']
    ]);

    const containsMap = [
        ['👑 מנהל:', '👑 Admin:'],
        ['קבוצה:', 'Group:'],
        ['ניהול קבוצת:', 'Managing Group:'],
        ['מחובר כעת בתור:', 'Logged in as:'],
        ['סטטוס תשלום: שולם', 'Payment status: Paid'],
        ['סטטוס תשלום: טרם שולם', 'Payment status: Unpaid'],
        ['עלות כניסה:', 'Entry fee:'],
        ['לא הוגדר', 'Not set'],
        ['שגיאה', 'Error'],
        ['טרם שולם', 'Unpaid'],
        ['שולם', 'Paid'],
        ['צופה בלבד', 'Spectator only'],
        ['משתתף זמני', 'Temporary participant'],
        ['לא ניתן להעתיק ללוח. אנא העתק ידנית', 'Could not copy to clipboard. Please copy manually'],
        ['הצטרפו לקבוצה שלי ב-WorldCup Friends Betting', 'Join my group on WorldCup Friends Betting'],
        ['הועתק לקליפבורד', 'Copied to clipboard'],
        ['הקבוצה לא קיימת', 'Group does not exist'],
        ['טוען נבחרות', 'Loading teams'],
        ['בחר נבחרת', 'Select a team'],
        ['לא ניתן לטעון נבחרות', 'Unable to load teams'],
        ['טוען מועמדים', 'Loading candidates'],
        ['לא ניתן לטעון מועמדים', 'Unable to load candidates'],
        ['בחר מועמד', 'Select candidate'],
        ['ההימורים לקבוצה זו ננעלו', 'Predictions for this group are locked'],
        ['ההימורים נעולים', 'Predictions are locked'],
        ['שגיאה בשמירה', 'Save error'],
        ['שגיאה בתקשורת', 'Communication error'],
        ['נא להזין שם כדי להמשיך', 'Please enter your name to continue'],
        ['שגיאה בהצטרפות', 'Join error'],
        ['נא להזין שם תקין כדי לשמור', 'Please enter a valid name to save'],
        ['שמך עודכן בהצלחה במערכת', 'Your name was updated successfully'],
        ['לא ניתן לטעון את טבלת הבתים', 'Unable to load standings table'],
        ['אין נתוני טבלה זמינים כרגע', 'No standings data available at the moment'],
        ['אין נתוני טבלת בתים זמינים', 'No group standings data available'],
        ['שגיאה בטעינת טבלת הבתים', 'Error while loading standings'],
        ['טרם ניחש', 'No prediction yet'],
        ['הנבחרת הפייבוריטית בקבוצה היא', 'The favorite team in this group is'],
        ['עדיין לא הוזנו ניחושים', 'No predictions submitted yet'],
        ['הועתקו בהצלחה', 'Copied successfully'],
        ['סטטוס התשלום עודכן', 'Payment status updated'],
        ['שגיאה בעדכון התשלום', 'Error updating payment'],
        ['האם אתה בטוח שברצונך לנעול את ההימורים? לא ניתן יהיה לבטל פעולה זו!', 'Are you sure you want to lock predictions? This action cannot be undone.'],
        ['הטורניר ננעל! ההימורים סגורים רשמית.', 'Tournament locked! Predictions are now officially closed.'],
        ['שגיאה בנעילת ההימורים', 'Error locking predictions'],
        ['שם הקבוצה עודכן בהצלחה', 'Group name updated successfully'],
        ['אין לך הרשאה לשנות את שם הקבוצה', 'You are not authorized to rename this group'],
        ['שם קבוצה אינו יכול להיות ריק', 'Group name cannot be empty'],
        ['שם המשתמש עודכן בהצלחה', 'Username updated successfully'],
        ['שם משתמש אינו יכול להיות ריק', 'Username cannot be empty'],
        ['לא נמצאו', 'not found'],
        ['שגיאה בכניסה', 'Login error'],
        ['שגיאה בתקשורת עם השרת', 'Server communication error'],
        ['סיסמת מנהל שגויה', 'Invalid admin password'],
        ['קבוצות שנוצרו', 'Groups created'],
        ['ברגע שתנעל את ההימורים, אף משתמש לא יוכל לשנות או להזין ניחוש חדש. מה תרצה לעשות עם משתמשים שלא שילמו?', 'Once predictions are locked, no user can add or edit predictions. What should happen to unpaid users?'],
        ['יופיעו בתחתית הלידרבורד עם 0 נקודות ואייקון 🚫', 'They will appear at the bottom of the leaderboard with 0 points and a 🚫 icon'],
        ['הם לא יופיעו בכלל בלוח התוצאות של החברים', 'They will not appear on the friends leaderboard'],
        ['ראשון', 'Sunday'],
        ['שני', 'Monday'],
        ['שלישי', 'Tuesday'],
        ['רביעי', 'Wednesday'],
        ['חמישי', 'Thursday'],
        ['שישי', 'Friday'],
        ['שבת', 'Saturday']
    ];

    function translateText(value) {
        if (!value) return value;
        const trimmed = value.trim();
        if (!trimmed) return value;

        if (exactMap.has(trimmed)) {
            return value.replace(trimmed, exactMap.get(trimmed));
        }

        let updated = value;
        containsMap.forEach(([source, target]) => {
            if (updated.includes(source)) {
                updated = updated.split(source).join(target);
            }
        });

        return updated;
    }

    function walkAndTranslate(root) {
        if (!root) return;

        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        const nodes = [];
        while (walker.nextNode()) {
            nodes.push(walker.currentNode);
        }

        nodes.forEach((node) => {
            if (isIgnoredElement(node)) return;
            if (!node.nodeValue) return;
            const translated = translateText(node.nodeValue);
            if (translated !== node.nodeValue) {
                node.nodeValue = translated;
            }
        });

        const attrTargets = root.querySelectorAll
            ? root.querySelectorAll('[placeholder],[title],[aria-label],[value]')
            : [];
        attrTargets.forEach((el) => {
            if (isIgnoredContainer(el)) return;
            ['placeholder', 'title', 'aria-label', 'value'].forEach((attr) => {
                const current = el.getAttribute(attr);
                if (!current) return;
                const translated = translateText(current);
                if (translated !== current) {
                    el.setAttribute(attr, translated);
                }
            });
        });
    }

    function patchDialogApi() {
        const baseAlert = window.alert;
        const baseConfirm = window.confirm;
        const basePrompt = window.prompt;

        window.alert = function (msg) {
            return baseAlert.call(window, translateText(String(msg || '')));
        };

        window.confirm = function (msg) {
            return baseConfirm.call(window, translateText(String(msg || '')));
        };

        window.prompt = function (msg, def) {
            return basePrompt.call(window, translateText(String(msg || '')), def);
        };
    }

    function enforceEnglishDocumentDirection() {
        document.documentElement.setAttribute('lang', 'en');
        document.documentElement.setAttribute('dir', 'ltr');
        document.body && document.body.setAttribute('dir', 'ltr');
    }

    function initLocalization() {
        patchDialogApi();
        enforceEnglishDocumentDirection();
        walkAndTranslate(document.body);

        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'characterData' && mutation.target) {
                    if (isIgnoredElement(mutation.target)) return;
                    const translated = translateText(mutation.target.nodeValue);
                    if (translated !== mutation.target.nodeValue) {
                        mutation.target.nodeValue = translated;
                    }
                }

                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.TEXT_NODE) {
                        if (isIgnoredElement(node)) return;
                        node.nodeValue = translateText(node.nodeValue);
                    } else if (node.nodeType === Node.ELEMENT_NODE) {
                        if (isIgnoredContainer(node)) return;
                        walkAndTranslate(node);
                    }
                });
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initLocalization);
    } else {
        initLocalization();
    }
})();
