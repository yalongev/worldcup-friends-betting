const request = require('supertest');
const app = require('./server');
const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'database.json');
let originalDbSnapshot = null;

function writeFixtureDb() {
    const fixture = {
        users: {
            admin_user: { name: 'Admin', email: '', created_at: '2026-01-01T00:00:00.000Z' },
            member_user: { name: 'Member', email: '', created_at: '2026-01-01T00:00:00.000Z' },
            attacker_user: { name: 'Attacker', email: '', created_at: '2026-01-01T00:00:00.000Z' }
        },
        groups: {
            group_secure: {
                group_name: 'Secure Group',
                admin_id: 'admin_user',
                status: 'voting_open',
                betsLocked: false,
                unpaidLockMode: 'spectator',
                members: {
                    admin_user: { has_paid: true, total_score: 12 },
                    member_user: { has_paid: false, total_score: 7 }
                }
            },
            group_locked: {
                group_name: 'Locked Group',
                admin_id: 'admin_user',
                status: 'voting_open',
                betsLocked: true,
                unpaidLockMode: 'spectator',
                members: {
                    admin_user: { has_paid: true, total_score: 0 },
                    member_user: { has_paid: false, total_score: 0 }
                }
            }
        },
        predictions: {},
        system_results: {}
    };

    fs.writeFileSync(DB_FILE, JSON.stringify(fixture, null, 2));
}

function readFixtureDb() {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

// בדיקה בסיסית על ה-APIs של הקבוצות
describe('Group & Betting API Tests', () => {
    beforeAll(() => {
        originalDbSnapshot = fs.readFileSync(DB_FILE, 'utf8');
    });

    beforeEach(() => {
        writeFixtureDb();
    });

    afterAll(() => {
        if (originalDbSnapshot !== null) {
            fs.writeFileSync(DB_FILE, originalDbSnapshot);
        }
    });

    it('GET /api/groups/:id - should return group details if group exists', async () => {
        const res = await request(app).get('/api/groups/group_secure');
        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
    });

    it('GET /api/groups/:id/summary - should return leaderboard metrics for group card', async () => {
        const res = await request(app).get('/api/groups/group_secure/summary?userId=member_user');

        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.summary.totalMembers).toBe(2);
        expect(res.body.summary.paidCount).toBe(1);
        expect(res.body.summary.totalPot).toBe(0);
        expect(res.body.summary.leader.userId).toBe('admin_user');
        expect(res.body.summary.currentUser.rank).toBe(2);
    });

    it('GET /api/groups/:id/summary - should return 404 for missing group', async () => {
        const res = await request(app).get('/api/groups/non_existent_id/summary?userId=member_user');

        expect(res.statusCode).toBe(404);
        expect(res.body.success).toBe(false);
    });

    it('GET /api/groups/:id/dashboard - should return stage 6 dashboard data', async () => {
        const db = readFixtureDb();
        db.predictions.group_secure = {
            admin_user: {
                teams: { first: 'Argentina', second: 'France' },
                scorers: { first: 'messi' }
            },
            member_user: {
                teams: { first: 'Brazil', second: '' },
                scorers: { first: '' }
            }
        };
        fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));

        const res = await request(app).get('/api/groups/group_secure/dashboard?userId=member_user');

        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.dashboard.lock.isLocked).toBe(false);
        expect(res.body.dashboard.matches).toHaveLength(3);
        expect(res.body.dashboard.userBettingStatus).toHaveLength(2);
        expect(res.body.dashboard.analytics.leaders[0].userId).toBe('admin_user');
        expect(res.body.dashboard.analytics.currentUser.userId).toBe('member_user');
    });

    it('GET /api/groups/:id/dashboard - should return 404 for missing group', async () => {
        const res = await request(app).get('/api/groups/non_existent_id/dashboard?userId=member_user');

        expect(res.statusCode).toBe(404);
        expect(res.body.success).toBe(false);
    });

    it('GET /api/groups/non_existent_id - should return 404', async () => {
        const res = await request(app).get('/api/groups/non_existent_id');
        expect(res.statusCode).toBe(404);
        expect(res.body.success).toBe(false);
    });

    it('POST /api/groups/:id/lock - should reject non-admin request', async () => {
        const res = await request(app)
            .post('/api/groups/group_secure/lock')
            .send({ lockMode: 'spectator', adminUserId: 'attacker_user' });

        expect(res.statusCode).toBe(403);
        expect(res.body.success).toBe(false);
    });

    it('POST /api/groups/:id/lock - should lock successfully for admin', async () => {
        const res = await request(app)
            .post('/api/groups/group_secure/lock')
            .send({ lockMode: 'spectator', adminUserId: 'admin_user' });

        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);

        const db = readFixtureDb();
        expect(db.groups.group_secure.betsLocked).toBe(true);
        expect(db.groups.group_secure.unpaidLockMode).toBe('spectator');
    });

    it('POST /api/groups/toggle-payment - should reject non-admin request', async () => {
        const res = await request(app)
            .post('/api/groups/toggle-payment')
            .send({
                groupId: 'group_secure',
                userId: 'member_user',
                hasPaid: true,
                adminUserId: 'attacker_user'
            });

        expect(res.statusCode).toBe(403);
        expect(res.body.success).toBe(false);
    });

    it('POST /api/groups/toggle-payment - should update payment for admin', async () => {
        const res = await request(app)
            .post('/api/groups/toggle-payment')
            .send({
                groupId: 'group_secure',
                userId: 'member_user',
                hasPaid: true,
                adminUserId: 'admin_user'
            });

        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);

        const db = readFixtureDb();
        expect(db.groups.group_secure.members.member_user.has_paid).toBe(true);
    });

    it('POST /api/predictions/save - should reject when group is locked', async () => {
        const res = await request(app)
            .post('/api/predictions/save')
            .send({
                groupId: 'group_locked',
                userId: 'member_user',
                teams: { first: 'Argentina', second: 'France' },
                scorers: { first: 'messi' }
            });

        expect(res.statusCode).toBe(400);
        expect(res.body.success).toBe(false);
    });

    it('POST /api/predictions/save - should reject user who is not in group', async () => {
        const res = await request(app)
            .post('/api/predictions/save')
            .send({
                groupId: 'group_secure',
                userId: 'attacker_user',
                teams: { first: 'Argentina', second: 'France' },
                scorers: { first: 'messi' }
            });

        expect(res.statusCode).toBe(403);
        expect(res.body.success).toBe(false);
    });

    it('POST /api/predictions/save - should save successfully for valid group member', async () => {
        const res = await request(app)
            .post('/api/predictions/save')
            .send({
                groupId: 'group_secure',
                userId: 'member_user',
                teams: { first: 'Argentina', second: 'France' },
                scorers: { first: 'messi' }
            });

        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);

        const db = readFixtureDb();
        expect(db.predictions.group_secure).toBeDefined();
        expect(db.predictions.group_secure.member_user).toBeDefined();
    });
});