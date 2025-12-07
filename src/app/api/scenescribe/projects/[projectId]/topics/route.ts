import { NextRequest, NextResponse } from "next/server";
import { getScenescribeProject, updateScenescribeProject, upsertTopics } from "@/lib/scenescribe/store";
import { logger } from "@/lib/logger";
import { ScenescribeTopic } from "@/types/scenescribe";

export async function PATCH(request: NextRequest, { params }: { params: { projectId: string } }) {
  try {
    const body = await request.json();
    const project = await getScenescribeProject(params.projectId);
    if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

    let updatedTopics: ScenescribeTopic[] = project.topics;

    if (body.merge) {
      const { fromId, intoId } = body.merge as { fromId: string; intoId: string };
      const from = updatedTopics.find((t) => t.id === fromId);
      const into = updatedTopics.find((t) => t.id === intoId);
      if (from && into) {
        const merged: ScenescribeTopic = {
          ...into,
          title: into.title || from.title,
          description: [into.description, from.description].filter(Boolean).join(" "),
          keyPoints: [...(into.keyPoints || []), ...(from.keyPoints || [])],
          enabled: into.enabled !== false && from.enabled !== false,
        };
        updatedTopics = updatedTopics
          .filter((t) => t.id !== fromId && t.id !== intoId)
          .concat({ ...merged, order: Math.min(into.order, from.order) })
          .sort((a, b) => a.order - b.order)
          .map((t, idx) => ({ ...t, order: idx + 1 }));
      }
    }

    if (Array.isArray(body.topics)) {
      updatedTopics = upsertTopics(updatedTopics, body.topics);
      updatedTopics = updatedTopics.map((topic, idx) => ({ ...topic, order: idx + 1 }));
    }

    const updated = await updateScenescribeProject(params.projectId, {
      topics: updatedTopics,
    });

    return NextResponse.json({ project: updated });
  } catch (error) {
    logger.error("[SceneScribe] Failed to update topics", error);
    return NextResponse.json({ error: "Failed to update topics" }, { status: 500 });
  }
}

