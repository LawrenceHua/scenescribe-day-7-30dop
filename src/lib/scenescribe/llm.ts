import OpenAI from "openai";
import { logger } from "@/lib/logger";
import {
  ScenescribeConfig,
  ScenescribeScene,
  ScenescribeScriptResponse,
  ScenescribeStructureResponse,
  ScenescribeTopic,
} from "@/types/scenescribe";

const useMock = process.env.SCENESCRIBE_MOCK === "true" || process.env.NODE_ENV === "test" || !process.env.OPENAI_API_KEY;
const openai = !useMock ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

function buildMockTopics(): ScenescribeTopic[] {
  return [
    {
      id: "t1",
      order: 1,
      title: "Hook & Problem",
      description: "Why the source content matters and the pain it addresses.",
      keyPoints: ["Context", "Pain point", "Why now"],
      enabled: true,
      scenes: mockScenes("Hook & Problem"),
      narration:
        "People drown in long articles. In this topic we frame the pain and show why acting visually helps.",
      scriptStatus: "ready",
      videoStatus: "pending",
    },
    {
      id: "t2",
      order: 2,
      title: "Core Concepts",
      description: "Break down the main ideas with actions, props, and diagrams.",
      keyPoints: ["Concept 1", "Concept 2", "Concept 3"],
      enabled: true,
      scenes: mockScenes("Core Concepts"),
      narration:
        "We stage the most important ideas with props, camera moves, and overlays to keep attention high.",
      scriptStatus: "ready",
      videoStatus: "pending",
    },
    {
      id: "t3",
      order: 3,
      title: "Takeaways",
      description: "Summarize with calls-to-action and next steps.",
      keyPoints: ["Key takeaway", "Next action", "Reminder"],
      enabled: true,
      scenes: mockScenes("Takeaways"),
      narration: "Wrap with crisp takeaways and a direct call-to-action tailored to the target platform.",
      scriptStatus: "ready",
      videoStatus: "pending",
    },
  ];
}

function mockScenes(topicLabel: string): ScenescribeScene[] {
  return [
    {
      id: `${topicLabel}-s1`,
      order: 1,
      sceneSummary: `${topicLabel} intro`,
      visualDescription: `Host in studio introduces ${topicLabel} with a prop table and bold overlays.`,
      actions: ["Camera dolly-in to host", "Host gestures to prop table"],
      props: ["prop table", "whiteboard", "overlay cards"],
      overlayTextSuggestions: ["Problem", "Why now"],
      cameraStyle: "Medium close-up",
      estimatedDurationSeconds: 8,
    },
    {
      id: `${topicLabel}-s2`,
      order: 2,
      sceneSummary: `${topicLabel} demo`,
      visualDescription: `Animated diagram and overlay labels walking through ${topicLabel}.`,
      actions: ["On-screen arrows animate", "Highlight key numbers"],
      props: ["diagram", "floating labels"],
      overlayTextSuggestions: ["Step 1", "Step 2"],
      cameraStyle: "Screen capture + overlay",
      estimatedDurationSeconds: 10,
    },
  ];
}

export async function generateStructure(
  cleanedText: string,
  config: ScenescribeConfig
): Promise<ScenescribeStructureResponse> {
  if (useMock || !openai) {
    return {
      summary: "High-level summary of the provided content, generated in mock mode for reliability.",
      topics: buildMockTopics(),
    };
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You segment content into crisp, ordered topics suitable for short video explainers. Respond ONLY with JSON in the requested shape.",
        },
        {
          role: "user",
          content: JSON.stringify({
            content: cleanedText.slice(0, 8000),
            config,
            instructions:
              "Return summary plus 4-8 topics with id, title, description, keyPoints (3-5), and sourceSpan start/end char offsets.",
          }),
        },
      ],
      temperature: 0.4,
      response_format: { type: "json_object" },
    });

    const parsed = JSON.parse(completion.choices[0].message.content || "{}");
    return {
      summary: parsed.summary || "",
      topics: (parsed.topics || []).map((t: any, idx: number) => ({
        id: t.id || `t${idx + 1}`,
        order: idx + 1,
        title: t.title,
        description: t.description,
        keyPoints: t.keyPoints || [],
        enabled: t.enabled ?? true,
        sourceSpan: t.sourceSpan,
        scriptStatus: "pending",
        videoStatus: "pending",
      })) as ScenescribeTopic[],
    };
  } catch (error) {
    logger.error("[SceneScribe] Failed to generate structure", error);
    return {
      summary: "Could not auto-generate summary. Please review topics manually.",
      topics: buildMockTopics(),
    };
  }
}

export async function generateScripts(
  topics: ScenescribeTopic[],
  cleanedText: string,
  config: ScenescribeConfig
): Promise<ScenescribeScriptResponse> {
  if (useMock || !openai) {
    return {
      topics: topics
        .filter((t) => t.enabled !== false)
        .map((t) => ({
          topicId: t.id,
          narration: t.narration || `Script for ${t.title}: Explain the key points with vivid props and actions.`,
          scenes: t.scenes || mockScenes(t.title),
        })),
    };
  }

  const results: ScenescribeScriptResponse["topics"] = [];

  for (const topic of topics.filter((t) => t.enabled !== false)) {
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You write narration and scene breakdowns for short, vivid explainer videos. Use props, actions, and overlays. Respond with JSON only.",
          },
          {
            role: "user",
            content: JSON.stringify({
              topic,
              source: cleanedText.slice(topic.sourceSpan?.startChar ?? 0, topic.sourceSpan?.endChar ?? 2000),
              config,
              request:
                "Return narration plus 2-6 scenes with sceneSummary, visualDescription, actions, props, overlayTextSuggestions, cameraStyle, estimatedDurationSeconds.",
            }),
          },
        ],
        temperature: 0.5,
        response_format: { type: "json_object" },
      });

      const parsed = JSON.parse(completion.choices[0].message.content || "{}");
      results.push({
        topicId: topic.id,
        narration: parsed.narration || parsed.script || "",
        scenes: (parsed.scenes || []).map((s: any, idx: number) => ({
          id: s.id || `${topic.id}-s${idx + 1}`,
          order: idx + 1,
          sceneSummary: s.sceneSummary || s.title || "",
          visualDescription: s.visualDescription || s.description || "",
          actions: s.actions || [],
          props: s.props || [],
          overlayTextSuggestions: s.overlayTextSuggestions || [],
          cameraStyle: s.cameraStyle,
          estimatedDurationSeconds: s.estimatedDurationSeconds,
        })),
      });
    } catch (error) {
      logger.error(`[SceneScribe] Failed to generate script for topic ${topic.id}`, error);
      results.push({
        topicId: topic.id,
        narration: `Placeholder narration for ${topic.title}.`,
        scenes: mockScenes(topic.title),
      });
    }
  }

  return { topics: results };
}

