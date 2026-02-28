import { getProjectDetails } from "@/lib/projects";
import { ProjectInsightsClient } from "./project-insights-client";

interface Props {
  params: {
    projectId: string;
    clientId: string;
  };
}

export default async function ProjectInsightsPage({ params }: Props) {
  const project = await getProjectDetails(params.projectId);
  return <ProjectInsightsClient project={project} params={params} />;
} 