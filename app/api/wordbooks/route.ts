import { currentUser, ok } from "@/lib/api";
import { listWordBooks } from "@/lib/wordbooks-server";

export const dynamic = "force-dynamic";

export async function GET() {
  const context = await currentUser();

  const learnedByBook = new Map<string, number>();
  if (context) {
    for (const [wordId, state] of Object.entries(context.data.reviews)) {
      if (state.reps <= 0) continue;
      const at = wordId.indexOf("_");
      if (at <= 0) continue;
      const bookId = wordId.slice(0, at);
      learnedByBook.set(bookId, (learnedByBook.get(bookId) ?? 0) + 1);
    }
  }

  const books = listWordBooks().map((book) => ({
    ...book,
    learned: learnedByBook.get(book.id) ?? 0,
  }));

  return ok({
    books,
    currentBookId: context?.data.profile.currentBookId ?? "cet4",
  });
}