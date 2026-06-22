const { MongoClient } = require('mongodb');
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'database.json');
const MONGO_URI = process.env.MONGO_URI;
let db = null;
const FOOTBALL_DATA_API = 'https://api.football-data.org/v4';
const FOOTBALL_DATA_TOKEN = process.env.FOOTBALL_DATA_TOKEN || '51910283b0964f4a9ef4be0ced66c701';

async function initDB() {
    if (MONGO_URI) {
        try {
            const client = new MongoClient(MONGO_URI);
            await client.connect();
            db = client.db('wizards_couch_db');
            console.log('Connected to MongoDB Atlas successfully!');
        } catch (e) {
            console.error('Failed to connect to MongoDB, falling back to JSON', e);
        }
    } else {
        console.log('Running locally with database.json');
    }
}

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

app.post('/api/groups/create', async (req, res) => {
    const { groupName, creatorName, tournamentStage, userId } = req.body;

    if (!groupName || groupName.trim() === "" || !creatorName || creatorName.trim() === "") {
        return res.status(400).json({ success: false, message: "שם קבוצה ושם מנהל הם שדות חובה!" });
    }

    const groupId = 'group_' + Math.random().toString(36).substring(2, 9);
    const cleanedGroupName = groupName.trim();
    const cleanedCreatorName = creatorName.trim();
    const entryFee = Number(req.body.entryFee) || 0;
    const payboxLink = req.body.payboxLink ? String(req.body.payboxLink).trim() : "";
    const nowIso = new Date().toISOString();

    const groupPayload = {
        group_name: cleanedGroupName,
        admin_id: userId,
        paybox_link: payboxLink,
        entry_fee: entryFee,
        status: 'voting_open',
        betsLocked: false,
        tournamentStage: tournamentStage || "full", // נשמר ישירות ב-DB
        members: {
            [userId]: {
                userName: cleanedCreatorName,
                has_paid: true, // מנהל הקבוצה מסומן כמשולם אוטומטית
                registeredAt: nowIso
            }
        }
    };

    // מצב ענן: כתיבה למונגו (ובשלב המעבר גם שמירה ל-JSON לתאימות ל-routes שעדיין לא הוסבו)
    if (db) {
        try {
            await db.collection('users').updateOne(
                { _id: userId },
                {
                    $setOnInsert: {
                        name: cleanedCreatorName,
                        email: "",
                        created_at: nowIso
                    }
                },
                { upsert: true }
            );

            await db.collection('groups').insertOne({
                _id: groupId,
                ...groupPayload,
                created_at: nowIso
            });

            // תאימות זמנית: עד שה-routes כולם יעברו למונגו, משקפים גם לקובץ JSON
            const fileDB = readDB();
            if (!fileDB.users[userId]) {
                fileDB.users[userId] = {
                    name: cleanedCreatorName,
                    email: "",
                    created_at: nowIso
                };
            }
            fileDB.groups[groupId] = groupPayload;
            writeDB(fileDB);

            return res.json({
                success: true,
                groupId: groupId
            });
        } catch (error) {
            console.error('Mongo create-group failed, falling back to JSON:', error);
        }
    }

    // מצב מקומי/נפילה: כתיבה ל-JSON
    const fileDB = readDB();

    // שמירת משתמש המנהל באוסף המשתמשים הכללי (אם עדיין לא קיים)
    if (!fileDB.users[userId]) {
        fileDB.users[userId] = {
            name: cleanedCreatorName,
            email: "",
            created_at: nowIso
        };
    }

    fileDB.groups[groupId] = groupPayload;

    writeDB(fileDB);

    res.json({
        success: true,
        groupId: groupId
    });
});

// API: קבלת רשימת נבחרות לפי קוד תחרות
app.get('/api/teams/:competitionCode', async (req, res) => {
    const competitionCode = String(req.params.competitionCode || 'WC').toUpperCase();

    try {
        const apiRes = await fetch(`${FOOTBALL_DATA_API}/competitions/${competitionCode}/teams`, {
            headers: {
                'X-Auth-Token': FOOTBALL_DATA_TOKEN,
                'Accept': 'application/json'
            }
        });

        if (!apiRes.ok) {
            const errorText = await apiRes.text();
            return res.status(apiRes.status).json({
                success: false,
                message: `Football-data API returned ${apiRes.status}`,
                details: errorText
            });
        }

        const payload = await apiRes.json();
        const teams = (payload.teams || []).map(team => ({
            id: team.id,
            name: team.name,
            shortName: team.shortName || team.name,
            tla: team.tla || ''
        }));

        res.json({ success: true, teams });
    } catch (error) {
        console.error('Error fetching teams from football-data:', error);
        res.status(500).json({
            success: false,
            message: 'שגיאה בשרת בזמן שליפת הנבחרות',
            details: error.message
        });
    }
});

