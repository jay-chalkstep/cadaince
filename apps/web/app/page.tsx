import Link from "next/link";
import { ArrowRight, BarChart3, Target, Users, Zap } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Navigation */}
      <nav className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <span className="text-xl font-semibold">Aicomplice</span>
          <div className="flex items-center gap-4">
            <Link
              href="/sign-in"
              className="text-sm text-slate-600 hover:text-slate-900"
            >
              Sign in
            </Link>
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors"
            >
              Get Started
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 py-24 text-center">
        <h1 className="text-5xl font-bold text-slate-900 mb-6">
          Your AI accomplice for
          <br />
          <span className="text-blue-600">leadership alignment</span>
        </h1>
        <p className="text-xl text-slate-600 max-w-2xl mx-auto mb-10">
          Synthesize metrics, context, and updates into decision-ready
          intelligence. Built for teams running on EOS.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link
            href="/sign-up"
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Start Free Trial
            <ArrowRight className="h-5 w-5" />
          </Link>
          <Link
            href="/briefing"
            className="inline-flex items-center gap-2 border border-slate-300 text-slate-700 px-6 py-3 rounded-lg font-medium hover:bg-slate-50 transition-colors"
          >
            View Demo
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          <FeatureCard
            icon={<Zap className="h-6 w-6" />}
            title="Morning Briefings"
            description="AI-generated daily synthesis of what changed, what needs attention, and what's coming up."
          />
          <FeatureCard
            icon={<BarChart3 className="h-6 w-6" />}
            title="EOS Scorecard"
            description="Track your key metrics with automated data pulls from HubSpot, BigQuery, and more."
          />
          <FeatureCard
            icon={<Target className="h-6 w-6" />}
            title="Rocks & Issues"
            description="Manage quarterly priorities and run IDS sessions with full context at your fingertips."
          />
          <FeatureCard
            icon={<Users className="h-6 w-6" />}
            title="L10 Meetings"
            description="Run more effective Level 10 meetings with auto-generated agendas and action tracking."
          />
        </div>
      </section>

      {/* CTA */}
      <section className="bg-slate-900 text-white py-16 mt-16">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold mb-4">
            Ready to align your leadership team?
          </h2>
          <p className="text-slate-400 mb-8">
            Join teams already using Aicomplice to make better decisions, faster.
          </p>
          <Link
            href="/sign-up"
            className="inline-flex items-center gap-2 bg-white text-slate-900 px-6 py-3 rounded-lg font-medium hover:bg-slate-100 transition-colors"
          >
            Get Started Free
            <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="max-w-6xl mx-auto px-6 text-center text-sm text-slate-500">
          © {new Date().getFullYear()} Aicomplice. All rights reserved.
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="p-6 rounded-xl border bg-white hover:shadow-md transition-shadow">
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-blue-50 text-blue-600 mb-4">
        {icon}
      </div>
      <h3 className="font-semibold text-slate-900 mb-2">{title}</h3>
      <p className="text-sm text-slate-600">{description}</p>
    </div>
  );
}
