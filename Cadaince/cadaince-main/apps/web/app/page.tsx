import { redirect } from "next/navigation";

// Root of app.aicomplice.com redirects to the main dashboard
export default function RootPage() {
  redirect("/briefing");
}
