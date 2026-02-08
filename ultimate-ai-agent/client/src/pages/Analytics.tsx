import { BarChart3, MessageSquare, Zap, Clock } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SimpleBarChart, SimplePieChart } from "@/components/SimpleChart";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/contexts/I18nContext";
import { formatDate } from "@/lib/utils";

export default function Analytics() {
  const { data: summary, isLoading } = trpc.analytics.summary.useQuery();
  const { data: events } = trpc.analytics.events.useQuery({ limit: 50 });
  const { t } = useI18n();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  // Build chart data from events
  const dailyUsage: Record<string, number> = {};
  const agentUsage: Record<string, number> = {};

  events?.forEach((event) => {
    const day = event.createdAt.split("T")[0] || event.createdAt.split(" ")[0];
    dailyUsage[day] = (dailyUsage[day] || 0) + 1;

    const agent = event.agentId || "unknown";
    agentUsage[agent] = (agentUsage[agent] || 0) + (event.tokensUsed || 0);
  });

  const dailyData = Object.entries(dailyUsage)
    .slice(-7)
    .map(([label, value]) => ({ label: label.slice(5), value }));

  const pieColors = ["#3b82f6", "#22c55e", "#f97316", "#a855f7", "#ec4899", "#06b6d4"];
  const pieData = Object.entries(agentUsage)
    .slice(0, 6)
    .map(([label, value], i) => ({
      label,
      value,
      color: pieColors[i % pieColors.length],
    }));

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold">{t("analytics.title")}</h2>
        <p className="text-muted-foreground">{t("analytics.description")}</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("analytics.totalConversations")}</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.totalConversations || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("analytics.totalMessages")}</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.totalMessages || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("analytics.tokensUsed")}</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(summary?.totalTokensUsed || 0).toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("analytics.avgResponse")}</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.averageResponseTime || 0}ms</div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("analytics.dailyUsage")}</CardTitle>
          </CardHeader>
          <CardContent>
            {dailyData.length > 0 ? (
              <SimpleBarChart data={dailyData} />
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">{t("analytics.noEvents")}</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("analytics.tokenDistribution")}</CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <SimplePieChart data={pieData} />
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">{t("analytics.noEvents")}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent events */}
      <Card>
        <CardHeader>
          <CardTitle>{t("analytics.recentEvents")}</CardTitle>
          <CardDescription>{t("analytics.recentEventsDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          {events && events.length > 0 ? (
            <div className="space-y-2">
              {events.slice(0, 20).map((event) => (
                <div key={event.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="text-sm font-medium">{event.eventType}</p>
                    <p className="text-xs text-muted-foreground">
                      {event.agentId && `Agent: ${event.agentId} | `}
                      {event.tokensUsed} tokens
                      {event.responseTimeMs && ` | ${event.responseTimeMs}ms`}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">{formatDate(event.createdAt)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">{t("analytics.noEvents")}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
