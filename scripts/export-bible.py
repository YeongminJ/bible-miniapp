#!/usr/bin/env python3
"""
bible_krv.db → public/data/bible/{id}.json (66 권별 파일) + index.json
한 번 실행해서 정적 데이터 만들고 끝. 추후 DB 업데이트 시에만 재실행.

각 파일 형식:
  {
    "id": 1, "name_kr": "창세기", "name_en": "Genesis",
    "testament": "OT", "chapter_count": 50,
    "chapters": [
      { "chapter": 1, "summary": "…", "question": "…",
        "verses": [{ "verse": 1, "text": "…" }, …]
      }, …
    ]
  }
"""
import json
import os
import sqlite3
import sys

DB_PATH = "/Users/m/claude_workspace/bible_reader_flutter/assets/db/bible_krv.db"
OUT_DIR = "/Users/m/claude_workspace/bible-miniapp/public/data/bible"


def main():
    if not os.path.exists(DB_PATH):
        sys.exit(f"DB not found at {DB_PATH}")
    os.makedirs(OUT_DIR, exist_ok=True)

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row

    # 1) books index — chapter별 절 개수 포함 (verse_counts)
    #    재진입 시 "다음 미완료 절" 계산을 책 데이터 fetch 없이 할 수 있게.
    books = list(
        conn.execute(
            "SELECT id, name_kr, name_en, testament, chapter_count FROM books ORDER BY id"
        )
    )
    index = []
    for b in books:
        bid = b["id"]
        verse_counts = [
            row["c"]
            for row in conn.execute(
                "SELECT chapter, COUNT(*) AS c FROM verses WHERE book_id=? GROUP BY chapter ORDER BY chapter",
                (bid,),
            )
        ]
        # chapter_count 보다 적게 채워졌으면 0으로 패딩 (빠진 장 방어)
        while len(verse_counts) < b["chapter_count"]:
            verse_counts.append(0)
        index.append(
            {
                "id": bid,
                "name_kr": b["name_kr"],
                "name_en": b["name_en"],
                "testament": b["testament"],
                "chapter_count": b["chapter_count"],
                "verse_counts": verse_counts,
            }
        )
    with open(os.path.join(OUT_DIR, "index.json"), "w", encoding="utf-8") as f:
        json.dump(index, f, ensure_ascii=False, separators=(",", ":"))

    # 2) per-book files
    total_verses = 0
    total_summaries = 0
    for b in books:
        bid = b["id"]
        verses_by_chapter: dict[int, list] = {}
        for r in conn.execute(
            "SELECT chapter, verse, text FROM verses WHERE book_id = ? ORDER BY chapter, verse",
            (bid,),
        ):
            verses_by_chapter.setdefault(r["chapter"], []).append(
                {"verse": r["verse"], "text": r["text"]}
            )

        summaries: dict[int, dict] = {}
        for r in conn.execute(
            "SELECT chapter, summary, question FROM chapter_summaries WHERE book_id = ?",
            (bid,),
        ):
            summaries[r["chapter"]] = {
                "summary": r["summary"],
                "question": r["question"] or "",
            }
            total_summaries += 1

        chapters = []
        for ch in range(1, b["chapter_count"] + 1):
            verses = verses_by_chapter.get(ch, [])
            total_verses += len(verses)
            entry = {"chapter": ch, "verses": verses}
            s = summaries.get(ch)
            if s and s["summary"]:
                entry["summary"] = s["summary"]
            if s and s["question"]:
                entry["question"] = s["question"]
            chapters.append(entry)

        out = {
            "id": bid,
            "name_kr": b["name_kr"],
            "name_en": b["name_en"],
            "testament": b["testament"],
            "chapter_count": b["chapter_count"],
            # 권별 JSON에도 verse_counts 포함 — getBookProgress(book) 호출 시
            # BookData에서 verse_counts 읽어도 안전하게 (index와 동일 구조).
            "verse_counts": [len(c["verses"]) for c in chapters],
            "chapters": chapters,
        }
        with open(os.path.join(OUT_DIR, f"{bid}.json"), "w", encoding="utf-8") as f:
            json.dump(out, f, ensure_ascii=False, separators=(",", ":"))

    # 3) summary
    sizes = []
    for fn in sorted(os.listdir(OUT_DIR)):
        p = os.path.join(OUT_DIR, fn)
        sizes.append((fn, os.path.getsize(p)))
    total_bytes = sum(s for _, s in sizes)

    print(f"OK — {len(books)} books, {total_verses} verses, {total_summaries} summaries")
    print(f"Output dir: {OUT_DIR}")
    print(f"Total size: {total_bytes/1024:.1f} KB ({total_bytes:,} bytes)")
    print(f"Largest: {max(sizes, key=lambda x: x[1])}")
    print(f"Smallest: {min(sizes, key=lambda x: x[1])}")


if __name__ == "__main__":
    main()
