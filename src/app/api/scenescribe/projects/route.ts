import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { fetchAndExtractArticle, normalizeInputText } from "@/lib/scenescribe/ingest";
import { generateStructure } from "@/lib/scenescribe/llm";
import { createScenescribeProject } from "@/lib/scenescribe/store";
import { ScenescribeConfig } from "@/types/scenescribe";

function buildConfig(input?: Partial<ScenescribeConfig>): ScenescribeConfig {
  return {
    platform: input?.platform || "youtube",
    aspectRatio: input?.aspectRatio || "16:9",
    tone: input?.tone || "educational",
    style: input?.style || "semi-abstract",
    targetDurationSeconds: input?.targetDurationSeconds || 60,
    topicOverrides: input?.topicOverrides,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const inputType = body.inputType === "text" ? "text" : "url";
    const config = buildConfig(body.config);

    let sourceText = "";
    let cleanedText = "";

    if (inputType === "url") {
      if (!body.url) {
        return NextResponse.json({ error: "URL is required" }, { status: 400 });
      }
      sourceText = await fetchAndExtractArticle(body.url);
      cleanedText = sourceText;
    } else {
      if (!body.rawText) {
        return NextResponse.json({ error: "rawText is required" }, { status: 400 });
      }
      sourceText = body.rawText;
      cleanedText = normalizeInputText(body.rawText);
    }

    if (!cleanedText || cleanedText.length < 20) {
      return NextResponse.json({ error: "Content is too short to process." }, { status: 400 });
    }

    const { summary, topics } = await generateStructure(cleanedText, config);

    const project = await createScenescribeProject({
      inputType,
      url: body.url,
      rawText: sourceText,
      cleanedText,
      summary,
      topics,
      config,
    });

    return NextResponse.json({ project });
  } catch (error) {
    logger.error("[SceneScribe] Failed to create project", error);
    return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
  }
}

