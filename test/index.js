import "./test.scss";

import {ElvClient} from "@eluvio/elv-client-js";
import {EluvioPlayer, EluvioPlayerParameters} from "../src";

const Initialize = async () => {
  const client = await ElvClient.FromConfigurationUrl({
    configUrl: "https://main.net955305.contentfabric.io/config"
  });

  await client.SetStaticToken();

  const versionHash = await client.LatestVersionHash({versionHash: "hq__CcdV4wnCNq9wv6jXpYeCQ2GE4FLQBFtVSSSt2XKfBJMrH89DFDGsfkpWWvBy16QBGGYeF5mLGo"});

  window.player = new EluvioPlayer(
    document.getElementById("player-target"),
    {
      clientOptions: {
        network: EluvioPlayerParameters.networks.MAIN
      },
      sourceOptions: {
        playoutParameters: {
          versionHash
        }
      },
      playerOptions: {
        muted: true,
        controls: "autohide"
      }
    }
  );
};


Initialize();
