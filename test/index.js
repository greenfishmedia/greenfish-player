import "./test.scss";

import {ElvClient} from "@eluvio/elv-client-js";
import {EluvioPlayer, EluvioPlayerParameters} from "../src";

const Initialize = async () => {
  const client = await ElvClient.FromConfigurationUrl({
    configUrl: "https://main.net955305.contentfabric.io/config"
  });

  await client.SetStaticToken({token: "acspjc2He3BmcNAiRcNX7wrmvo1tQ18euppYfV2jypNazJEGAEb91pNc4H5JBVT1zZMqsyp93TvFfcdGUMx316EcGx36DaKaT4agXeXzAEchUXSf7FTuF8McKHtQx8V5LHeL6cEWZG64bfycj32eG7fDJMJ7BG47B3HT4kj5pUTwLtYWATkqjbsuji1KnyuvdmkhwPJViBCKw5VrULH11KJJpPAaqT87MhLTC86K2fQbyTnx9mQMSxtzGSf1KqjgtHmJyE6w2rzSfmnJGGaDNawAtVinHDaztMagY3Us"});

  const versionHash = await client.LatestVersionHash({versionHash: "hq__8fpRseTe9LAasv8mSERede9A2shHJ3KghGMZGKKb7BQuPF8Zonb6XJrabUjfxmwSXCfeZz83Sb"});

  window.player = new EluvioPlayer(
    document.getElementById("player-target"),
    {
      clientOptions: {
        network: EluvioPlayerParameters.networks.MAIN,
        client
      },
      sourceOptions: {
        playoutParameters: {
          versionHash
        }
      },
      playerOptions: {
        muted: true,
        controls: EluvioPlayerParameters.controls.AUTO_HIDE,
        capLevelToPlayerSize: EluvioPlayerParameters.capLevelToPlayerSize.ON
      }
    }
  );
};


Initialize();
