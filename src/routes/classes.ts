import express from "express";
import { and, desc, eq, getTableColumns, ilike, or, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { classes, subjects, user } from "../db/schema/index.js";
import { db, withDatabaseRetry } from "../db/index.js";

const router = express.Router();
const teacher = alias(user, "teacher");

router.get("/", async (req, res) => {
    try {
        const queryValue = (key: string) => {
            const value = req.query[key];
            return typeof value === "string" ? value : undefined;
        };
        const positiveInteger = (value: string | undefined, fallback: number) => {
            const parsed = Number(value);
            return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
        };

        const search = queryValue("search");
        const subject = queryValue("subject");
        const teacherName = queryValue("teacher");
        const page = positiveInteger(queryValue("page"), 1);
        const limit = Math.min(100, positiveInteger(queryValue("limit"), 10));
        const offset = (page - 1) * limit;
        const filterConditions: SQL[] = [];

        if (search) {
            const searchCondition = or(
                ilike(classes.name, `%${search}%`),
                ilike(classes.inviteCode, `%${search}%`),
            );
            if (searchCondition) filterConditions.push(searchCondition);
        }
        if (subject?.trim()) {
            filterConditions.push(ilike(subjects.name, `%${subject}%`));
        }
        if (teacherName?.trim()) {
            filterConditions.push(ilike(teacher.name, `%${teacherName}%`));
        }

        const whereClause = filterConditions.length > 0 ? and(...filterConditions) : undefined;

        const countResult = await withDatabaseRetry(() =>
            db.select({ count: sql<number>`count(*)` })
                .from(classes)
                .innerJoin(subjects, eq(classes.subjectId, subjects.id))
                .innerJoin(teacher, eq(classes.teacherId, teacher.id))
                .where(whereClause)
                .execute()
        );

        const total = countResult[0]?.count || 0;
        const classesList = await withDatabaseRetry(() =>
            db.select({
                ...getTableColumns(classes),
                subject: { ...getTableColumns(subjects) },
                teacher: { ...getTableColumns(teacher) },
            })
                .from(classes)
                .innerJoin(subjects, eq(classes.subjectId, subjects.id))
                .innerJoin(teacher, eq(classes.teacherId, teacher.id))
                .where(whereClause)
                .orderBy(desc(classes.createdAt))
                .limit(limit)
                .offset(offset)
                .execute()
        );

        res.status(200).json({
            data: classesList,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error("Error fetching classes:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

export default router;