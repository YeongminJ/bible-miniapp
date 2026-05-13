// 토스 OAuth login-me 응답의 PII(name 등) AES-256-GCM 복호화.
//
// 형식 (토스 공식 가이드 기준):
//   ciphertext = base64( [12-byte IV (NONCE)] || [ciphertext bytes] || [16-byte GCM tag] )
//   key        = base64( 32바이트 AES-256 키 )  ← 콘솔 이메일 발급
//   aad        = 평문 문자열 (예: "TOSS")        ← 콘솔 이메일 발급
//
// Cloudflare Workers 런타임은 Web Crypto API를 표준으로 제공하므로 별도 의존성 없음.

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * 토스 PII 암호문을 평문으로 복호화. 실패 시 null.
 *
 * @param ciphertextB64 login-me 응답의 암호화된 필드 (base64)
 * @param keyB64        AES-256 키 (base64)
 * @param aad           Additional Authenticated Data (평문 문자열)
 */
export async function decryptTossPII(
  ciphertextB64: string,
  keyB64: string,
  aad: string,
): Promise<string | null> {
  try {
    const cipher = base64ToBytes(ciphertextB64);
    if (cipher.length < 12 + 16) {
      // IV + 최소 16-byte tag 미만이면 형식 오류
      return null;
    }
    const iv = cipher.slice(0, 12);
    const dataAndTag = cipher.slice(12);
    const keyBytes = base64ToBytes(keyB64);
    if (keyBytes.length !== 32) {
      console.warn("[decrypt] key length is not 32 bytes:", keyBytes.length);
      return null;
    }
    const key = await crypto.subtle.importKey(
      "raw",
      keyBytes,
      { name: "AES-GCM" },
      false,
      ["decrypt"],
    );
    const aadBytes = new TextEncoder().encode(aad);
    const plaintext = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv,
        additionalData: aadBytes,
        tagLength: 128,
      },
      key,
      dataAndTag,
    );
    return new TextDecoder().decode(plaintext);
  } catch (err) {
    console.warn(
      "[decrypt] failed",
      err instanceof Error ? err.message : String(err),
    );
    return null;
  }
}
