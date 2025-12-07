import { randomUUID } from "crypto";
import { collection, doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { ScenescribeProject, ScenescribeTopic, ScenescribeMedia, ScenescribeTaskStatus } from "@/types/scenescribe";
import { getScenescribeDb } from "./firebase";

const useMemoryStore = process.env.SCENESCRIBE_MOCK === "true" || process.env.NODE_ENV === "test";

type InMemoryStore = {
  projects: Map<string, ScenescribeProject>;
};

const globalStore: InMemoryStore =
  (globalThis as any).__SCENESCRIBE_STORE || { projects: new Map<string, ScenescribeProject>() };

if (!(globalThis as any).__SCENESCRIBE_STORE) {
  (globalThis as any).__SCENESCRIBE_STORE = globalStore;
}

type CreateProjectInput = {
  inputType: "url" | "text";
  url?: string;
  rawText?: string;
  cleanedText?: string;
  summary: string;
  topics: ScenescribeTopic[];
  config: ScenescribeProject["config"];
};

export async function createScenescribeProject(payload: CreateProjectInput): Promise<ScenescribeProject> {
  const id = randomUUID();
  const now = new Date().toISOString();

  const project: ScenescribeProject = {
    id,
    inputType: payload.inputType,
    url: payload.url || null,
    rawText: payload.rawText,
    cleanedText: payload.cleanedText,
    summary: payload.summary,
    topics: payload.topics,
    config: { ...payload.config, topicOverrides: payload.config.topicOverrides || {} },
    status: "structured",
    createdAt: now,
    updatedAt: now,
  };

  if (useMemoryStore) {
    globalStore.projects.set(id, project);
    return project;
  }

  const db = getScenescribeDb();
  const ref = doc(collection(db, "scenescribe_projects"), id);
  await setDoc(ref, project);

  return project;
}

export async function getScenescribeProject(projectId: string): Promise<ScenescribeProject | null> {
  if (useMemoryStore) {
    return globalStore.projects.get(projectId) || null;
  }

  const db = getScenescribeDb();
  const ref = doc(collection(db, "scenescribe_projects"), projectId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return snap.data() as ScenescribeProject;
}

export async function updateScenescribeProject(
  projectId: string,
  updates: Partial<ScenescribeProject>
): Promise<ScenescribeProject | null> {
  const now = new Date().toISOString();

  if (useMemoryStore) {
    const existing = globalStore.projects.get(projectId);
    if (!existing) return null;
    const merged = { ...existing, ...updates, updatedAt: now };
    globalStore.projects.set(projectId, merged);
    return merged;
  }

  const db = getScenescribeDb();
  const ref = doc(collection(db, "scenescribe_projects"), projectId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;

  const merged = { ...(snap.data() as ScenescribeProject), ...updates, updatedAt: now };
  await updateDoc(ref, merged);
  return merged;
}

export function upsertTopics(
  currentTopics: ScenescribeTopic[],
  updates: ScenescribeTopic[]
): ScenescribeTopic[] {
  const byId = new Map(currentTopics.map((t) => [t.id, t]));
  updates.forEach((t) => byId.set(t.id, { ...byId.get(t.id), ...t } as ScenescribeTopic));
  return Array.from(byId.values()).sort((a, b) => a.order - b.order);
}

export function updateTopicStatuses(
  topics: ScenescribeTopic[],
  statusMap: Record<string, { scriptStatus?: ScenescribeTaskStatus; videoStatus?: ScenescribeTaskStatus; media?: ScenescribeMedia }>
): ScenescribeTopic[] {
  return topics.map((topic) => {
    const status = statusMap[topic.id];
    if (!status) return topic;
    return {
      ...topic,
      scriptStatus: status.scriptStatus ?? topic.scriptStatus,
      videoStatus: status.videoStatus ?? topic.videoStatus,
      media: status.media ?? topic.media,
    };
  });
}

