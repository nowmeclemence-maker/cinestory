import { describe, expect, test } from "bun:test";
import { buildFilterComplex, escapeDrawtext } from "../container/filter-graph.mjs";

const FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf";

function clips(n) {
  return Array.from({ length: n }, (_, i) => ({ onScreenText: `Caption ${i}`, dialogueEnabled: true }));
}

/** The pads concat consumes, in the order ffmpeg reads them. */
function concatPads(filterComplex) {
  const line = filterComplex.split(";").find((part) => part.includes("concat=n="));
  return (line.slice(0, line.indexOf("concat=n=")).match(/\[[^\]]+\]/g) ?? []);
}

describe("concat pad order", () => {
  test("interleaves video and audio per clip, which is what ffmpeg requires", () => {
    const { filterComplex } = buildFilterComplex({ clips: clips(3), font: FONT });
    expect(concatPads(filterComplex)).toEqual(["[v0]", "[0:a]", "[v1]", "[1:a]", "[v2]", "[2:a]"]);
  });

  test("never groups all video pads before the audio pads", () => {
    // The shipped bug: [v0][v1][v2][0:a][1:a][2:a] made ffmpeg refuse the graph
    // with "Media type mismatch", so no multi-scene film could ever be cut.
    for (const count of [2, 3, 5, 8]) {
      const pads = concatPads(buildFilterComplex({ clips: clips(count), font: FONT }).filterComplex);
      const firstAudio = pads.findIndex((pad) => pad.endsWith(":a]"));
      const lastVideo = pads.map((pad) => pad.startsWith("[v")).lastIndexOf(true);
      expect(firstAudio).toBeLessThan(lastVideo);
    }
  });

  test("supplies exactly two pads per clip and declares the same count", () => {
    for (const count of [1, 2, 4, 7]) {
      const { filterComplex } = buildFilterComplex({ clips: clips(count), font: FONT });
      expect(concatPads(filterComplex)).toHaveLength(count * 2);
      expect(filterComplex).toContain(`concat=n=${count}:v=1:a=1[outv][outa]`);
    }
  });

  test("every video pad it consumes was actually produced upstream", () => {
    const { filterComplex } = buildFilterComplex({ clips: clips(4), font: FONT });
    for (const pad of concatPads(filterComplex).filter((p) => p.startsWith("[v"))) {
      expect(filterComplex).toContain(`${pad};`);
    }
  });

  test("a single-clip film is still ordered correctly", () => {
    const { filterComplex } = buildFilterComplex({ clips: clips(1), font: FONT });
    expect(concatPads(filterComplex)).toEqual(["[v0]", "[0:a]"]);
  });

  test("refuses to build a graph with no clips rather than emitting concat=n=0", () => {
    expect(() => buildFilterComplex({ clips: [], font: FONT })).toThrow();
  });
});

describe("captions, hook and call to action", () => {
  test("burns a caption only where dialogue is on", () => {
    const { filterComplex } = buildFilterComplex({
      clips: [
        { onScreenText: "Spoken", dialogueEnabled: true },
        { onScreenText: "Muted", dialogueEnabled: false },
      ],
      font: FONT,
    });
    expect(filterComplex).toContain("Spoken");
    expect(filterComplex).not.toContain("Muted");
  });

  test("puts the hook on the first clip and the call to action on the last", () => {
    const { filterComplex } = buildFilterComplex({
      clips: clips(3),
      font: FONT,
      hook: "HOOKLINE",
      cta: "CTALINE",
    });
    const segments = filterComplex.split(";");
    expect(segments[0]).toContain("HOOKLINE");
    expect(segments[0]).not.toContain("CTALINE");
    expect(segments[2]).toContain("CTALINE");
    expect(segments[2]).not.toContain("HOOKLINE");
  });

  test("a one-clip film carries both the hook and the call to action", () => {
    const { filterComplex } = buildFilterComplex({
      clips: clips(1),
      font: FONT,
      hook: "HOOKLINE",
      cta: "CTALINE",
    });
    expect(filterComplex).toContain("HOOKLINE");
    expect(filterComplex).toContain("CTALINE");
  });
});

describe("the audio mix", () => {
  test("with no music or voiceover, the concat output is mapped straight out", () => {
    const { filterComplex, finalAudioLabel } = buildFilterComplex({ clips: clips(2), font: FONT });
    expect(finalAudioLabel).toBe("[outa]");
    expect(filterComplex).not.toContain("amix");
  });

  test("music is read from the input right after the clips", () => {
    const { filterComplex, finalAudioLabel } = buildFilterComplex({
      clips: clips(3),
      font: FONT,
      hasMusic: true,
    });
    expect(filterComplex).toContain("[3:a]volume=0.14");
    expect(finalAudioLabel).toBe("[mix1]");
  });

  test("a voiceover without music takes the slot music would have had", () => {
    const { filterComplex, finalAudioLabel } = buildFilterComplex({
      clips: clips(3),
      font: FONT,
      hasVoiceover: true,
    });
    expect(filterComplex).toContain("[3:a]volume=0.9");
    expect(finalAudioLabel).toBe("[mix2]");
  });

  test("with both, music comes first and the voiceover sits on top", () => {
    const { filterComplex, finalAudioLabel } = buildFilterComplex({
      clips: clips(2),
      font: FONT,
      hasMusic: true,
      hasVoiceover: true,
    });
    expect(filterComplex).toContain("[2:a]volume=0.14");
    expect(filterComplex).toContain("[3:a]volume=0.9");
    expect(filterComplex).toContain("[mix1][vo]amix");
    expect(finalAudioLabel).toBe("[mix2]");
  });
});

describe("drawtext escaping", () => {
  test("escapes what would otherwise split the filter string", () => {
    expect(escapeDrawtext("a:b")).toBe("a\\:b");
    expect(escapeDrawtext("a\\b")).toBe("a\\\\b");
  });

  test("replaces a straight apostrophe, which would close the quoted text", () => {
    expect(escapeDrawtext("it's")).toBe("it’s");
    expect(escapeDrawtext("it's")).not.toContain("'");
  });

  test("caps the length so one long caption cannot overrun the frame", () => {
    expect(escapeDrawtext("x".repeat(200))).toHaveLength(90);
  });

  test("survives null and undefined", () => {
    expect(escapeDrawtext(null)).toBe("");
    expect(escapeDrawtext(undefined)).toBe("");
  });
});
