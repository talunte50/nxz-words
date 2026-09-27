import { currentUser, fail, ok } from "@/lib/api";
import { countLearned, countMastered, dueReviews } from "@/lib/store/stats";

export const dynamic = "force-dynamic";

export async function GET() {
  const context = await currentUser();
  if (!context) return fail("未登录", 401);

  const { data } = context;
  return ok({
    profile: data.profile,
    learned: countLearned(data),
    mastered: countMastered(data),
    dueCount: dueReviews(data).length,
    favorites: data.favorites.length,
  });
}