/** Browser-side helpers for kicking off the final cut assembly container. */

export async function mintContainerToken(): Promise<string> {
  const response = await fetch("/__auth/container-token", { method: "POST" });
  if (!response.ok) throw new Error("Could not start the final cut.");
  const body = (await response.json()) as { token: string };
  return body.token;
}

export async function triggerAssembly(storyId: string): Promise<void> {
  const token = await mintContainerToken();
  await fetch(`/api/stories/${storyId}/assemble`, {
    method: "POST",
    headers: { "x-hf-container-token": token },
  });
}
