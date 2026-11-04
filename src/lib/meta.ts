import {randomUUID, createHash} from "node:crypto";
import {baseUrl} from "./config";
import {db} from "./db";

export const metaDatasetPattern = /^\d{1,32}$/;

export function metaSettings() {
 const {META_ACCESS_TOKEN: token, META_GRAPH_VERSION: version} = process.env;
 return token && version && /^v\d+\.\d+$/.test(version)
  ? {token, version} : null;
}

export async function metaClickId(value: string | null) {
 if (!metaSettings() || !value || !/^[A-Za-z0-9_-]{1,500}$/.test(value)) return null;
 const connection = await db.metaConnection.findUnique({where: {id: "default"}});
 return connection ? `${connection.datasetId}:fb.1.${Date.now()}.${value}` : null;
}

export async function sendMetaFriend(event: {id: string; verifiedAt: Date; fbc: string}) {
 const settings = metaSettings();
 if (!settings) return;
 try {
  const [datasetId, fbc] = event.fbc.split(":");
  const connection = await db.metaConnection.findUnique({where: {id: "default"}});
  if (!fbc || connection?.datasetId !== datasetId) return;
  const response = await postMetaEvent(settings, datasetId, event.id, event.verifiedAt, {fbc}, process.env.META_TEST_EVENT_CODE);
  if (!response.ok) console.error("Meta friend event rejected", response.status);
 } catch {
  console.error("Meta friend event request failed");
 }
}

async function postMetaEvent(settings: NonNullable<ReturnType<typeof metaSettings>>, datasetId: string, id: string, at: Date, userData: Record<string,string>, testCode?: string) {
 return fetch(`https://graph.facebook.com/${settings.version}/${datasetId}/events`, {
   method: "POST",
   headers: {"Content-Type": "application/json", Authorization: `Bearer ${settings.token}`},
   signal: AbortSignal.timeout(2500),
   body: JSON.stringify({
    data: [{
     event_name: "LineFriendAdded",
     event_id: id,
     event_time: Math.floor(at.getTime() / 1000),
     action_source: "website",
     event_source_url: baseUrl(),
     user_data: userData,
    }],
    ...(testCode ? {test_event_code: testCode} : {}),
   }),
  });
}

export async function sendMetaTest() {
 const settings = metaSettings();
 const testCode = process.env.META_TEST_EVENT_CODE?.trim();
 if (!settings || !testCode) return {status:"test-missing"};
 const connection = await db.metaConnection.findUnique({where: {id: "default"}});
 if (!connection) return {status:"test-missing"};
 const sentAt = new Date();
 const id = randomUUID();
 const externalId = createHash("sha256").update(id).digest("hex");
 try {
  const response = await postMetaEvent(settings, connection.datasetId, id, sentAt, {external_id: externalId}, testCode);
  const result = await response.json().catch(() => null);
  const trace = result?.fbtrace_id ?? result?.error?.fbtrace_id ?? response.headers.get("x-fb-trace-id");
  return {status: response.ok && result?.events_received === 1 ? "test-sent" : "test-rejected", sentAt: sentAt.toISOString(), trace: typeof trace === "string" && /^[A-Za-z0-9_-]{1,100}$/.test(trace) ? trace : undefined, http: String(response.status)};
 } catch {
  return {status:"test-failed", sentAt:sentAt.toISOString()};
 }
}
