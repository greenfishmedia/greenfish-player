import Mux from "mux-embed";
const {version} = require("../package.json");

export const InitializeMuxMonitoring = async ({
  appName="elv-player-js",
  elvPlayer,
  playoutUrl,
  authorizationToken,
  disableCookies
}) => {
  playoutUrl = new URL(playoutUrl);

  const client = await elvPlayer.Client();
  const muxKey = (await client.NetworkInfo()).name === "main" ?
    "aq4mdjn7qo5sbkf89pkvfv93j" :
    "2i5480sms8vdgj0sv9bv6lpk5";

  const versionHash = playoutUrl.pathname.split("/").find(token => token.startsWith("hq__"));
  const objectId = client.utils.DecodeVersionHash(versionHash).objectId;
  const offering = playoutUrl.toString().match(/\/rep\/playout\/([^/]+)/)[1] || "default";
  const sessionId = playoutUrl.searchParams.get("sid");

  let name = versionHash;
  try {
    const metadata = (await client.ContentObjectMetadata({
      versionHash,
      metadataSubtree: "/public",
      select: [
        "name",
        "asset_metadata/display_title",
        "asset_metadata/title"
      ],
      authorizationToken
    })) || {};

    name =
      (metadata.asset_metadata || {}).display_title ||
      (metadata.asset_metadata || {}).title ||
      metadata.name || versionHash;
    // eslint-disable-next-line no-empty
  } catch (error) {}

  let tenantId = undefined;
  try {
    tenantId = await client.ContentObjectTenantId({versionHash});
    // eslint-disable-next-line no-empty
  } catch (error) {}

  let address = await client.CurrentAccountAddress();
  if(authorizationToken || client.staticToken) {
    try {
      const {payload} = client.utils.DecodeSignedToken(authorizationToken);
      address = payload.adr || address;
      // eslint-disable-next-line no-empty
    } catch (error) {}
  }

  let addressDigest = address;
  if(typeof crypto !== "undefined") {
    try {
      const encoder = new TextEncoder();
      addressDigest = Buffer.from(
        await crypto.subtle.digest("SHA-256", encoder.encode(address))
      ).toString("hex");
      // eslint-disable-next-line no-empty
    } catch (error) {}
  }

  const options = {
    debug: false,
    disableCookies,
    data: {
      env_key: muxKey,
      video_id: objectId,
      video_variant_id: versionHash,
      video_variant_name: offering,
      video_title: name,
      video_cdn: playoutUrl.hostname,
      viewer_user_id: addressDigest,
      sub_property_id: tenantId,
      player_name: appName,
      player_version: version,
      player_init_time: elvPlayer.initTime
    }
  };

  if(sessionId) {
    options.data.view_session_id = sessionId;
  }

  if(elvPlayer.player) {
    if(elvPlayer.HLS) {
      options.hlsjs = elvPlayer.player;
      options.Hls = elvPlayer.HLS;
    } else if(elvPlayer.Dash) {
      options.dashjs = elvPlayer.player;
    }
  }
  try {
    Mux.monitor(elvPlayer.video, options);

    // eslint-disable-next-line no-console
    console.info("elv-player-js: Mux monitoring initialized");
    // eslint-disable-next-line no-console
    console.info(JSON.stringify({...options, hlsjs: {}}));
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn("elv-player-js: Failed to initialize mux monitoring:");
    // eslint-disable-next-line no-console
    console.warn(JSON.stringify(options, null, 2));
    // eslint-disable-next-line no-console
    console.warn(error);
  }
};
