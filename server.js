const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'database.json');

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

function readDB() {
    if (!fs.existsSync(DB_FILE)) {
        const initialDB = { users: {}, groups: {}, predictions: {}, system_results: {} };
        fs.writeFileSync(DB_FILE, JSON.stringify(initialDB, null, 2));
        return initialDB;
    }
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

function writeDB(data) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

app.post('/api/groups/create', (req, res) => {
    const { groupName, creatorName, tournamentStage, userId } = req.body;

    if (!groupName || groupName.trim() === "" || !creatorName || creatorName.trim() === "") {
        return res.status(400).json({ success: false, message: "שם קבוצה ושם מנהל הם שדות חובה!" });
    }

    const db = readDB();
    const groupId = 'group_' + Math.random().toString(36).substring(2, 9);

    // שמירת משתמש המנהל באוסף המשתמשים הכללי (אם עדיין לא קיים)
    if (!db.users[userId]) {
        db.users[userId] = {
            name: creatorName.trim(),
            email: "",
            created_at: new Date().toISOString()
        };
    }

    // בניית האובייקט החדש ללא כפילויות של adminName!
    const entryFee = Number(req.body.entryFee) || 0;
    const payboxLink = req.body.payboxLink ? String(req.body.payboxLink).trim() : "";

    db.groups[groupId] = {
        group_name: groupName.trim(),
        admin_id: userId,
        paybox_link: payboxLink,
        entry_fee: entryFee,
        status: 'voting_open',
        betsLocked: false,
        tournamentStage: tournamentStage || "full", // נשמר ישירות ב-DB
        members: {
            [userId]: {
                userName: creatorName.trim(),
                has_paid: true, // מנהל הקבוצה מסומן כמשולם אוטומטית
                registeredAt: new Date().toISOString()
            }
        }
    };

    writeDB(db);

    res.json({
        success: true,
        groupId: groupId
    });
});

// API: נעילת הימורים לקבוצה וקביעת מצב המשתתפים שלא שילמו
app.post('/api/groups/:id/lock', (req, res) => {
    const groupId = req.params.id;
    const { lockMode } = req.body; // 'spectator' או 'remove'
    const db = readDB();

    if (!db.groups[groupId]) {
        return res.status(404).json({ success: false, message: "הקבוצה לא קיימת" });
    }

    // עדכון מצב הקבוצה ב-DB
    db.groups[groupId].betsLocked = true;
    db.groups[groupId].unpaidLockMode = lockMode; // שמירת ההחלטה: צופים או הסרה

    writeDB(db);
    res.json({ success: true, message: "ההימורים ננעלו בהצלחה!", betsLocked: true, unpaidLockMode: lockMode });
});

// API: עדכון סטטוס תשלום של חבר קבוצה על ידי המנהל
app.post('/api/groups/toggle-payment', (req, res) => {
    const { groupId, userId, hasPaid } = req.body;
    const db = readDB();

    if (db.groups[groupId] && db.groups[groupId].members[userId]) {
        // עדכון הסטטוס ב-DB
        db.groups[groupId].members[userId].has_paid = hasPaid;
        writeDB(db);
        return res.json({ success: true, message: "סטטוס התשלום עודכן" });
    }

    res.status(404).json({ success: false, message: "קבוצה או משתמש לא נמצאו" });
});

app.post('/api/groups/:id/update-entry-fee', (req, res) => {
    const groupId = req.params.id;
    const { entryFee } = req.body;
    const db = readDB();

    if (!db.groups[groupId]) {
        return res.status(404).json({ success: false, message: "הקבוצה לא נמצאה" });
    }

    db.groups[groupId].entry_fee = Number(entryFee) || 0;
    writeDB(db);
    res.json({ success: true, message: "עלות ההשתתפות עודכנה" });
});

app.post('/api/groups/:id/update-paybox-link', (req, res) => {
    const groupId = req.params.id;
    const { payboxLink } = req.body;
    const db = readDB();

    if (!db.groups[groupId]) {
        return res.status(404).json({ success: false, message: "הקבוצה לא נמצאה" });
    }

    db.groups[groupId].paybox_link = payboxLink ? String(payboxLink).trim() : "";
    writeDB(db);
    res.json({ success: true, message: "קישור PayBox עודכן" });
});

app.post('/api/predictions/save', (req, res) => {
    const { groupId, userId, teams, scorers } = req.body;
    const db = readDB();

    if (!db.groups[groupId] || db.groups[groupId].status !== 'voting_open') {
        return res.status(400).json({ success: false, message: "ההצבעה נעולה או שהקבוצה לא קיימת" });
    }

    if (!db.predictions[groupId]) db.predictions[groupId] = {};

    db.predictions[groupId][userId] = {
        updated_at: new Date().toISOString(),
        teams,
        scorers
    };

    writeDB(db);
    res.json({ success: true });
});

// API: קבלת פרטי קבוצה, כולל שמות חברים, הניחושים שלהם ושם המנהל
app.get('/api/groups/:id', (req, res) => {
    const groupId = req.params.id;
    const db = readDB();

    if (!db.groups[groupId]) {
        return res.status(404).json({ success: false, message: "הקבוצה לא קיימת" });
    }

    const group = JSON.parse(JSON.stringify(db.groups[groupId])); // העתק עמוק

    // 🔥 שליפת שם מנהל הקבוצה מתוך רשימת המשתמשים
    if (db.users[group.admin_id]) {
        group.adminName = db.users[group.admin_id].name;
    } else {
        group.adminName = "מנהל מערכת";
    }

    // הזרקת השמות האמיתיים של המשתמשים לתוך אובייקט ה-members לטובת הלידרבורד
    if (group.members) {
        Object.keys(group.members).forEach(userId => {
            if (db.users[userId]) {
                group.members[userId].userName = db.users[userId].name;
            } else {
                group.members[userId].userName = "משתתף זמני";
            }
        });
    }

    // שליפת הניחושים ששייכים לקבוצה הזו
    const groupPredictions = db.predictions[groupId] || {};

    res.json({
        success: true,
        group: group,
        predictions: groupPredictions
    });
});

// API: הצטרפות משתמש לקבוצה קיימת
app.post('/api/groups/join', (req, res) => {
    const { groupId, name, email } = req.body;
    const db = readDB();

    // בדיקה שהקבוצה אכן קיימת בשרת
    if (!db.groups[groupId]) {
        return res.status(404).json({ success: false, message: "הקבוצה לא קיימת" });
    }

    // יצירת מזהה משתמש ייחודי חדש
    const userId = 'user_' + Math.random().toString(36).substr(2, 9);

    // 1. שמירה באוסף המשתמשים הכללי
    db.users[userId] = {
        name: name,
        email: email || "",
        created_at: new Date().toISOString()
    };

    // 2. הוספת המשתמש כחבר בקבוצה הספציפית הזו
    db.groups[groupId].members[userId] = {
        has_paid: false, // ברירת מחדל: טרם שילם
        total_score: 0
    };

    writeDB(db);

    // החזרת ה-userId החדש שהדפדפן ישמור בזיכרון שלו
    res.json({ success: true, userId: userId, name: name });
});

// סיסמת מנהל המערכת הראשי (Super Admin)
const SUPER_ADMIN_PASSWORD = "1696";

// API: שליפת סטטיסטיקות על ללוח הבקרה של מנהל המערכת
app.post('/api/super-admin/stats', (req, res) => {
    const { password } = req.body;

    // בדיקת אבטחה: אם הסיסמה שגויה, חוסמים מיד
    if (password !== SUPER_ADMIN_PASSWORD) {
        return res.status(403).json({ success: false, message: "סיסמת מנהל שגויה!" });
    }

    const db = readDB();
    const groups = db.groups || {};
    const predictions = db.predictions || {};

    const groupIds = Object.keys(groups);
    const totalGroups = groupIds.length;

    // 1. חישוב משתמשים וקבוצות
    let totalMembersCount = 0;
    const uniqueUsers = new Set(); // שומר רק IDs ייחודיים
    const userGroupCount = {}; // סופר בכמה קבוצות כל משתמש נמצא

    // ספירת סוגי טורנירים (לשלב הבא)
    const tournamentTypes = {
        "full": 0,       // משלב הבתים
        "round_of_16": 0, // משמינית גמר
        "quarter": 0     // מרבע גמר
    };

    groupIds.forEach(gId => {
        const group = groups[gId];
        const membersDict = group.members || {};
        const memberIds = Object.keys(membersDict);

        totalMembersCount += memberIds.length;

        memberIds.forEach(uId => {
            uniqueUsers.add(uId);
            userGroupCount[uId] = (userGroupCount[uId] || 0) + 1;
        });

        // ספירת סוג הטורניר (אם השדה קיים, אחרת נשייך כברירת מחדל ל-full)
        const stage = group.tournamentStage || "full";
        tournamentTypes[stage] = (tournamentTypes[stage] || 0) + 1;
    });

    const totalUniqueUsers = uniqueUsers.size;
    const avgMembersPerGroup = totalGroups > 0 ? (totalMembersCount / totalGroups).toFixed(1) : 0;

    // 2. חישוב כמה אנשים נמצאים בכמה קבוצות
    let usersInMultipleGroups = 0;
    Object.values(userGroupCount).forEach(count => {
        if (count > 1) usersInMultipleGroups++;
    });

    const percentageMultiple = totalUniqueUsers > 0
        ? ((usersInMultipleGroups / totalUniqueUsers) * 100).toFixed(0)
        : 0;

    // 3. פיקטיבי כרגע: קצב יצירת קבוצות לפי ימים (נדמה נתונים מתוך ה-DB הקיים)
    // הערה: כרגע אין לנו createdAt אמיתי, אז ניצור מערך דאמי של 7 הימים האחרונים בשביל הגרף
    const groupCreationDays = {
        "ראשון": 2, "שני": 4, "שלישי": 1, "רביעי": 5, "חמישי": 3, "שישי": totalGroups, "שבת": 0
    };

    // שליחת כל הנתונים המעובדים לדשבורד
    res.json({
        success: true,
        summary: {
            totalGroups,
            totalUniqueUsers,
            avgMembersPerGroup,
            percentageMultiple
        },
        charts: {
            tournamentTypes,
            groupCreationDays
        }
    });
});

// רק אם הקובץ רץ ישירות (ולא דרך טסט), נפעיל את השרת על פורט 3000
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });
}

