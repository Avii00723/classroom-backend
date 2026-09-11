import express from "express";
import { and, desc, eq, getTableColumns, ilike, or, sql, type SQL } from "drizzle-orm";
import { user } from "../db/schema/index.js";
import { db, withDatabaseRetry } from "../db/index.js";

const router = express.Router();

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
        const role = queryValue("role");
        const currentPage = positiveInteger(queryValue("page"), 1);
        const limitPerPage = Math.min(100, positiveInteger(queryValue("limit"), 10));
        const offset = (currentPage - 1) * limitPerPage;
        const filterConditions: SQL[] = [];

        if (search) {
            const searchCondition = or(
                ilike(user.name, `%${search}%`),
                ilike(user.email, `%${search}%`)
            );
            if (searchCondition) filterConditions.push(searchCondition);
        }
        if (role?.trim()) {
            filterConditions.push(eq(user.role, role as "student" | "teacher" | "admin"));
        }

        const whereClause = filterConditions.length > 0 ? and(...filterConditions) : undefined;

        const countResult = await withDatabaseRetry(() =>
            db.select({ count: sql<number>`count(*)` })
                .from(user)
                .where(whereClause)
                .execute()
        );

        const total = countResult[0]?.count || 0;
        const usersList = await withDatabaseRetry(() =>
            db.select({ ...getTableColumns(user) })
                .from(user)
                .where(whereClause)
                .orderBy(desc(user.createdAt))
                .offset(offset)
                .limit(limitPerPage)
                .execute()
        );

        res.status(200).json({
            data: usersList,
            pagination: {
                page: currentPage,
                limit: limitPerPage,
                total,
                totalPages: Math.ceil(total / limitPerPage),
            },
        });
    } catch (error) {
        console.error("Error fetching users:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

export default router;