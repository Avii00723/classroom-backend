import express from "express";
import { desc, eq, sql } from "drizzle-orm";
import { db, withDatabaseRetry } from "../db/index.js";
import { classes, departments, enrollments, subjects, user } from "../db/schema/index.js";

const router = express.Router();

router.get("/", async (_req, res) => {
    try {
        const [users, departmentCount, subjectCount, classCount, enrollmentCount, distribution, classesByDepartment, capacityStatus, trends, activity] = await Promise.all([
            db.select({ count: sql<number>`count(*)` }).from(user).execute(),
            db.select({ count: sql<number>`count(*)` }).from(departments).execute(),
            db.select({ count: sql<number>`count(*)` }).from(subjects).execute(),
            db.select({ count: sql<number>`count(*)` }).from(classes).execute(),
            db.select({ count: sql<number>`count(*)` }).from(enrollments).execute(),
            db.select({ role: user.role, count: sql<number>`count(*)` }).from(user).groupBy(user.role).execute(),
            db.select({ department: departments.name, count: sql<number>`count(*)` })
                .from(classes).innerJoin(subjects, eq(classes.subjectId, subjects.id)).innerJoin(departments, eq(subjects.departmentId, departments.id))
                .groupBy(departments.name).orderBy(desc(sql`count(*)`)).execute(),
            db.select({ status: classes.status, count: sql<number>`count(*)` }).from(classes).groupBy(classes.status).execute(),
            db.execute(sql`select to_char(date_trunc('month', created_at), 'Mon YYYY') as month, count(*)::int as count from enrollments group by 1 order by min(created_at) desc limit 12`),
            db.select({ type: sql<string>`'enrollment'`, label: sql<string>`'New enrollment'`, createdAt: enrollments.createdAt })
                .from(enrollments).orderBy(desc(enrollments.createdAt)).limit(8).execute(),
        ]);

        res.json({
            data: {
                metrics: {
                    users: users[0]?.count ?? 0,
                    departments: departmentCount[0]?.count ?? 0,
                    subjects: subjectCount[0]?.count ?? 0,
                    classes: classCount[0]?.count ?? 0,
                    enrollments: enrollmentCount[0]?.count ?? 0,
                },
                userDistribution: distribution,
                classesByDepartment,
                capacityStatus,
                enrollmentTrends: trends.rows,
                activity,
            },
        });
    } catch (error) {
        console.error("Error fetching dashboard metrics:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

export default router;
