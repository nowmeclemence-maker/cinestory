/**
 * The ffmpeg filter graph for a final cut, as a pure function.
 *
 * This lives apart from server.mjs so it can be tested without starting the
 * container's HTTP server. It is worth testing: the graph is a single string
 * handed to ffmpeg, a wrong pad order is invisible by reading, and it is what
 * kept every multi-scene film from ever being cut.
 */

/** ffmpeg's drawtext needs these escaped or the filter string breaks apart. */
export function escapeDrawtext(text) {
  return String(text ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/:/g, "\\:")
    .replace(/'/g, "’")
    .slice(0, 90);
}

/**
 * Build the `-filter_complex` string.
 *
 * @param {object} input
 * @param {Array<{onScreenText?: string, dialogueEnabled?: boolean}>} input.clips
 *   One per `-i` clip input, in order. Input index i is clip i.
 * @param {string} input.font        Absolute path to the caption font.
 * @param {string} [input.hook]      Burned over the first clip, first 3s.
 * @param {string} [input.cta]       Burned over the last clip.
 * @param {boolean} [input.hasMusic] A music bed follows the clips as an input.
 * @param {boolean} [input.hasVoiceover] A voiceover follows music, if any.
 * @returns {string}
 */
export function buildFilterComplex({ clips, font, hook, cta, hasMusic = false, hasVoiceover = false }) {
  if (!Array.isArray(clips) || clips.length === 0) {
    throw new Error("A final cut needs at least one clip.");
  }

  const filters = [];
  const concatPads = [];

  for (let i = 0; i < clips.length; i++) {
    const parts = [
      `[${i}:v]scale=1080:1920:force_original_aspect_ratio=decrease`,
      `pad=1080:1920:(ow-iw)/2:(oh-ih)/2`,
      `setsar=1`,
    ];
    // A scene's caption is burned only when its dialogue is enabled.
    const caption = clips[i].dialogueEnabled === false ? "" : clips[i].onScreenText;
    if (caption) {
      parts.push(
        `drawtext=fontfile=${font}:text='${escapeDrawtext(caption)}':fontsize=52:fontcolor=white:borderw=3:bordercolor=black@0.75:x=(w-text_w)/2:y=h-260`,
      );
    }
    if (i === 0 && hook) {
      parts.push(
        `drawtext=fontfile=${font}:text='${escapeDrawtext(hook)}':fontsize=58:fontcolor=white:borderw=4:bordercolor=black@0.8:x=(w-text_w)/2:y=140:enable='lte(t,3)'`,
      );
    }
    if (i === clips.length - 1 && cta) {
      parts.push(
        `drawtext=fontfile=${font}:text='${escapeDrawtext(cta)}':fontsize=50:fontcolor=white:borderw=3:bordercolor=black@0.8:x=(w-text_w)/2:y=h-160`,
      );
    }
    filters.push(`${parts.join(",")}[v${i}]`);

    // concat takes its inputs INTERLEAVED — v0, a0, v1, a1, … — never all the
    // video pads followed by all the audio pads. Grouping them made ffmpeg wire
    // a video pad into an audio input and refuse the whole graph ("Media type
    // mismatch … Cannot create the link drawtext:0 -> concat:1"), which is why
    // no multi-scene film had ever been cut. One clip was the only shape that
    // happened to come out in the right order.
    concatPads.push(`[v${i}][${i}:a]`);
  }

  const concatLine = `${concatPads.join("")}concat=n=${clips.length}:v=1:a=1[outv][outa]`;

  // Music sits low under the film, faded in; the voiceover rides on top.
  const musicInputIdx = clips.length;
  const voiceInputIdx = hasMusic ? clips.length + 1 : clips.length;
  const audioLines = [];
  let finalAudioLabel = "[outa]";
  if (hasMusic) {
    audioLines.push(`[${musicInputIdx}:a]volume=0.14,afade=t=in:st=0:d=1[mus]`);
    audioLines.push(`${finalAudioLabel}[mus]amix=inputs=2:duration=first:normalize=0[mix1]`);
    finalAudioLabel = "[mix1]";
  }
  if (hasVoiceover) {
    audioLines.push(`[${voiceInputIdx}:a]volume=0.9[vo]`);
    audioLines.push(`${finalAudioLabel}[vo]amix=inputs=2:duration=first:normalize=0[mix2]`);
    finalAudioLabel = "[mix2]";
  }

  return {
    filterComplex: [...filters, concatLine, ...audioLines].join(";"),
    finalAudioLabel,
  };
}
