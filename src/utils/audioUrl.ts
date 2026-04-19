const R2_BASE = "https://pub-7f6f4f93019b41ba9d9ade42f6e1cd25.r2.dev";

// 성경 이름 → R2 폴더명 매핑
const BOOK_FOLDERS: Record<string, string> = {
  "창세기": "01_창세기", "출애굽기": "02_출애굽기", "레위기": "03_레위기",
  "민수기": "04_민수기", "신명기": "05_신명기", "여호수아": "06_여호수아",
  "사사기": "07_사사기", "룻기": "08_룻기",
  "사무엘상": "09_I Samuel", "사무엘하": "10_II Samuel",
  "열왕기상": "11_I Kings", "열왕기하": "12_II Kings",
  "역대상": "13_I Chronicles", "역대하": "14_II Chronicles",
  "에스라": "15_에스라", "느헤미야": "16_느헤미야", "에스더": "17_에스더",
  "욥기": "18_욥기", "시편": "19_시편", "잠언": "20_잠언",
  "전도서": "21_전도서", "아가": "22_아가",
  "이사야": "23_이사야", "예레미야": "24_예레미야",
  "예레미야애가": "25_예레미야애가", "에스겔": "26_에스겔", "다니엘": "27_다니엘",
  "호세아": "28_호세아", "요엘": "29_요엘", "아모스": "30_아모스",
  "오바댜": "31_오바댜", "요나": "32_요나", "미가": "33_미가",
  "나훔": "34_나훔", "하박국": "35_하박국", "스바냐": "36_스바냐",
  "학개": "37_학개", "스가랴": "38_스가랴", "말라기": "39_말라기",
  "마태복음": "40_마태복음", "마가복음": "41_마가복음",
  "누가복음": "42_누가복음", "요한복음": "43_요한복음",
  "사도행전": "44_사도행전", "로마서": "45_로마서",
  "고린도전서": "46_I Corinthians", "고린도후서": "47_II Corinthians",
  "갈라디아서": "48_갈라디아서", "에베소서": "49_에베소서",
  "빌립보서": "50_빌립보서", "골로새서": "51_골로새서",
  "데살로니가전서": "52_I Thessalonians", "데살로니가후서": "53_II Thessalonians",
  "디모데전서": "54_I Timothy", "디모데후서": "55_II Timothy",
  "디도서": "56_디도서", "빌레몬서": "57_빌레몬서",
  "히브리서": "58_히브리서", "야고보서": "59_야고보서",
  "베드로전서": "60_I Peter", "베드로후서": "61_II Peter",
  "요한일서": "62_I John", "요한이서": "63_II John", "요한삼서": "64_III John",
  "유다서": "65_유다서", "요한계시록": "66_Revelation of John",
};

/**
 * 성경 참조 문자열("창세기 1:1", "시편 23:1")을 파싱하여
 * R2 오디오 URL을 반환합니다.
 */
export function parseVerseReference(ref: string): { bookName: string; chapter: number; verse: number } | null {
  // "창세기 1:1", "시편 23:1-2", "창세기 1:31-2:2" 등
  const match = ref.match(/^(.+?)\s+(\d+):(\d+)/);
  if (!match) return null;
  return {
    bookName: match[1].trim(),
    chapter: parseInt(match[2]),
    verse: parseInt(match[3]),
  };
}

export function getAudioUrl(bookName: string, chapter: number, verse: number, voice: "v1" | "v2" = "v1"): string | null {
  const folder = BOOK_FOLDERS[bookName];
  if (!folder) return null;

  const ch = chapter.toString().padStart(3, "0");
  const v = verse.toString().padStart(3, "0");
  return encodeURI(`${R2_BASE}/${voice}/${folder}/${ch}/${v}.m4a`);
}

export function getAudioUrlFromRef(ref: string, voice: "v1" | "v2" = "v1"): string | null {
  const parsed = parseVerseReference(ref);
  if (!parsed) return null;
  return getAudioUrl(parsed.bookName, parsed.chapter, parsed.verse, voice);
}
