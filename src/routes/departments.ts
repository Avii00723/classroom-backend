import express from "express";
import { and, desc, eq, getTableColumns, ilike, or, sql, type SQL } from "drizzle-orm";
import { db, withDatabaseRetry } from "../db/index.js";
import { departments, subjects } from "../db/schema/index.js";

const router = express.Router();

const queryValue = (value: unknown) => typeof value === "string" ? value : undefined;
const positiveInteger = (value: string | undefined, fallback: number) => {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

router.get("/", async (req, res) => {
    try {
        const search = queryValue(req.query.search);
        const page = positiveInteger(queryValue(req.query.page), 1);
        const limit = Math.min(100, positiveInteger(queryValue(req.query.limit), 10));
        const offset = (page - 1) * limit;
        const conditions: SQL[] = [];

        if (search?.trim()) {
            const pattern = `%${search}%`;
            const searchCondition = or(ilike(departments.name, pattern), ilike(departments.code, pattern));
            if (searchCondition) conditions.push(searchCondition);
        }

        const whereClause = conditions.length ? and(...conditions) : undefined;
        const [{ count = 0 } = {}] = await withDatabaseRetry(() =>
            db.select({ count: sql<number>`count(*)` })
                .from(departments)
                .where(whereClause)
                .execute(),
        );
        const data = await withDatabaseRetry(() =>
            db.select({ ...getTableColumns(departments) })
                .from(departments)
                .where(whereClause)
                .orderBy(desc(departments.createdAt))
                .limit(limit)
                .offset(offset)
                .execute(),
        );

        res.json({
            data,
            pagination: { page, limit, total: count, totalPages: Math.ceil(count / limit) },
        });
    } catch (error) {
        console.error("Error fetching departments:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

router.get("/:id", async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid department id" });

    try {
        const [department] = await withDatabaseRetry(() =>
            db.select({ ...getTableColumns(departments) })
                .from(departments)
                .where(eq(departments.id, id))
                .execute(),
        );
        if (!department) return res.status(404).json({ error: "Department not found" });
        res.json({ data: department });
    } catch (error) {
        console.error("Error fetching department:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

router.post("/", async (req, res) => {
    const { code, name, description } = req.body ?? {};
    if (!String(code ?? "").trim() || !String(name ?? "").trim()) {
        return res.status(400).json({ error: "code and name are required" });
    }

    try {
        const [department] = await withDatabaseRetry(() =>
            db.insert(departments)
                .values({ code: String(code).trim(), name: String(name).trim(), description: description ? String(description) : null })
                .returning(),
        );
        res.status(201).json({ data: department });
    } catch (error) {
        console.error("Error creating department:", error);
        res.status(400).json({ error: "Unable to create department" });
    }
});

router.put("/:id", async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid department id" });
    const { code, name, description } = req.body ?? {};

    try {
        const [department] = await withDatabaseRetry(() =>
            db.update(departments)
                .set({
                    ...(code !== undefined ? { code: String(code).trim() } : {}),
                    ...(name !== undefined ? { name: String(name).trim() } : {}),
                    ...(description !== undefined ? { description: description ? String(description) : null } : {}),
                })
                .where(eq(departments.id, id))
                .returning(),
        );
        if (!department) return res.status(404).json({ error: "Department not found" });
        res.json({ data: department });
    } catch (error) {
        console.error("Error updating department:", error);
        res.status(400).json({ error: "Unable to update department" });
    }
});

router.delete("/:id", async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid department id" });

    try {
        const [{ count = 0 } = {}] = await withDatabaseRetry(() =>
            db.select({ count: sql<number>`count(*)` })
                .from(subjects)
                .where(eq(subjects.departmentId, id))
                .execute(),
        );
        if (count > 0) return res.status(409).json({ error: "Department has subjects and cannot be deleted" });

        const [deleted] = await withDatabaseRetry(() =>
            db.delete(departments).where(eq(departments.id, id)).returning({ id: departments.id }).execute(),
        );
        if (!deleted) return res.status(404).json({ error: "Department not found" });
        res.status(204).send();
    } catch (error) {
        console.error("Error deleting department:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

export default router;
