 import express from "express";
import { and, desc, eq, getTableColumns, ilike, or, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { classes, departments, enrollments, subjects, user } from "../db/schema/index.js";
import { db, withDatabaseRetry } from "../db/index.js";

const router = express.Router();
const teacher = alias(user, "teacher");

router.post("/", async (req, res) => {
    try {
        const {
            subjectId,
            teacherId,
            name,
            bannerCldPubId,
            bannerUrl,
            description,
            capacity,
            status,
            schedules,
            inviteCode,
        } = req.body ?? {};

        if (!subjectId || !teacherId || !name) {
            res.status(400).json({ error: "subjectId, teacherId, and name are required" });
            return;
        }

        const [createdClass] = await withDatabaseRetry(() =>
            db.insert(classes)
                .values({
                    subjectId: Number(subjectId),
                    teacherId: String(teacherId),
                    name: String(name),
                    inviteCode: inviteCode ? String(inviteCode) : `CLASS-${crypto.randomUUID()}`,
                    bannerCldPubId: bannerCldPubId ? String(bannerCldPubId) : null,
                    bannerUrl: bannerUrl ? String(bannerUrl) : null,
                    description: description ? String(description) : null,
                    capacity: capacity ? Number(capacity) : 50,
                    status: status ?? "active",
                    schedules: Array.isArray(schedules) ? schedules : [],
                })
                .returning()
        );

        res.status(201).json({ data: createdClass });
    } catch (error) {
        console.error("Error creating class:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

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

router.get('/:id', async (req, res) => {
    try {
        const classId=Number(req.params.id);

        if(!Number.isFinite(classId)) return res.status(400).json({error:'No Class found'});
        const [classDetails]=await withDatabaseRetry(() => db
        .select({
            ...getTableColumns(classes),
            subject:{
                ...getTableColumns(subjects),
            },
            department:{
                ...getTableColumns(departments),
            },
            teacher:{
                ...getTableColumns(user),
            }
        })
        .from(classes)
        .leftJoin(subjects,eq(classes.subjectId,subjects.id))
        .leftJoin(user,eq(classes.teacherId,user.id))
        .leftJoin(departments,eq(subjects.departmentId,departments.id))
        .where(eq(classes.id,classId))
        .execute());

    if(!classDetails) return res.status(404).json({error:'No Class found.'});

    res.status(200).json({data:classDetails});
    } catch (error) {
        console.error("Error fetching class:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

router.get('/:id/users', async (req, res) => {
    try {
        const classId = Number(req.params.id);
        if (!Number.isInteger(classId)) return res.status(400).json({ error: "Invalid class id" });
        const students = await withDatabaseRetry(() => db
            .select({ ...getTableColumns(user) })
            .from(enrollments)
            .innerJoin(user, eq(enrollments.studentId, user.id))
            .where(eq(enrollments.classId, classId))
            .orderBy(desc(enrollments.createdAt))
            .execute());
        res.json({ data: students, pagination: { page: 1, limit: students.length, total: students.length, totalPages: students.length ? 1 : 0 } });
    } catch (error) {
        console.error("Error fetching enrolled students:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

router.post('/:id/enrollments', async (req, res) => {
    try {
        const classId = Number(req.params.id);
        const studentId = String(req.body?.studentId ?? "").trim();
        if (!Number.isInteger(classId) || !studentId) return res.status(400).json({ error: "Valid classId and studentId are required" });

        const [classRecord] = await db.select({ capacity: classes.capacity }).from(classes).where(eq(classes.id, classId)).execute();
        if (!classRecord) return res.status(404).json({ error: "Class not found" });
        const [student] = await db.select({ id: user.id, role: user.role }).from(user).where(eq(user.id, studentId)).execute();
        if (!student || student.role !== "student") return res.status(400).json({ error: "A valid student is required" });
        const [{ count = 0 } = {}] = await db.select({ count: sql<number>`count(*)` }).from(enrollments).where(eq(enrollments.classId, classId)).execute();
        if (count >= classRecord.capacity) return res.status(409).json({ error: "Class capacity has been reached" });
        const [created] = await db.insert(enrollments).values({ classId, studentId }).returning();
        res.status(201).json({ data: created });
    } catch (error) {
        if (String(error).includes("duplicate key")) return res.status(409).json({ error: "Student is already enrolled" });
        console.error("Error enrolling student:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

router.delete('/:id/enrollments/:studentId', async (req, res) => {
    try {
        const classId = Number(req.params.id);
        const studentId = req.params.studentId;
        if (!Number.isInteger(classId) || !studentId) return res.status(400).json({ error: "Invalid enrollment" });
        const [deleted] = await db.delete(enrollments)
            .where(and(eq(enrollments.classId, classId), eq(enrollments.studentId, studentId)))
            .returning({ id: enrollments.id });
        if (!deleted) return res.status(404).json({ error: "Enrollment not found" });
        res.status(204).send();
    } catch (error) {
        console.error("Error removing enrollment:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

export default router;