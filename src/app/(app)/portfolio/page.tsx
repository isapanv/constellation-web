import { PortfolioCard } from "@/components/portfolio/portfolio-card";
import { LinkButton } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/card";
import { myPortfolio } from "@/mocks/data";

export default function PortfolioPage() {
  return (
    <div>
      <PageHeader
        title="Портфолио"
        description="Новые работы проходят проверку модератора перед публикацией."
        actions={<LinkButton href="/portfolio/new">+ Добавить работу</LinkButton>}
      />
      {myPortfolio.length === 0 ? (
        <p className="rounded-3xl border-2 border-dashed border-border p-10 text-center text-muted">
          Пока нет работ. Добавьте 3–5 лучших — этого достаточно для подбора.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {myPortfolio.map((item) => (
            <PortfolioCard key={item.id} item={item} showStatus />
          ))}
        </div>
      )}
    </div>
  );
}
