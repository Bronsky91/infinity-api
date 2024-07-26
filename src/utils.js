const path = require("path");
const fs = require("fs");

const { GENERATOR } = require("./constants");

const dungeonScriptPath = path.join(
  __dirname,
  `../../Mythical_Maps/dungeon/rd_dungeon_args.py`
);
const roadScriptPath = path.join(
  __dirname,
  `../../Mythical_Maps/road/rd_road_args.py`
);
const tavernScriptPath = path.join(
  __dirname,
  `../../Mythical_Maps/tavern/rd_tavern_args.py`
);
const wildernessScriptPath = path.join(
  __dirname,
  `../../Mythical_Maps/wilderness/rd_wilderness_args.py`
);

const outputDir = path.join(__dirname, `../../Mythical_Maps/finished/`);

const getWildernessMapSize = (mapSize) => {
  switch (mapSize) {
    case 1:
      return "small";
    case 2:
      return "medium";
    case 3:
      return "large";
    default:
      return "small";
  }
};

const azDateTime = () => {
  const now = new Date();
  const utcNow = new Date(now.getTime() + now.getTimezoneOffset() * 60000);
  const arizonaTime = new Date(utcNow.getTime() - 7 * 60 * 60000); // UTC-7 for Arizona time
  return arizonaTime;
};

const deleteFiles = (files) =>
  files.forEach((file) => {
    if (file !== "") {
      fs.unlink(outputDir + file, (err) => {
        if (err) {
          console.error("Error occurred while deleting the file:", err);
        } else {
          console.log(`File ${file} deleted successfully`);
        }
      });
    }
  });

const getScriptPathFromGenerator = (generator) => {
  switch (generator) {
    case GENERATOR.DUNGEON:
      return dungeonScriptPath;
    case GENERATOR.ROAD:
      return roadScriptPath;
    case GENERATOR.TAVERN:
      return tavernScriptPath;
    case GENERATOR.WILDERNESS:
      return wildernessScriptPath;
    default:
      return dungeonScriptPath;
  }
};

const getParams = (request) => {
  const {
    generator,
    name,
    visuals,
    layout,
    gridType,
    time,
    season,
    roadEvent,
    includeTavern,
    mapSize,
    quality,
    seed,
    dmGuideSettings,
    difficulty,
  } = request;

  let params = {};

  switch (generator) {
    case GENERATOR.DUNGEON:
      params = {
        "--title": name ? `"${name}"` : null,
        "--tileTheme": visuals?.type,
        "--tileCount": mapSize,
        "--tileGenInput": layout,
        "--grid_type": gridType,
        "--quality": quality,
        "--user_seed": seed?.show ? seed.value : null,
        "--dm_map": dmGuideSettings?.show,
        "--dm_guide": dmGuideSettings?.show,
        "--party_members": dmGuideSettings?.show
          ? dmGuideSettings.partySize
          : null,
        "--party_level": dmGuideSettings?.show
          ? dmGuideSettings?.partyLevel
          : null,
        "--difficulty": difficulty,
      };
      break;

    case GENERATOR.ROAD:
      params = {
        "--title": name ? `"${name}"` : null,
        "--length": mapSize,
        "--tavern": includeTavern,
        "--time_of_day": time,
        "--season": season,
        "--grid_type": gridType,
        "--middle_event": roadEvent,
        "--quality": quality,
        "--user_seed": seed?.show ? seed.value : null,
      };
      break;

    case GENERATOR.TAVERN:
      params = {
        "--title": name ? `"${name}"` : null,
        "--time_of_day": time,
        "--season": season,
        "--grid_type": gridType,
        "--quality": quality,
        "--user_seed": seed?.show ? seed.value : null,
        "--dm_guide": dmGuideSettings?.show,
      };
      break;

    case GENERATOR.WILDERNESS:
      params = {
        "--title": name ? `"${name}"` : null,
        "--grid_type": gridType,
        "--quality": quality,
        "--size": getWildernessMapSize(mapSize),
        "--user_seed": seed?.show ? seed.value : null,
      };
      break;

    default:
      return "";
  }

  // Remove null, undefined, or false values from params
  Object.keys(params).forEach((key) => {
    params[key] == null || params[key] === false ? delete params[key] : {};
  });

  // Convert params to string
  const paramString = Object.entries(params)
    .map(([key, value]) => (value === true ? key : `${key} ${value}`))
    .join(" ");

  return paramString;
};

const sanitizeFilename = (filename) => {
  // Replace any character that is not a word character or a dot with an underscore
  return filename.replace(/[^\w.-]/g, "_");
};

module.exports = {
  getParams,
  getScriptPathFromGenerator,
  azDateTime,
  deleteFiles,
  outputDir,
  sanitizeFilename,
};
