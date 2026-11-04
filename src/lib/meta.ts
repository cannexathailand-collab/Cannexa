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
  const response = await fetch(`https://graph.facebook.com/${settings.version}/${datasetId}/events`, {
   method: "POST",
   headers: {"Content-Type": "application/json", Authorization: `Bearer ${settings.token}`},
   signal: AbortSignal.timeout(2500),
   body: JSON.stringify({
    data: [{
     event_name: "LineFriendAdded",
     event_id: event.id,
     event_time: Math.floor(event.verifiedAt.getTime() / 1000),
     action_source: "website",
     event_source_url: process.env.APP_URL,
     user_data: {fbc},
    }],
    ...(process.env.META_TEST_EVENT_CODE ? {test_event_code: process.env.META_TEST_EVENT_CODE} : {}),
   }),
  });
  if (!response.ok) console.error("Meta friend event rejected", response.status);
 } catch {
  console.error("Meta friend event request failed");
 }
}