// API: נעילת הימורים לקבוצה וקביעת מצב המשתתפים שלא שילמו
app.post('/api/groups/:id/lock', async (req, res) => {
    const groupId = req.params.id;
    const { lockMode } = req.body; // 'spectator' או 'remove'

    // מצב ענן: עדכון במונגו (עם fallback ל-JSON במקרה תקלה)
    if (db) {
        try {
            const mongoRes = await db.collection('groups').updateOne(
                { _id: groupId },
                {
                    $set: {
                        betsLocked: true,
                        unpaidLockMode: lockMode
                    }
                }
            );

            if (mongoRes.matchedCount === 0) {
                return res.status(404).json({ success: false, message: "הקבוצה לא קיימת" });
            }

            // תאימות זמנית: שיקוף ל-JSON
            const fileDB = readDB();
            if (fileDB.groups[groupId]) {
                fileDB.groups[groupId].betsLocked = true;
                fileDB.groups[groupId].unpaidLockMode = lockMode;
                writeDB(fileDB);
            }

            return res.json({ success: true, message: "ההימורים ננעלו בהצלחה!", betsLocked: true, unpaidLockMode: lockMode });
        } catch (error) {
            console.error('Mongo lock-group failed, falling back to JSON:', error);
        }
    }

    const fileDB = readDB();

    if (!fileDB.groups[groupId]) {
        return res.status(404).json({ success: false, message: "הקבוצה לא קיימת" });
    }

    // עדכון מצב הקבוצה ב-DB
    fileDB.groups[groupId].betsLocked = true;
    fileDB.groups[groupId].unpaidLockMode = lockMode; // שמירת ההחלטה: צופים או הסרה

    writeDB(fileDB);
    res.json({ success: true, message: "ההימורים ננעלו בהצלחה!", betsLocked: true, unpaidLockMode: lockMode });
});

// API: עדכון סטטוס תשלום של חבר קבוצה על ידי המנהל
app.post('/api/groups/toggle-payment', async (req, res) => {
    const { groupId, userId, hasPaid } = req.body;

    // מצב ענן: עדכון במונגו (עם fallback ל-JSON במקרה תקלה)
    if (db) {
        try {
            const mongoRes = await db.collection('groups').updateOne(
                { _id: groupId, [`members.${userId}`]: { $exists: true } },
                {
                    $set: {
                        [`members.${userId}.has_paid`]: hasPaid
                    }
                }
            );

            if (mongoRes.matchedCount > 0) {
                // תאימות זמנית: שיקוף ל-JSON
                const fileDB = readDB();
                if (fileDB.groups[groupId] && fileDB.groups[groupId].members[userId]) {
                    fileDB.groups[groupId].members[userId].has_paid = hasPaid;
                    writeDB(fileDB);
                }
                return res.json({ success: true, message: "סטטוס התשלום עודכן" });
            }
        } catch (error) {
            console.error('Mongo toggle-payment failed, falling back to JSON:', error);
        }
    }

    const fileDB = readDB();

    if (fileDB.groups[groupId] && fileDB.groups[groupId].members[userId]) {
        // עדכון הסטטוס ב-DB
        fileDB.groups[groupId].members[userId].has_paid = hasPaid;
        writeDB(fileDB);
        return res.json({ success: true, message: "סטטוס התשלום עודכן" });
    }

    res.status(404).json({ success: false, message: "קבוצה או משתמש לא נמצאו" });
});

