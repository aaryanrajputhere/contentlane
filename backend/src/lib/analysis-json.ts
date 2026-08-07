import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export interface AnalysisJsonRun {
  website: string;
  projectId: string;
  analysisJobId: string;
  startedAt: Date;
}

export interface AnalysisJsonRecorder {
  readonly run: AnalysisJsonRun;
  readonly directory: string;
  readonly prefix: string;
  write(name: string, value: unknown): Promise<string | null>;
}

function safeSegment(value: string, fallback: string) {
  const safe = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
  return safe || fallback;
}

function domainFromWebsite(website: string) {
  try {
    const candidate = /^https?:\/\//i.test(website) ? website : `https://${website}`;
    return new URL(candidate).hostname.replace(/^www\./i, "");
  } catch {
    return website;
  }
}

function defaultOutputRoot() {
  return path.resolve(__dirname, "../../../json");
}

function serialize(value: unknown) {
  return `${JSON.stringify(value ?? null, (_key, item: unknown) => {
    if (item instanceof Error) {
      return { name: item.name, message: item.message };
    }
    if (typeof item === "bigint") return item.toString();
    return item;
  }, 2)}\n`;
}

export function createAnalysisJsonRecorder(
  run: AnalysisJsonRun,
  outputRoot = process.env.BRAND_ANALYSIS_JSON_DIR || defaultOutputRoot(),
): AnalysisJsonRecorder {
  const domain = safeSegment(domainFromWebsite(run.website), "unknown-domain");
  const timestamp = run.startedAt.toISOString().replace(/[:.]/g, "-");
  const projectId = safeSegment(run.projectId, "unknown-project");
  const analysisJobId = safeSegment(run.analysisJobId, "unknown-job");
  const directory = path.resolve(outputRoot, domain);
  const prefix = `${timestamp}_${projectId}_${analysisJobId}`;

  return {
    run,
    directory,
    prefix,
    async write(name, value) {
      const artifactName = safeSegment(name, "artifact");
      const filePath = path.resolve(directory, `${prefix}_${artifactName}.json`);
      if (!filePath.startsWith(`${directory}${path.sep}`)) {
        console.warn(`[analysis-json] refused unsafe path for artifact "${name}"`);
        return null;
      }
      try {
        await mkdir(directory, { recursive: true });
        await writeFile(filePath, serialize(value), "utf8");
        return filePath;
      } catch (error) {
        console.warn(
          `[analysis-json] unable to write ${artifactName}:`,
          error instanceof Error ? error.message : error,
        );
        return null;
      }
    },
  };
}

export function errorJson(error: unknown) {
  return error instanceof Error
    ? { name: error.name, message: error.message }
    : { name: "UnknownError", message: String(error) };
}
