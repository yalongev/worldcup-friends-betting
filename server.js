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
    // 1. הוספנו כאן את entryFee כדי לקרוא את המחיר שהגיע מהטופס
    const { groupName, adminId, payboxLink, entryFee } = req.body;
    const db = readDB();
    const groupId = 'group_' + Math.random().toString(36).substr(2, 9);
    
    db.groups[groupId] = {
        group_name: groupName,
        admin_id: adminId,
        paybox_link: payboxLink,
        // 2. הוספנו כאן את שמירת המחיר בבסיס הנתונים (ממירים למספר ליתר ביטחון)
        entry_fee: entryFee ? parseInt(entryFee) : 0, 
        status: "voting_open",
        members: {
            [adminId]: { has_paid: true, total_score: 0 }
        },
        points_system: { first_place: 10, second_place: 3, third_place: 1 }
    };
    
    writeDB(db);
    res.json({ success: true, groupId });
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
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));