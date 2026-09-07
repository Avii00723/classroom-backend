import { eq } from "drizzle-orm";
import { db } from "./db/index.js";
import { departments, subjects } from "./db/schema/index.js";

async function main() {
  const suffix = Date.now();

  try {
    console.log("Performing CRUD operations...");

    const [newDepartment] = await db
      .insert(departments)
      .values({
        code: `DEMO-${suffix}`,
        name: "Demo Department",
        description: "Temporary record created by the CRUD example.",
      })
      .returning();

    if (!newDepartment) {
      throw new Error("Failed to create department");
    }
    console.log("CREATE: New department created:", newDepartment);

    const [newSubject] = await db
      .insert(subjects)
      .values({
        departmentId: newDepartment.id,
        code: `SUBJ-${suffix}`,
        name: "Demo Subject",
        description: "Temporary record created by the CRUD example.",
      })
      .returning();

    if (!newSubject) {
      throw new Error("Failed to create subject");
    }

    const [foundSubject] = await db
      .select()
      .from(subjects)
      .where(eq(subjects.id, newSubject.id));
    console.log("READ: Found subject:", foundSubject);

    const [updatedSubject] = await db
      .update(subjects)
      .set({ name: "Updated Demo Subject" })
      .where(eq(subjects.id, newSubject.id))
      .returning();

    if (!updatedSubject) {
      throw new Error("Failed to update subject");
    }
    console.log("UPDATE: Subject updated:", updatedSubject);

    await db.delete(subjects).where(eq(subjects.id, newSubject.id));
    await db.delete(departments).where(eq(departments.id, newDepartment.id));
    console.log("DELETE: Temporary subject and department deleted.");
  } catch (error) {
    console.error("Error performing CRUD operations:", error);
    process.exitCode = 1;
  }
}

void main();
