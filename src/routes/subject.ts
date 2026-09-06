import express from "express";
import { and, or, ilike, sql, eq, desc, asc, getTableColumns, type SQL } from "drizzle-orm";
import { departments, subjects } from "../db/schema/index.js";
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

        // Support both the original API parameters and the bracket notation
        // sent by the frontend data provider.
        const search = queryValue("search");
        const filterDepartment = queryValue("filters[0][field]") === "department"
            ? queryValue("filters[0][value]")
            : undefined;
        const department = queryValue("department") ?? filterDepartment;
        const currentPage = positiveInteger(queryValue("pagination[currentPage]") ?? queryValue("page"), 1);
        const limitPerPage = Math.min(100, positiveInteger(queryValue("pagination[pageSize]") ?? queryValue("limit"), 10));
        const offset = (currentPage - 1) * limitPerPage;
        const filterConditions: SQL[] = [];

        if (search) {
            const searchCondition = or(
                ilike(subjects.name, `%${search}%`),
                ilike(subjects.code, `%${search}%`)
            );
            if (searchCondition) filterConditions.push(searchCondition);
        }
        if (department?.trim()) {
            const deptPattern = `%${String(department).replace(/[%_]/g, '\\$&')}%`;
            filterConditions.push(ilike(departments.name, deptPattern));
        }

        const whereClause = filterConditions.length > 0 ? and(...filterConditions) : undefined;

        const countResult = await withDatabaseRetry(() =>
            db.select(
                { count: sql<number> `count(*)` }
            )
                .from(subjects)
                .leftJoin(departments, eq(subjects.departmentId, departments.id))
                .where(whereClause)
                .execute()
        );

        const totalCount = countResult[0]?.count || 0;
        const sorterField = queryValue("sorters[0][field]");
        const sorterOrder = queryValue("sorters[0][order]");
        const sortColumn = sorterField === "name" ? subjects.name : subjects.id;
        const orderBy = sorterOrder === "asc" ? asc(sortColumn) : desc(sortColumn);

        const subjectsList = await withDatabaseRetry(() => db.select({ ...getTableColumns(subjects), department: { ...getTableColumns(departments) } })
            .from(subjects)
            .leftJoin(departments, eq(subjects.departmentId, departments.id))
            .where(whereClause)
            .orderBy(orderBy)
            .offset(offset)
            .limit(limitPerPage)
            .execute());

        res.status(200).json({
            data: subjectsList,
            total: totalCount,
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
