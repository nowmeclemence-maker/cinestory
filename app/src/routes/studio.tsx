import { createFileRoute } from "@tanstack/react-router";
import { StudioTemplate } from "@/layouts/studio";

export const Route = createFileRoute("/studio")({
  component: () => <StudioTemplate />,
});