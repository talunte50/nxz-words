import { currentUser, ok } from "@/lib/api";
import { getBookOverrides } from "@/lib/config/books";
import { bookIdFromWordId } from "@/lib/dicts/loader";
import { listEnabledWordBooks } from "@/lib/wordbooks-server";

export const dynamic = "force-dynamic";

export async function GET() {
  const context = await currentUser();

  const learnedByBook = new Map<string, number>();
  if (context) {
    for (const [wordId, state] of Object.entries(context.data.reviews)) {
      if (state.reps <= 0) continue;
      // 注意：bookId 自身可能含下划线，必须用最长前缀匹配而非 indexOf("_")
      const bookId = bookIdFromWordId(wordId);
      if (!bookId) continue;
      learnedByBook.set(bookId, (learnedByBook.get(bookId) ?? 0) + 1);
    }
  }

  // 前端只看到「已启用」的词库；管理端可在 /api/admin/books 停用词库
  const overrides = await getBookOverrides();
  const books = listEnabledWordBooks(overrides).map((book) => ({
    ...book,
    learned: learnedByBook.get(book.id) ?? 0,
  }));

  // 词书数过多时，接口默认只返回清单 + 已学统计，词条仍按需加载
  return ok({
    books,
    currentBookId: context?.data.profile.currentBookId ?? "cet4",
  });
}