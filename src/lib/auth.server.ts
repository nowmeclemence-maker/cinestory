export async function requireCurrentUser(): Promise<
  { ok: true; user: { id: string } } | { ok: false; status: number; body: unknown }
> {
  const response = await fetch("https://fnf.internal/user");
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    return { ok: false, status: response.status, body };
  }
  return { ok: true, user: body as { id: string } };
}
