import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { listStoriesFn } from "@/lib/story.functions";
import type { StoryDTO } from "@/lib/story-engine.server";
import { triggerAssembly } from "@/lib/story.browser";

const ACTIVE_STATUSES = new Set(["scripting", "characters", "locations", "storyboard", "generating", "assembling"]);
export function useStoriesFeed(scopeKey: string, projectId?: string) {
  const dispatched = useRef(new Set<string>());

  const query = useQuery({
    queryKey: ["cinestory", "stories", scopeKey, projectId ?? "all"],
    queryFn: () => listStoriesFn({ data: { projectId } }),
    refetchInterval: (latest) => {
      const stories = (latest.state.data as StoryDTO[] | undefined) ?? [];
      return stories.some((story) => ACTIVE_STATUSES.has(story.status)) ? 4000 : false;
    },
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    for (const story of query.data ?? []) {
      if (story.status === "assembling" && !dispatched.current.has(story.id)) {
        dispatched.current.add(story.id);
        void triggerAssembly(story.id).catch(() => {
          dispatched.current.delete(story.id);
        });
      }
    }
  }, [query.data]);

  return query;
}
