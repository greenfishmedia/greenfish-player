import "./index.scss";

import {ElvClient} from "@eluvio/elv-client-js";
import {EluvioPlayer, EluvioPlayerParameters} from "../src";

const Initialize = async () => {
  const client = await ElvClient.FromConfigurationUrl({
    configUrl: "https://demov3.net955210.contentfabric.io/config"
  });

  const tenantId = "iten3HEEASRTo2rNLeeKw4cfq4sPuX6";

  await client.RedeemCode({
    tenantId,
    code: "wVFVYV8"
  });

  const objectId = "iq__2AmSgrs62phyLTd3WF9anZrUD8QY";

  const availableOfferings = await client.AvailableOfferings({
    objectId,
    linkPath: "public/asset_metadata/offerings",
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