// 1. API לעדכון שם הקבוצה (למנהל בלבד)
app.post('/api/groups/:id/update-name', (req, res) => {
    const groupId = req.params.id;
    const { newGroupName, currentUserId } = req.body;

    const db = readDB();
    const group = db.groups[groupId];

    if (!group) {
        return res.status(404).json({ success: false, message: "הקבוצה לא נמצאה" });
    }

    // בדיקת אבטחה: רק מנהל הקבוצה רשאי לשנות את שמה
    if (group.admin_id !== currentUserId) {
        return res.status(403).json({ success: false, message: "אין לך הרשאה לשנות את שם הקבוצה" });
    }

    if (!newGroupName || newGroupName.trim() === "") {
        return res.status(400).json({ success: false, message: "שם קבוצה אינו יכול להיות ריק" });
    }

    group.group_name = newGroupName.trim();
    writeDB(db);

    res.json({ success: true, message: "שם הקבוצה עודכן בהצלחה!", group_name: group.group_name });
});

// 2. API לעדכון שם המשתמש בקבוצה ספציפית
app.post('/api/groups/:id/update-username', (req, res) => {
    const groupId = req.params.id;
    const { userId, newUserName } = req.body;

    if (!newUserName || newUserName.trim() === "") {
        return res.status(400).json({ success: false, message: "שם משתמש אינו יכול להיות ריק" });
    }

    const db = readDB();
    const group = db.groups[groupId];

    if (!group || !group.members || !group.members[userId]) {
        return res.status(404).json({ success: false, message: "משתמש או קבוצה לא נמצאו" });
    }

    const cleanedName = newUserName.trim();

    // עדכון בתוך ה-Database
    group.members[userId].userName = cleanedName;

    // אם המשתמש הוא גם המנהל, נעדכן גם את שדה ה-adminName של הקבוצה לטובת הלובי
    if (group.admin_id === userId) {
        group.adminName = cleanedName;
    }

    writeDB(db);

    res.json({ success: true, message: "שם המשתמש עודכן בהצלחה!", userName: cleanedName });
});

// 🔥 שורת המפתח: מייצאים את אובייקט ה-app כדי שקובץ הבדיקות יוכל להשתמש בו
module.exports = app;