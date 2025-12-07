import { NextRequest, NextResponse } from "next/server";
import { getScenescribeProject, updateScenescribeProject } from "@/lib/scenescribe/store";
import { logger } from "@/lib/logger";
import { generateTopicVideo } from "@/lib/scenescribe/video";
import { ScenescribeTopic } from "@/types/scenescribe";

export async function POST(request: NextRequest, { params }: { params: { projectId: string } }) {
  try {
    const body = await request.json();
    const project = await getScenescribeProject(params.projectId);
    if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const topicFilter: string[] | undefined = Array.isArray(body.topics) ? body.topics : undefined;
    const targets = project.topics.filter(
      (t) => t.enabled !== false && (!topicFilter || topicFilter.includes(t.id))
    );

    if (!targets.length) {
      return NextResponse.json({ error: "No topics selected" }, { status: 400 });
    }

    const updatedTopics: ScenescribeTopic[] = [...project.topics];
    for (const target of targets) {
      const { status, media } = await generateTopicVideo(target, project.config);
      const idx = updatedTopics.findIndex((t) => t.id === target.id);
      if (idx >= 0) {
        updatedTopics[idx] = {
          ...updatedTopics[idx],
          videoStatus: status,
          media,
        };
      }
    }

    const overallStatus = updatedTopics.every((t) => (t.enabled !== false ? t.videoStatus === "ready" : true))
      ? "completed"
      : "videos_generating";

    const updatedProject = await updateScenescribeProject(project.id, {
      topics: updatedTopics,
      status: overallStatus,
    });

    return NextResponse.json({ project: updatedProject });
  } catch (error) {
    logger.error("[SceneScribe] Failed to generate videos", error);
    return NextResponse.json({ error: "Failed to generate videos" }, { status: 500 });
  }
}

