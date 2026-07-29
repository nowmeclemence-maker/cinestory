import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { listCharacters, createCharacter, updateCharacter, deleteCharacter } from "./characters";

export const listCharactersFn = createServerFn({ method: "POST" }).handler(() => listCharacters());
export const createCharacterFn = createServerFn({ method: "POST" })
  .validator(z.object({ name: z.string().min(1) }))
  .handler(({ data }) => createCharacter({ name: data.name }));
export const updateCharacterFn = createServerFn({ method: "POST" })
  .validator(z.any())
  .handler(({ data }) => updateCharacter(data.id, data));
export const deleteCharacterFn = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string() }))
  .handler(({ data }) => deleteCharacter(data.id));

export const getCreditBalanceFn = createServerFn({ method: "POST" }).handler(async () => {
  const { getCreditBalance } = await import("./credits");
  return getCreditBalance();
});
export const getTransactionsFn = createServerFn({ method: "POST" }).handler(async () => {
  const { getTransactions } = await import("./credits");
  return getTransactions();
});