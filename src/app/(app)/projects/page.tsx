import { ProjectsView } from "@/components/projects/projects-view";
import { LinkButton } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/card";

export default function ProjectsPage() {
  return (
    <>
      <PageHeader
        title="Мои проекты"
        description="Проекты, где вы заказчик, и проекты, куда вас пригласили в команду."
        actions={<LinkButton href="/team-search">Новый проект</LinkButton>}
      />
      <ProjectsView />
    </>
  );
}
