import "./test.scss";

import {ElvClient} from "@eluvio/elv-client-js";
import {EluvioPlayer, EluvioPlayerParameters} from "../src";

const Initialize = async () => {
  const client = await ElvClient.FromConfigurationUrl({
    configUrl: "https://main.net955305.contentfabric.io/config"
  });

  window.player = new EluvioPlayer(
    document.getElementById("player-target"),
    {
      clientOptions: {
        client
      },
      sourceOptions: {
        drms: ["fairplay"],
        playoutParameters: {
          
        }
      },
      playerOptions: {
        muted: true
      }
    }
  );
};


Initialize();
