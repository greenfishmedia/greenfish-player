import "./index.scss";

import {ElvClient} from "@eluvio/elv-client-js";
import {EluvioPlayer, EluvioPlayerParameters} from "../lib";

const Initialize = async () => {
  const client = await ElvClient.FromConfigurationUrl({
    configUrl: "https://demov3.net955210.contentfabric.io/config"
  });

  const tenantId = "iten4QaRLK2y5zwYoWSoY5MdMqKXeSCV";

  await client.RedeemCode({
    tenantId,
    code: "WT4hQHt"
  });

  const siteId = "iq__AHq2NNDujj4M89xVFHTUGQMwgG8";

  const availableOfferings = await client.AvailableOfferings({
    objectId: siteId,
    linkPath: "public/asset_metadata/channels/default/offerings",
    directLink: true
  });

  // Retrieve offering URI from available offering
  const offeringId = Object.keys(availableOfferings)[0];
  const offeringURI = availableOfferings[offeringId].uri;

  window.player = new EluvioPlayer(
    document.getElementById("player-target"),
    {
      clientOptions: {
        client
      },
      sourceOptions: {
        playoutParameters: {
          offeringURI
        }
      },
      playerOptions: {
        muted: EluvioPlayerParameters.muted.ON,
        autoplay: EluvioPlayerParameters.autoplay.ON,
        controls: EluvioPlayerParameters.controls.AUTO_HIDE
      }
    }
  );
};

Initialize();
