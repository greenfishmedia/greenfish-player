import "./test.scss";

import EluvioPlayer, {EluvioPlayerParameters} from "../src";

new EluvioPlayer(
  document.getElementById("player-target"),
  {
    clientOptions: {
      network: EluvioPlayerParameters.networks.DEMO
    },
    sourceOptions: {
      playoutParameters: {
        //versionHash: "hq__EX7qmXchcvwJ86SEecgDPYhRbDsKRH8D1f8p6qWwT8NQyo9YY8QRHDfzQJrw3jyasGj9FVQe8L",
        objectId: "iq__3kDYVLRxrYfeHoHwkxVmKZUs5o26",
        //linkPath: "public/asset_metadata/promo_videos/0/sources/default"
      }
    },
    playerOptions: {
      controls: "default",
      loop: true
    }
  }
);
