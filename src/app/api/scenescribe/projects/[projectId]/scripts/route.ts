import { NextRequest, NextResponse } from "next/server";
import { getScenescribeProject, updateScenescribeProject, upsertTopics } from "@/lib/scenescribe/store";
import { logger } from "@/lib/logger";
import { generateScripts } from "@/lib/scenescribe/llm";
import { ScenescribeTopic } from "@/types/scenescribe";

export async function POST(request: NextRequest, { params }: { params: { projectId: string } }) {
  try {
    const body = await request.json();
    const project = await getScenescribeProject(params.projectId);
    if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const topicFilter: string[] | undefined = Array.isArray(body.topics) ? body.topics : undefined;
    const activeTopics = project.topics.filter(
      (t) => t.enabled !== false && (!topicFilter || topicFilter.includes(t.id))
    );

    if (!activeTopics.length) {
      return NextResponse.json({ error: "No topics selected" }, { status: 400 });
    }

    const scripts = await generateScripts(activeTopics, project.cleanedText || project.rawText || "", project.config);

    const updatedTopics: ScenescribeTopic[] = project.topics.map((topic) => {
      const found = scripts.topics.find((t) => t.topicId === topic.id);
      if (!found) return topic;
      return {
        ...topic,
        narration: found.narration,
        scenes: found.scenes,
        scriptStatus: "ready",
      };
    });

    const updatedProject = await updateScenescribeProject(project.id, {
      topics: updatedTopics,
      status: "scripts_ready",
    });

    return NextResponse.json({ project: updatedProject });
  } catch (error) {
    logger.error("[SceneScribe] Failed to generate scripts", error);
    return NextResponse.json({ error: "Failed to generate scripts" }, { status: 500 });
  }
}

