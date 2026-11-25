export function passwordErrorMessage(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const details = error as { code?: string; message?: string };
  if (details.code === "weak_password" || /known to be weak|easy to guess|leaked|pwned/i.test(details.message || "")) {
    return "Esta senha é fraca ou consta em vazamentos conhecidos. Escolha outra senha única, de preferência longa, com letras, números e símbolos.";
  }
  return null;
}