import { auth, currentUser } from "@clerk/nextjs/server";

export async function getAuthUserId() {
  const { userId } = await auth();
  return userId;
}

export async function getCurrentUserEmail() {
  const user = await currentUser();
  return user?.emailAddresses[0]?.emailAddress;
}

export async function requireAuth() {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("Unauthorized");
  }
  return userId;
}
