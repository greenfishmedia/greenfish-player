const fs = require("fs");
const Path = require("path");

const iconSource = {
  PlayCircleIcon: Path.resolve(__dirname, "./static/icons/media/LargePlayIcon.svg"),
  PlayIcon: Path.resolve(__dirname, "./static/icons/media/Play icon.svg"),
  PauseIcon: Path.resolve(__dirname, "./static/icons/media/Pause icon.svg"),
  FullscreenIcon: Path.resolve(__dirname, "./static/icons/media/Full Screen icon.svg"),
  ExitFullscreenIcon: Path.resolve(__dirname, "./static/icons/minimize.svg"),
  SettingsIcon: Path.resolve(__dirname, "./static/icons/media/Settings icon.svg"),
  CloseIcon: Path.resolve(__dirname, "./static/icons/x.svg"),
  MutedIcon: Path.resolve(__dirname, "./static/icons/media/no volume icon.svg"),
  VolumeLowIcon: Path.resolve(__dirname, "./static/icons/media/low volume icon.svg"),
  VolumeHighIcon: Path.resolve(__dirname, "./static/icons/media/Volume icon.svg"),
  MultiViewIcon: Path.resolve(__dirname, "./static/icons/multiview.svg"),
  LeftArrowIcon: Path.resolve(__dirname, "./static/icons/arrow-left.svg"),
};

let iconFile = "";
Object.keys(iconSource).map(iconName => {
  iconFile += `export const ${iconName} = "${fs.readFileSync(iconSource[iconName]).toString("utf8").replaceAll("\n", "").replaceAll("\"", "\\\"")}";\n`;
});

fs.writeFileSync(
  Path.resolve(__dirname, "./static/icons/Icons.js"),
  iconFile
);
