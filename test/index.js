import "./test.scss";

import EluvioPlayer, {EluvioPlayerParameters} from "../src";

new EluvioPlayer(
  document.getElementById("player-target"),
  {
    clientOptions: {
      network: EluvioPlayerParameters.networks.MAIN
    },
    sourceOptions: {
      playoutParameters: {
        versionHash: "hq__CcdV4wnCNq9wv6jXpYeCQ2GE4FLQBFtVSSSt2XKfBJMrH89DFDGsfkpWWvBy16QBGGYeF5mLGo"
      }
    }
  }
);
