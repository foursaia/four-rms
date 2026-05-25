import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { UtensilsCrossed, ChefHat, LayoutDashboard, Settings, Globe, Bike } from "lucide-react";

export default function HomePage() {
  const modules = [
    {
      title: "Customer Kiosk",
      desc: "Self-service ordering for customers",
      icon: <UtensilsCrossed size={32} className="text-primary" />,
      href: "/kiosk",
      color: "border-primary/20 hover:border-primary/50"
    },
    {
      title: "Kitchen (KDS)",
      desc: "Live order panel for the chefs",
      icon: <ChefHat size={32} className="text-accent" />,
      href: "/kitchen",
      color: "border-accent/20 hover:border-accent/50"
    },
    {
      title: "Receptionist",
      desc: "Billing, Cash management & Admin",
      icon: <LayoutDashboard size={32} className="text-blue-500" />,
      href: "/reception",
      color: "border-blue-500/20 hover:border-blue-500/50"
    },
    {
      title: "Public Display",
      desc: "TV screen for order status updates",
      icon: <Settings size={32} className="text-emerald-500" />,
      href: "/display",
      color: "border-emerald-500/20 hover:border-emerald-500/50"
    },
    {
      title: "Manager Panel",
      desc: "Analytics, Menu & Stock Management",
      icon: <Settings size={32} className="text-purple-500" />,
      href: "/manager",
      color: "border-purple-500/20 hover:border-purple-500/50"
    },
    {
      title: "Delivery Hub",
      desc: "Rider Dispatch & Order Tracking",
      icon: <Bike size={32} className="text-orange-500" />,
      href: "/delivery",
      color: "border-orange-500/20 hover:border-orange-500/50"
    },
    {
      title: "CEO Portal",
      desc: "Executive Oversight & Multi-Branch Control",
      icon: <Globe size={32} className="text-amber-500" />,
      href: "/ceo",
      color: "border-amber-500/20 hover:border-amber-500/50"
    },
    {
      title: "Rider App",
      desc: "Mobile Portal for Delivery Riders",
      icon: <Bike size={32} className="text-emerald-400" />,
      href: "/rider",
      color: "border-emerald-400/20 hover:border-emerald-400/50"
    }
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-surface-lighter via-background to-background">
      <div className="max-w-4xl w-full text-center mb-16">
        <h1 className="text-6xl font-black text-gradient uppercase tracking-tighter mb-4">
          RMS PORTAL
        </h1>
        <p className="text-muted text-lg max-w-lg mx-auto font-medium">
          Select a module to launch the Smart Restaurant Management System.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 w-full max-w-7xl">
        {modules.map((m) => (
          <Link href={m.href} key={m.title} className="group">

            <Card className={`h-full transition-all duration-500 hover:scale-105 glass-lighter border-2 ${m.color}`}>
              <CardContent className="flex flex-col items-center text-center p-10">
                <div className="mb-6 p-4 rounded-3xl bg-background/50 border border-border shadow-inner group-hover:shadow-primary/20 transition-all">
                  {m.icon}
                </div>
                <h2 className="text-2xl font-bold mb-2 text-foreground group-hover:text-primary transition-colors">
                  {m.title}
                </h2>
                <p className="text-muted text-sm leading-relaxed">
                  {m.desc}
                </p>
                <Button className="mt-8 rounded-2xl w-full" variant="ghost">
                  Launch Module
                </Button>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <footer className="mt-20 flex items-center gap-6 opacity-30 hover:opacity-100 transition-opacity">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted">
          <Settings size={14} />
          System Config
        </div>
        <div className="h-4 w-px bg-border" />
        <p className="text-[10px] font-bold text-muted uppercase tracking-widest">
          RMS v1.0.0 (BETA)
        </p>
      </footer>
    </div>
  );
}