app.post('/api/groups/:id/update-entry-fee', async (req, res) => {
    const groupId = req.params.id;
    const { entryFee } = req.body;
    const numericEntryFee = Number(entryFee) || 0;

    // מצב ענן: עדכון במונגו (עם fallback ל-JSON במקרה תקלה)
    if (db) {
        try {
            const mongoRes = await db.collection('groups').updateOne(
                { _id: groupId },
                {
                    $set: {
                        entry_fee: numericEntryFee
                    }
                }
            );

            if (mongoRes.matchedCount === 0) {
                return res.status(404).json({ success: false, message: "הקבוצה לא נמצאה" });
            }

            // תאימות זמנית: שיקוף ל-JSON
            const fileDB = readDB();
            if (fileDB.groups[groupId]) {
                fileDB.groups[groupId].entry_fee = numericEntryFee;
                writeDB(fileDB);
            }

            return res.json({ success: true, message: "עלות ההשתתפות עודכנה" });
        } catch (error) {
            console.error('Mongo update-entry-fee failed, falling back to JSON:', error);
        }
    }

    const fileDB = readDB();

    if (!fileDB.groups[groupId]) {
        return res.status(404).json({ success: false, message: "הקבוצה לא נמצאה" });
    }

    fileDB.groups[groupId].entry_fee = numericEntryFee;
    writeDB(fileDB);
    res.json({ success: true, message: "עלות ההשתתפות עודכנה" });
});

app.post('/api/groups/:id/update-paybox-link', async (req, res) => {
    const groupId = req.params.id;
    const { payboxLink } = req.body;
    const cleanedPayboxLink = payboxLink ? String(payboxLink).trim() : "";

    // מצב ענן: עדכון במונגו (עם fallback ל-JSON במקרה תקלה)
    if (db) {
        try {
            const mongoRes = await db.collection('groups').updateOne(
                { _id: groupId },
                {
                    $set: {
                        paybox_link: cleanedPayboxLink
                    }
                }
            );

            if (mongoRes.matchedCount === 0) {
                return res.status(404).json({ success: false, message: "הקבוצה לא נמצאה" });
            }

            // תאימות זמנית: שיקוף ל-JSON
            const fileDB = readDB();
            if (fileDB.groups[groupId]) {
                fileDB.groups[groupId].paybox_link = cleanedPayboxLink;
                writeDB(fileDB);
            }

            return res.json({ success: true, message: "קישור PayBox עודכן" });
        } catch (error) {
            console.error('Mongo update-paybox-link failed, falling back to JSON:', error);
        }
    }

    const fileDB = readDB();

    if (!fileDB.groups[groupId]) {
        return res.status(404).json({ success: false, message: "הקבוצה לא נמצאה" });
    }

    fileDB.groups[groupId].paybox_link = cleanedPayboxLink;
    writeDB(fileDB);
    res.json({ success: true, message: "קישור PayBox עודכן" });
});

app.post('/api/predictions/save', async (req, res) => {
    const { groupId, userId, teams, scorers } = req.body;
    const nowIso = new Date().toISOString();

    // מצב ענן: כתיבה למונגו (עם fallback ל-JSON במקרה תקלה)
    if (db) {
        try {
            const mongoGroup = await db.collection('groups').findOne(
                { _id: groupId },
                { projection: { status: 1 } }
            );

            if (!mongoGroup || mongoGroup.status !== 'voting_open') {
                return res.status(400).json({ success: false, message: "ההצבעה נעולה או שהקבוצה לא קיימת" });
            }

            await db.collection('predictions').updateOne(
                { _id: groupId },
                {
                    $set: {
                        [`predictions.${userId}`]: {
                            updated_at: nowIso,
                            teams,
                            scorers
                        }
                    }
                },
                { upsert: true }
            );

            // תאימות זמנית: שיקוף ל-JSON
            const fileDB = readDB();
            if (fileDB.groups[groupId] && fileDB.groups[groupId].status === 'voting_open') {
                if (!fileDB.predictions[groupId]) fileDB.predictions[groupId] = {};
                fileDB.predictions[groupId][userId] = {
                    updated_at: nowIso,
                    teams,
                    scorers
                };
                writeDB(fileDB);
            }

            return res.json({ success: true });
        } catch (error) {
            console.error('Mongo save-prediction failed, falling back to JSON:', error);
        }
    }

    const fileDB = readDB();

    if (!fileDB.groups[groupId] || fileDB.groups[groupId].status !== 'voting_open') {
        return res.status(400).json({ success: false, message: "ההצבעה נעולה או שהקבוצה לא קיימת" });
    }

    if (!fileDB.predictions[groupId]) fileDB.predictions[groupId] = {};

    fileDB.predictions[groupId][userId] = {
        updated_at: nowIso,
        teams,
        scorers
    };

    writeDB(fileDB);
    res.json({ success: true });
});

