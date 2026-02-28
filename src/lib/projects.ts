import { db } from "./db";

export async function getProjectDetails(projectId: string) {
  return await db.project.findUnique({
    where: { id: projectId },
    include: {
      client: {
        include: {
          clientUsers: true
        }
      },
      analyticsConfig: true
    }
  });
} 