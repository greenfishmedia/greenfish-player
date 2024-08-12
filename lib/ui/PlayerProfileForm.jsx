import ProfileFormStyles from "../static/stylesheets/player-profile-form.module.scss";

// eslint-disable-next-line no-unused-vars
import React, {useEffect, useRef, useState} from "react";
import {Spinner} from "./Components.jsx";
import {RegisterModal} from "./Observers.js";

const PlayerProfileForm = ({player, Close}) => {
  const [playerOptions, setPlayerOptions] = useState(JSON.stringify(player.hlsOptions || "{}", null, 2));
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const formRef = useRef();

  useEffect(() => {
    if(!formRef || !formRef.current) { return; }

    const modalHandlerDisposer = RegisterModal({element: formRef.current, Hide: Close});

    return () => modalHandlerDisposer && modalHandlerDisposer();
  }, [formRef]);

  const Submit = async event => {
    event.preventDefault();

    try {
      setSubmitting(true);
      await player.controls.SetPlayerProfile({profile: "custom", customOptions: JSON.parse(playerOptions)});

      Close();
    } catch(error) {
      setErrorMessage(error.toString());
      setSubmitting(false);
    }
  };

  return (
    <div
      role="complementary"
      tabIndex={-1}
      className={ProfileFormStyles["container"]}
    >
      <div className={ProfileFormStyles["overlay"]}>
        <form
          onSubmit={Submit}
          className={ProfileFormStyles["form"]}
          ref={formRef}
        >
          <h2 className={ProfileFormStyles["header"]}>
            Custom hls.js Options
          </h2>
          <div className={ProfileFormStyles["input-container"]}>
            <textarea
              disabled={submitting}
              autoFocus
              value={playerOptions}
              title={errorMessage}
              aria-label="Player Options"
              aria-invalid={!!errorMessage}
              aria-errormessage={errorMessage || ""}
              onChange={event => setPlayerOptions(event.currentTarget.value)}
              onFocus={() => setErrorMessage("")}
              onBlur={() => {
                try {
                  setErrorMessage("");
                  setPlayerOptions(JSON.stringify(JSON.parse(playerOptions || "{}"), null, 2));
                } catch(error) {
                  setErrorMessage(error.toString());
                }
              }}
              className={`${ProfileFormStyles["input"]} ${errorMessage ? ProfileFormStyles["input--invalid"] : ""}`}
            />
            <div className={ProfileFormStyles["player-info"]}>
              <a tabIndex={0} href="https://github.com/video-dev/hls.js/blob/master/docs/API.md" rel="noreferrer" target="_blank" className={ProfileFormStyles["api-link"]}>
                API Docs
              </a>
              <div className={ProfileFormStyles["player-version"]}>
                hls.js { player.HLS.version }
              </div>
            </div>
          </div>
          <div className={ProfileFormStyles["actions"]}>
            <button
              type="button"
              aria-label="Cancel"
              onClick={() => Close()}
              className={ProfileFormStyles["cancel"]}
            >
              Cancel
            </button>
            <button
              type="submit"
              aria-label="Submit"
              disabled={!!errorMessage}
              className={ProfileFormStyles["submit"]}
            >
              { submitting ? <Spinner light /> : "Submit" }
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PlayerProfileForm;
