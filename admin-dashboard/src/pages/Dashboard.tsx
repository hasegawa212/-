import { useState } from "react";
import { toast } from "sonner";
import {
  LogOut,
  Moon,
  Sun,
  TrendingUp,
  Phone,
  CalendarCheck,
  Wallet,
  RefreshCw,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTheme } from "@/contexts/ThemeContext";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { cn, formatCurrency } from "@/lib/utils";

interface Kpi {
  label: string;
  value: string;
  delta: string;
  trendUp: boolean;
  icon: typeof TrendingUp;
}

const KPIS: Kpi[] = [
  {
    label: "今月の売上",
    value: formatCurrency(12_480_000),
    delta: "+8.2%",
    trendUp: true,
    icon: TrendingUp,
  },
  {
    label: "架電件数",
    value: "1,284 件",
    delta: "+124 件",
    trendUp: true,
    icon: Phone,
  },
  {
    label: "アポ獲得数",
    value: "37 件",
    delta: "+5 件",
    trendUp: true,
    icon: CalendarCheck,
  },
  {
    label: "入金待ち",
    value: formatCurrency(3_150_000),
    delta: "-2.1%",
    trendUp: false,
    icon: Wallet,
  },
];

interface Activity {
  time: string;
  text: string;
}

const ACTIVITIES: Activity[] = [
  { time: "10:24", text: "新規アポイントを登録しました（株式会社サンプル商事）" },
  { time: "09:58", text: "請求書 #2024-0517 が支払い済みになりました" },
  { time: "09:31", text: "テレアポリストに 12 件のリードを追加しました" },
  { time: "昨日", text: "月次レポートを出力しました" },
];

function LoginScreen() {
  const { login } = useAdminAuth();
  const [email, setEmail] = useState("admin@example.com");
  const [password, setPassword] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (login(email, password)) {
      toast.success("ログインしました");
    } else {
      toast.error("メールアドレスまたはパスワードが正しくありません");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">管理者ログイン</CardTitle>
          <CardDescription>
            ダッシュボードにアクセスするにはログインしてください。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-sm font-medium">
                メールアドレス
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                autoComplete="username"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="password" className="text-sm font-medium">
                パスワード
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                autoComplete="current-password"
              />
            </div>
            <Button type="submit" className="w-full">
              ログイン
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              デモ用: admin@example.com / admin
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          onClick={() => setTheme(isDark ? "light" : "dark")}
          aria-label="テーマを切り替え"
        >
          {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {isDark ? "ライトモードに切り替え" : "ダークモードに切り替え"}
      </TooltipContent>
    </Tooltip>
  );
}

export default function Dashboard() {
  const { isAuthenticated, admin, logout } = useAdminAuth();

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-lg font-semibold">管理ダッシュボード</h1>
            <p className="text-sm text-muted-foreground">{admin?.email}</p>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => toast.info("最新のデータに更新しました")}
                  aria-label="更新"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>データを更新</TooltipContent>
            </Tooltip>
            <Button
              variant="outline"
              onClick={() => {
                logout();
                toast.success("ログアウトしました");
              }}
            >
              <LogOut className="mr-2 h-4 w-4" />
              ログアウト
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-6 py-8">
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {KPIS.map((kpi) => {
            const Icon = kpi.icon;
            return (
              <Card key={kpi.label}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardDescription>{kpi.label}</CardDescription>
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{kpi.value}</div>
                  <p
                    className={cn(
                      "mt-1 text-xs",
                      kpi.trendUp ? "text-emerald-500" : "text-destructive"
                    )}
                  >
                    {kpi.delta}（前月比）
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </section>

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">最近のアクティビティ</CardTitle>
              <CardDescription>直近の操作履歴を表示しています。</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="divide-y">
                {ACTIVITIES.map((a, i) => (
                  <li key={i} className="flex gap-4 py-3 text-sm">
                    <span className="w-12 shrink-0 text-muted-foreground">
                      {a.time}
                    </span>
                    <span>{a.text}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">クイックアクション</CardTitle>
              <CardDescription>よく使う操作へのショートカット。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                className="w-full"
                onClick={() => toast("新規案件フォームは準備中です")}
              >
                新規案件を登録
              </Button>
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => toast("レポートを出力しました")}
              >
                月次レポートを出力
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => toast("テレアポリストを開きます")}
              >
                テレアポリストを開く
              </Button>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}
