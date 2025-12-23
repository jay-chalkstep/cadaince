import { Webhook } from "svix";
import { headers } from "next/headers";
import { WebhookEvent } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    throw new Error("Please add CLERK_WEBHOOK_SECRET to your environment variables");
  }

  // Get the headers
  const headerPayload = await headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  // If there are no headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response("Missing svix headers", { status: 400 });
  }

  // Get the body
  const payload = await req.json();
  const body = JSON.stringify(payload);

  // Create a new Svix instance with your secret
  const wh = new Webhook(WEBHOOK_SECRET);

  let evt: WebhookEvent;

  // Verify the payload with the headers
  try {
    evt = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as WebhookEvent;
  } catch (err) {
    console.error("Error verifying webhook:", err);
    return new Response("Error verifying webhook", { status: 400 });
  }

  const eventType = evt.type;
  const supabase = createAdminClient();

  if (eventType === "user.created" || eventType === "user.updated") {
    const { id, email_addresses, first_name, last_name, image_url } = evt.data;

    const primaryEmail = email_addresses.find((e) => e.id === evt.data.primary_email_address_id);
    const email = primaryEmail?.email_address;

    if (!email) {
      console.error("No email found for user:", id);
      return new Response("No email found", { status: 400 });
    }

    const fullName = [first_name, last_name].filter(Boolean).join(" ") || email.split("@")[0];

    // First, check if there's an existing profile with this email (from seed data)
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id, clerk_id")
      .eq("email", email)
      .single();

    if (existingProfile) {
      // Update the existing profile with the Clerk ID and any new info
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          clerk_id: id,
          full_name: fullName,
          avatar_url: image_url ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingProfile.id);

      if (updateError) {
        console.error("Error updating profile:", updateError);
        return new Response("Error updating profile", { status: 500 });
      }

      console.log(`Updated profile for ${email} with Clerk ID ${id}`);
    } else {
      // Check if profile already exists with this clerk_id
      const { data: profileByClerkId } = await supabase
        .from("profiles")
        .select("id")
        .eq("clerk_id", id)
        .single();

      if (profileByClerkId) {
        // Update existing profile
        const { error: updateError } = await supabase
          .from("profiles")
          .update({
            email,
            full_name: fullName,
            avatar_url: image_url ?? null,
            updated_at: new Date().toISOString(),
          })
          .eq("clerk_id", id);

        if (updateError) {
          console.error("Error updating profile:", updateError);
          return new Response("Error updating profile", { status: 500 });
        }

        console.log(`Updated profile for Clerk ID ${id}`);
      } else {
        // Create new profile (for users not in seed data)
        const { error: insertError } = await supabase
          .from("profiles")
          .insert({
            clerk_id: id,
            email,
            full_name: fullName,
            avatar_url: image_url ?? null,
            role: "Team Member",
            access_level: "slt",
            is_elt: false,
          });

        if (insertError) {
          console.error("Error creating profile:", insertError);
          return new Response("Error creating profile", { status: 500 });
        }

        console.log(`Created new profile for ${email} with Clerk ID ${id}`);
      }
    }
  }

  if (eventType === "user.deleted") {
    const { id } = evt.data;

    if (!id) {
      return new Response("No user ID in deletion event", { status: 400 });
    }

    // We don't delete the profile, just clear the clerk_id
    // This preserves historical data
    const { error } = await supabase
      .from("profiles")
      .update({ clerk_id: "" })
      .eq("clerk_id", id);

    if (error) {
      console.error("Error clearing clerk_id from profile:", error);
      return new Response("Error processing deletion", { status: 500 });
    }

    console.log(`Cleared Clerk ID ${id} from profile`);
  }

  return new Response("OK", { status: 200 });
}
