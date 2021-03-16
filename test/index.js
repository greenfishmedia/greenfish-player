import "./test.scss";

import EluvioPlayer, {EluvioPlayerParameters} from "../src";

const player = new EluvioPlayer(
  document.getElementById("player-target"),
  {
    sourceOptions: {
      protocols: ["dash"],
      drms: ["clear"],
      playoutParameters: {
        versionHash: "hq__CcdV4wnCNq9wv6jXpYeCQ2GE4FLQBFtVSSSt2XKfBJMrH89DFDGsfkpWWvBy16QBGGYeF5mLGo"
      }
    }
  }
);

console.log(player);
