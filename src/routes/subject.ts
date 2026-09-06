import express from "express";
import { and, or, ilike, sql, eq, desc, getTableColumns } from "drizzle-orm";
import { departments, subjects } from "../db/schema/index.js";
import { db } from "../db/index.js";

const router = express.Router();

router.get("/", async (req, res) => {
    try {
        const { search, department, page = 1, limit = 10 } = req.query;
        const currentPage = Math.max(1, +page);
        const limitPerPage = Math.max(1, +limit);
        const offset = (currentPage - 1) * limitPerPage;
        const filterConditions: any[] = [];

        if (search) {
            filterConditions.push(
                or(
                    ilike(subjects.name, `%${search}%`),
                    ilike(subjects.code, `%${search}%`)
                )
            );
        }
        if (department) {
            filterConditions.push(
                ilike(departments.name, `%${department}%`)
            );
        }

        const whereClause = filterConditions.length > 0 ? and(...filterConditions) : undefined;

        const countResult = await
            db.select(
                { count: sql<number> `count(*)` }
            )
                .from(subjects)
                .leftJoin(departments, eq(subjects.departmentId, departments.id))
                .where(whereClause)
                .execute();

        const totalCount = countResult[0]?.count || 0;
        const subjectsList = await db.select({ ...getTableColumns(subjects), department: { ...getTableColumns(departments) } })
            .from(subjects)
            .leftJoin(departments, eq(subjects.departmentId, departments.id))
            .where(whereClause).orderBy(desc(subjects.createdAt))
            .offset(offset)
            .limit(limitPerPage)
            .execute();

        res.status(200).json({
            data: subjectsList,
            pagination: {
                total: totalCount,
                page: currentPage,
                limit: limitPerPage,
                totalPages: Math.ceil(totalCount / limitPerPage),
            },
        });
    } catch (error) {
        console.error("Error fetching subjects:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

export default router;