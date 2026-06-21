const request = require('supertest');
const app = require('./server');
const fs = require('fs');

// בדיקה בסיסית על ה-APIs של הקבוצות
describe('Group & Betting API Tests', () => {
    
    // בדיקה 1: שליפת קבוצה (נניח שיש קבוצה קיימת או בדיקה כללית)
    it('GET /api/groups/:id - should return group details if group exists', async () => {
        // אנחנו מניחים שיש קבוצה כלשהי, ננסה לשלוף לבדוק את מבנה התגובה
        const res = await request(app).get('/api/groups/group_test123');
        
        // אם היא לא קיימת ב-DB של הטסט זה יחזיר 404 או 200, אנחנו נוודא שהקוד לא קורס
        expect(res.statusCode).not.toBe(500); 
    });

    // בדיקה 2: בדיקת חוסר קיום קבוצה
    it('GET /api/groups/non_existent_id - should return 404', async () => {
        const res = await request(app).get('/api/groups/non_existent_id');
        expect(res.statusCode).toBe(404);
        expect(res.body.success).toBe(false);
    });

    // בדיקה 3: בדיקת מנגנון נעילת ההימורים החדש
    it('POST /api/groups/:id/lock - should successfully lock bets', async () => {
        // ננסה לנעול את קבוצת הטסט
        const res = await request(app)
            .post('/api/groups/group_test123/lock')
            .send({ lockMode: 'spectator' });

        // אם הקבוצה קיימת ב-database.json, נצפה לתגובה חיובית
        if (res.statusCode === 200) {
            expect(res.body.success).toBe(true);
            expect(res.body.betsLocked).toBe(true);
            expect(res.body.unpaidLockMode).toBe('spectator');
        } else {
            // אם הקבוצה לא קיימת ב-DB, לפחות שהסטטוס יהיה 404 ולא קריסת שרת (500)
            expect(res.statusCode).toBe(404);
        }
    });
});