import { ScenescribeConfig, ScenescribeMedia, ScenescribeTaskStatus, ScenescribeTopic } from "@/types/scenescribe";
import { logger } from "@/lib/logger";

const useMock = process.env.SCENESCRIBE_MOCK === "true" || process.env.NODE_ENV === "test";
const runwayKey = process.env.SCENESCRIBE_VIDEO_API_KEY;
const runwayBase = (process.env.SCENESCRIBE_VIDEO_API_URL || "https://api.dev.runwayml.com").replace(/\/$/, "");
const runwayVersion = process.env.SCENESCRIBE_RUNWAY_VERSION || "2024-11-06";
const runwayModel = process.env.SCENESCRIBE_RUNWAY_MODEL || "veo3.1";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function generateTopicVideo(
  topic: ScenescribeTopic,
  config: ScenescribeConfig
): Promise<{ status: ScenescribeTaskStatus; media: ScenescribeMedia }> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "";

  // Runway path (real generation) - text-to-video
  if (!useMock && runwayKey) {
    try {
      const prompt = buildPrompt(topic, config);
      const createUrl = `${runwayBase}/v1/text_to_video`;
      const ratio = mapAspectToRunwayRatio(config.aspectRatio || "16:9");
      const duration = mapDuration(config.targetDurationSeconds || 60);
      const createRes = await fetch(createUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${runwayKey}`,
          "X-Runway-Version": runwayVersion,
        },
        body: JSON.stringify({
          model: runwayModel,
          promptText: prompt,
          ratio,
          duration,
          audio: false,
        }),
      });

      if (!createRes.ok) {
        const err = await safeJson(createRes);
        logger.error("[SceneScribe] Runway create failed", { status: createRes.status, err });
        return { status: "failed", media: {} };
      }

      const createJson: any = await createRes.json();
      const taskId = createJson?.id;
      if (!taskId) {
        logger.error("[SceneScribe] Runway response missing id", createJson);
        return { status: "failed", media: {} };
      }

      const result = await pollRunwayVideo(taskId);
      const mediaUrl =
        (result as any)?.video?.url ||
        (result as any)?.assets?.video ||
        (result as any)?.output?.[0]?.url ||
        (result as any)?.asset_url ||
        (result as any)?.video_url;

      if (mediaUrl) {
        return {
          status: "ready",
          media: {
            videoUrl: mediaUrl,
            thumbnailUrl: (result as any)?.assets?.thumbnail || (result as any)?.thumbnail_url,
          },
        };
      }

      logger.error("[SceneScribe] Runway video missing asset URL", result);
      return { status: "failed", media: {} };
    } catch (error) {
      logger.error("[SceneScribe] Runway generation failed", error);
      return { status: "failed", media: {} };
    }
  }

  // Mock path (dev/test)
  if (useMock || !runwayKey) {
    await sleep(300); // tiny delay for UX
    return {
      status: "ready",
      media: {
        videoUrl: `${baseUrl}/drumline%20video.MP4?topic=${encodeURIComponent(topic.id)}`,
        thumbnailUrl: `${baseUrl}/og-image.png`,
        subtitlesUrl: `${baseUrl}/assets/mock-captions.vtt`,
      },
    };
  }

  // Placeholder for real provider integration
  logger.error(`[SceneScribe] Video generation failed for ${topic.id} - no provider configured`);
  return { status: "failed", media: {} };
}

function buildPrompt(topic: ScenescribeTopic, config: ScenescribeConfig): string {
  const sceneHints =
    topic.scenes
      ?.map((s) => {
        const actions = Array.isArray(s.actions)
          ? s.actions
          : typeof s.actions === "string"
            ? [s.actions]
            : [];
        const props = Array.isArray(s.props)
          ? s.props
          : typeof s.props === "string"
            ? [s.props]
            : [];
        const overlays = Array.isArray(s.overlayTextSuggestions)
          ? s.overlayTextSuggestions
          : typeof s.overlayTextSuggestions === "string"
            ? [s.overlayTextSuggestions]
            : [];
        return `Scene ${s.order}: ${s.sceneSummary}. Visuals: ${s.visualDescription}. Actions: ${actions.join(
          ", "
        )}. Props: ${props.join(", ")}. Overlays: ${overlays.join(", ")}.`;
      })
      .join(" ")
      ?.slice(0, 1200) || "";

  return [
    `Create a vivid, action-based explainer video topic: ${topic.title}.`,
    `Tone: ${topic.toneOverride || config.tone}. Style: ${config.style}. Aspect ratio: ${config.aspectRatio}. Target duration ~${config.targetDurationSeconds}s.`,
    `Description: ${topic.description}`,
    `Key points: ${topic.keyPoints?.join("; ")}`,
    `Scenes: ${sceneHints}`,
    `Use clear props and readable overlays. Avoid text-to-speech; visuals only.`,
  ]
    .filter(Boolean)
    .join(" ");
}

function mapAspectToRunwayRatio(aspect: string): string {
  if (aspect === "9:16") return "720:1280";
  if (aspect === "16:9") return "1920:1080";
  // fallback to landscape
  return "1920:1080";
}

function mapDuration(seconds: number): 4 | 6 | 8 {
  if (seconds <= 5) return 4;
  if (seconds <= 7) return 6;
  return 8;
}

async function pollRunwayVideo(videoId: string) {
  const maxAttempts = 12;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await sleep(2500);
    const res = await fetch(`${runwayBase}/v1/tasks/${videoId}`, {
      headers: {
        Authorization: `Bearer ${runwayKey}`,
        "X-Runway-Version": runwayVersion,
      },
    });
    if (!res.ok) {
      const err = await safeJson(res);
      logger.error("[SceneScribe] Runway poll failed", { status: res.status, err });
      continue;
    }
    const json: any = await res.json();
    const status = json?.status;
    if (
      status === "succeeded" ||
      status === "completed" ||
      json?.video?.url ||
      json?.assets?.video ||
      json?.asset_url ||
      json?.video_url
    ) {
      return json;
    }
    if (status === "failed") {
      logger.error("[SceneScribe] Runway reported failure", json);
      return null;
    }
  }
  logger.error("[SceneScribe] Runway polling timed out", { videoId });
  return null;
}

async function safeJson(res: Response) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

