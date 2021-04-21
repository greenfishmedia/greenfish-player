import "./test.scss";

import {ElvClient} from "@eluvio/elv-client-js";
import EluvioPlayer, {EluvioPlayerParameters} from "../src";

const Initialize = async () => {
  const client = await ElvClient.FromConfigurationUrl({
    configUrl: "https://demov3.net955210.contentfabric.io/config"
  });

  /*
  let wallet = client.GenerateWallet();
  let signer = wallet.AddAccount({
    privateKey: process.env.PRIVATE_KEY
  });

  client.SetSigner({signer});

   */

  const tenantId = "iten3HEEASRTo2rNLeeKw4cfq4sPuX6";

  await client.RedeemCode({
    tenantId,
    code: "dVGZRUj"
    //code: "wVFVYV8"
  });

  const versionHash = await client.LatestVersionHash({versionHash: "hq__36gaCZiFBKL6QLUYAxuSfpRQy1qFFBF8XU3LysDbucxRZz6Dt7GfDYxYaTg1kDY677QNigirFS"});
  //const versionHash = await client.LatestVersionHash({versionHash: "hq__JBuEFojvV3EuEMEtq7wY589Bd1uw38WASYTXoJK4Lmt4nvsy3k9SyR86Z3hgJa8HyQVm4g9qjq"});
  //const versionHash = await client.LatestVersionHash({versionHash: "hq__KRZUjbZCpZFar4Jhg813sN2BGFPR1aSQnxDTVpB8iMAS7uG5acnmioXnoJac7xAA3PAFMGrThr"});

  const availableOfferings = await client.AvailableOfferings({
    versionHash,
    linkPath: "public/asset_metadata/offerings",
    directLink: true
  });

  const offeringId = Object.keys(availableOfferings)[0];
  const offeringURI = availableOfferings[offeringId].uri;

  new EluvioPlayer(
    document.getElementById("player-target"),
    {
      clientOptions: {
        network: EluvioPlayerParameters.networks.DEMO,
        client
      },
      sourceOptions: {
        playoutParameters: {
          offeringURI
        }
      },
      playerOptions: {
        muted: true,
        controls: EluvioPlayerParameters.controls.ON
      }
    }
  );
};


Initialize();
