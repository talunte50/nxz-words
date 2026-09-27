import { ok } from "@/lib/api";
import { clearSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function POST() {
  await clearSession();
  return ok({ loggedOut: true });
}