app.get('/api/top-scorers-candidates', (req, res) => {
    const candidates = [
        { id: "mbappe", name: "קילאן אמבפה (צרפת)", tla: "FRA" },
        { id: "haaland", name: "ארלינג הולאנד (נורווגיה)", tla: "NOR" },
        { id: "vinicius", name: "ויניסיוס ג'וניור (ברזיל)", tla: "BRA" },
        { id: "bellingham", name: "ג'וד בלינגהאם (אנגליה)", tla: "ENG" },
        { id: "kane", name: "הארי קיין (אנגליה)", tla: "ENG" },
        { id: "messi", name: "לאונל מסי (ארגנטינה)", tla: "ARG" },
        { id: "ronaldo", name: "כריסטיאנו רונאלדו (פורטוגל)", tla: "POR" },
        { id: "yamal", name: "לאמין ימאל (ספרד)", tla: "ESP" },
        { id: "musiala", name: "ג'מאל מוסיאלה (גרמניה)", tla: "GER" },
        { id: "martinez", name: "לאוטרו מרטינז (ארגנטינה)", tla: "ARG" },
        { id: "lewandowski", name: "רוברט לבנדובסקי (פולין)", tla: "POL" },
        { id: "alvarez", name: "חוליאן אלברז (ארגנטינה)", tla: "ARG" },
        { id: "other", name: "✍️ שחקן אחר (נא לפרט בהערות הקבוצה)", tla: "OTH" }
    ];
    res.json(candidates);
});

app.get('/api/wc-standings', async (req, res) => {
    try {
        const apiRes = await fetch(`${FOOTBALL_DATA_API}/competitions/WC/standings`, {
            headers: {
                'X-Auth-Token': FOOTBALL_DATA_TOKEN,
                'Accept': 'application/json'
            }
        });

        if (!apiRes.ok) {
            const errorText = await apiRes.text();
            return res.status(apiRes.status).json({
                success: false,
                message: `Football-data API returned ${apiRes.status}`
            });
        }

        const data = await apiRes.json();
        res.json({ success: true, standings: data.standings || [] });
    } catch (error) {
        console.error('Error fetching WC standings:', error);
        res.status(500).json({
            success: false,
            message: 'שגיאה בשליפת טבלת הבתים'
        });
    }
});

// API: קבלת פרטי קבוצה, כולל שמות חברים, הניחושים שלהם ושם המנהל
app.get('/api/groups/:id', async (req, res) => {
    const groupId = req.params.id;

    // מצב ענן: קריאה ממונגו (עם fallback ל-JSON במקרה של תקלה/חוסר נתון)
    if (db) {
        try {
            const [mongoGroup, mongoPredictionsDoc] = await Promise.all([
                db.collection('groups').findOne({ _id: groupId }),
                db.collection('predictions').findOne({ _id: groupId })
            ]);

            if (mongoGroup) {
                const group = JSON.parse(JSON.stringify(mongoGroup));
                delete group._id;

                const memberIds = Object.keys(group.members || {});

                // שליפת כל המשתמשים החברים בקבוצה במכה אחת
                let usersById = {};
                if (memberIds.length > 0) {
                    const users = await db.collection('users').find({ _id: { $in: memberIds } }).toArray();
                    usersById = users.reduce((acc, user) => {
                        acc[user._id] = user;
                        return acc;
                    }, {});
                }

                // שליפת שם מנהל הקבוצה
                if (usersById[group.admin_id]) {
                    group.adminName = usersById[group.admin_id].name;
                } else {
                    const adminUser = await db.collection('users').findOne({ _id: group.admin_id });
                    group.adminName = adminUser ? adminUser.name : 'מנהל מערכת';
                }

                // הזרקת שמות משתמשים לתוך members
                if (group.members) {
                    Object.keys(group.members).forEach(userId => {
                        if (usersById[userId]) {
                            group.members[userId].userName = usersById[userId].name;
                        } else {
                            group.members[userId].userName = 'משתתף זמני';
                        }
                    });
                }

                // תמיכה במבני מסמך שונים בזמן מעבר הדרגתי
                let groupPredictions = {};
                if (mongoPredictionsDoc) {
                    if (mongoPredictionsDoc.predictions && typeof mongoPredictionsDoc.predictions === 'object') {
                        groupPredictions = mongoPredictionsDoc.predictions;
                    } else if (mongoPredictionsDoc.users && typeof mongoPredictionsDoc.users === 'object') {
                        groupPredictions = mongoPredictionsDoc.users;
                    }
                }

                return res.json({
                    success: true,
                    group,
                    predictions: groupPredictions
                });
            }
        } catch (error) {
            console.error('Mongo get-group failed, falling back to JSON:', error);
        }
    }

    const fileDB = readDB();

    if (!fileDB.groups[groupId]) {
        return res.status(404).json({ success: false, message: "הקבוצה לא קיימת" });
    }

    const group = JSON.parse(JSON.stringify(fileDB.groups[groupId])); // העתק עמוק

    // 🔥 שליפת שם מנהל הקבוצה מתוך רשימת המשתמשים
    if (fileDB.users[group.admin_id]) {
        group.adminName = fileDB.users[group.admin_id].name;
    } else {
        group.adminName = "מנהל מערכת";
    }

    // הזרקת השמות האמיתיים של המשתמשים לתוך אובייקט ה-members לטובת הלידרבורד
    if (group.members) {
        Object.keys(group.members).forEach(userId => {
            if (fileDB.users[userId]) {
                group.members[userId].userName = fileDB.users[userId].name;
            } else {
                group.members[userId].userName = "משתתף זמני";
            }
        });
    }

    // שליפת הניחושים ששייכים לקבוצה הזו
    const groupPredictions = fileDB.predictions[groupId] || {};

    res.json({
        success: true,
        group: group,
        predictions: groupPredictions
    });
});

