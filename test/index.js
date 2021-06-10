import "./test.scss";

import {ElvClient} from "@eluvio/elv-client-js";
import {EluvioPlayer, EluvioPlayerParameters} from "../src";

const Initialize = async () => {
  const client = await ElvClient.FromConfigurationUrl({
    configUrl: "https://demov3.net955210.contentfabric.io/config"
  });

  await client.SetStaticToken();

  const versionHash = await client.LatestVersionHash({versionHash: "hq__MRTeqkmGztyZcyTT6RUrtDSR2vP6iVEj8ZhB1TzmWkQZqED1EUU3cNStmLC3M1bjhTNVx3K8or"});

  window.player = new EluvioPlayer(
    document.getElementById("player-target"),
    {
      clientOptions: {
        network: EluvioPlayerParameters.networks.DEMO
      },
      sourceOptions: {
        playoutParameters: {
          offeringURI: `/q/${versionHash}/rep/channel/ga/options.json?link_depth=1&resolve_ignore_errors=false`
        }
      },
      playerOptions: {
        muted: true
      }
    }
  );
};


Initialize();
