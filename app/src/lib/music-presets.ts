/**
 * CineStory music library presets — AI-generated beds (Higgsfield Sonilo).
 * Each entry is a ready-to-mix track URL; users can also upload their own
 * tracks (stored in the music_tracks library).
 */
export interface MusicPreset {
  id: string;
  name: string;
  genre: string;
  mood: string;
  url: string;
}

export const MUSIC_PRESETS: MusicPreset[] = [
  {
    id: "emotional-score",
    name: "Emotional Score",
    genre: "Cinematic",
    mood: "Emotional, hopeful",
    url: "https://d8j0ntlcm91z4.cloudfront.net/user_31M19Hft5zAlaZiYdbSWpgw8fIc/hf_20260922_071804_776b57d0-8a45-4824-8e83-c231556e4ba0.m4a",
  },
  {
    id: "uplifting-rise",
    name: "Uplifting Rise",
    genre: "Cinematic",
    mood: "Motivational, inspiring",
    url: "https://d8j0ntlcm91z4.cloudfront.net/user_31M19Hft5zAlaZiYdbSWpgw8fIc/hf_20260922_071804_41db037c-fe1d-4297-8e0a-077900b6264d.m4a",
  },
  {
    id: "dark-suspense",
    name: "Dark Suspense",
    genre: "Cinematic",
    mood: "Tense, dramatic",
    url: "https://d8j0ntlcm91z4.cloudfront.net/user_31M19Hft5zAlaZiYdbSWpgw8fIc/hf_20260922_071804_1da892bf-16ce-4308-9240-a460c4af1d0c.m4a",
  },
];