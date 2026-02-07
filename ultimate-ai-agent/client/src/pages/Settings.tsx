import { useState } from "react";
import { Save, Moon, Sun, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { useTheme } from "@/contexts/ThemeContext";
import { useI18n } from "@/contexts/I18nContext";

export default function Settings() {
  const [apiKey, setApiKey] = useState("");
  const [defaultModel, setDefaultModel] = useState(
    () => localStorage.getItem("settings.defaultModel") || "gpt-4o-mini"
  );
  const [slackWebhook, setSlackWebhook] = useState(
    () => localStorage.getItem("settings.slackWebhook") || ""
  );
  const [discordWebhook, setDiscordWebhook] = useState(
    () => localStorage.getItem("settings.discordWebhook") || ""
  );
  const [googleMapsKey, setGoogleMapsKey] = useState(
    () => localStorage.getItem("settings.googleMapsKey") || ""
  );
  const [saved, setSaved] = useState(false);

  const { data: health } = trpc.health.useQuery();
  const { theme, setTheme } = useTheme();
  const { t, locale, setLocale } = useI18n();

  const handleSave = () => {
    localStorage.setItem("settings.defaultModel", defaultModel);
    if (slackWebhook) localStorage.setItem("settings.slackWebhook", slackWebhook);
    if (discordWebhook) localStorage.setItem("settings.discordWebhook", discordWebhook);
    if (googleMapsKey) localStorage.setItem("settings.googleMapsKey", googleMapsKey);
    if (apiKey) localStorage.setItem("settings.apiKeySet", "true");
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold">{t("settings.title")}</h2>
        <p className="text-muted-foreground">{t("settings.description")}</p>
      </div>

      {/* Appearance */}
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.theme")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            {([
              { value: "light", icon: Sun, label: t("settings.themeLight") },
              { value: "dark", icon: Moon, label: t("settings.themeDark") },
              { value: "system", icon: Monitor, label: t("settings.themeSystem") },
            ] as const).map(({ value, icon: Icon, label }) => (
              <Button
                key={value}
                variant={theme === value ? "default" : "outline"}
                size="sm"
                onClick={() => setTheme(value)}
                className="gap-2"
              >
                <Icon className="h-4 w-4" />
                {label}
              </Button>
            ))}
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">{t("settings.language")}</label>
            <div className="flex gap-2">
              <Button variant={locale === "ja" ? "default" : "outline"} size="sm" onClick={() => setLocale("ja")}>Japanese</Button>
              <Button variant={locale === "en" ? "default" : "outline"} size="sm" onClick={() => setLocale("en")}>English</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* API Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.apiConfig")}</CardTitle>
          <CardDescription>{t("settings.apiConfigDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block">{t("settings.apiKey")}</label>
            <Input type="password" placeholder="sk-..." value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
            <p className="text-xs text-muted-foreground mt-1">{t("settings.apiKeyHint")}</p>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">{t("settings.defaultModel")}</label>
            <select value={defaultModel} onChange={(e) => setDefaultModel(e.target.value)} className="w-full bg-background border rounded-md px-3 py-2 text-sm">
              <option value="gpt-4o-mini">GPT-4o Mini</option>
              <option value="gpt-4o">GPT-4o</option>
              <option value="gpt-4-turbo">GPT-4 Turbo</option>
              <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Integrations */}
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.integrations")}</CardTitle>
          <CardDescription>{t("settings.integrationsDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block">{t("settings.slackWebhook")}</label>
            <Input placeholder="https://hooks.slack.com/services/..." value={slackWebhook} onChange={(e) => setSlackWebhook(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">{t("settings.discordWebhook")}</label>
            <Input placeholder="https://discord.com/api/webhooks/..." value={discordWebhook} onChange={(e) => setDiscordWebhook(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">{t("settings.googleMapsKey")}</label>
            <Input placeholder="AIza..." value={googleMapsKey} onChange={(e) => setGoogleMapsKey(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} className="w-full">
        <Save className="h-4 w-4 mr-2" />
        {saved ? t("settings.saved") : t("settings.save")}
      </Button>

      {/* System Status */}
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.systemStatus")}</CardTitle>
          <CardDescription>{t("settings.systemStatusDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">{t("settings.apiServer")}</span>
              <span className={`text-sm font-medium ${health?.status === "ok" ? "text-green-500" : "text-red-500"}`}>
                {health?.status === "ok" ? t("settings.connected") : t("settings.disconnected")}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">{t("settings.serverTime")}</span>
              <span className="text-sm text-muted-foreground">{health?.timestamp || "N/A"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">{t("settings.database")}</span>
              <span className="text-sm font-medium text-green-500">SQLite (Local)</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{t("settings.about")}</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Ultimate AI Agent Platform v2.0.0</p>
          <p className="text-sm text-muted-foreground mt-1">Built with React, Express, tRPC, Drizzle ORM, and OpenAI.</p>
        </CardContent>
      </Card>
    </div>
  );
}