// API: הצטרפות משתמש לקבוצה קיימת
app.post('/api/groups/join', async (req, res) => {
    const { groupId, name, email } = req.body;
    const nowIso = new Date().toISOString();
    const cleanedName = String(name || '').trim();
    const cleanedEmail = String(email || '').trim();

    if (!cleanedName) {
        return res.status(400).json({ success: false, message: "שם משתמש הוא שדה חובה" });
    }

    // יצירת מזהה משתמש ייחודי חדש
    const userId = 'user_' + Math.random().toString(36).substr(2, 9);

    // מצב ענן: כתיבה למונגו (עם fallback ל-JSON במקרה תקלה)
    if (db) {
        try {
            const mongoGroup = await db.collection('groups').findOne(
                { _id: groupId },
                { projection: { _id: 1 } }
            );

            if (!mongoGroup) {
                return res.status(404).json({ success: false, message: "הקבוצה לא קיימת" });
            }

            await db.collection('users').insertOne({
                _id: userId,
                name: cleanedName,
                email: cleanedEmail,
                created_at: nowIso
            });

            await db.collection('groups').updateOne(
                { _id: groupId },
                {
                    $set: {
                        [`members.${userId}`]: {
                            has_paid: false,
                            total_score: 0
                        }
                    }
                }
            );

            // תאימות זמנית: שיקוף ל-JSON
            const fileDB = readDB();
            if (fileDB.groups[groupId]) {
                fileDB.users[userId] = {
                    name: cleanedName,
                    email: cleanedEmail,
                    created_at: nowIso
                };
                fileDB.groups[groupId].members[userId] = {
                    has_paid: false,
                    total_score: 0
                };
                writeDB(fileDB);
            }

            return res.json({ success: true, userId: userId, name: cleanedName });
        } catch (error) {
            console.error('Mongo join-group failed, falling back to JSON:', error);
        }
    }

    const fileDB = readDB();

    // בדיקה שהקבוצה אכן קיימת בשרת
    if (!fileDB.groups[groupId]) {
        return res.status(404).json({ success: false, message: "הקבוצה לא קיימת" });
    }

    // 1. שמירה באוסף המשתמשים הכללי
    fileDB.users[userId] = {
        name: cleanedName,
        email: cleanedEmail,
        created_at: nowIso
    };

    // 2. הוספת המשתמש כחבר בקבוצה הספציפית הזו
    fileDB.groups[groupId].members[userId] = {
        has_paid: false, // ברירת מחדל: טרם שילם
        total_score: 0
    };

    writeDB(fileDB);

    // החזרת ה-userId החדש שהדפדפן ישמור בזיכרון שלו
    res.json({ success: true, userId: userId, name: cleanedName });
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

// רק אם הקובץ רץ ישירות (ולא דרך טסט), נפעיל את אתחול ה-DB ואז את השרת
if (require.main === module) {
    initDB()
        .catch((err) => {
            console.error('DB initialization failed, continuing with JSON fallback', err);
        })
        .finally(() => {
            app.listen(PORT, () => {
                console.log(`Server is running on port ${PORT}`);
            });
        });
}

// 🔥 שורת המפתח: מייצאים את אובייקט ה-app כדי שקובץ הבדיקות יוכל להשתמש בו
module.exports = app;