import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { functions } from "@/lib/inngest/functions";

const handler = serve({
  client: inngest,
  functions,
});

// Type assertion to satisfy Next.js 16 stricter types
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const GET = handler.GET as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const POST = handler.POST as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const PUT = handler.PUT as any;
